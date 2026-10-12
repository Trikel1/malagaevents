import { test, expect, culture, cultureId, sport, sportId } from './fixtures/app';

for (const entry of [
  { kind: 'event', id: cultureId, title: culture.title, path: 'events' },
  { kind: 'sport', id: sportId, title: sport.title, path: 'sports' },
]) {
  test(`mapa: marcador ${entry.kind} abre su detalle correcto`, async ({ page }) => {
    await page.goto(`/map?kind=${entry.kind}`);
    await page.getByRole('button', { name: 'Lista', exact: true }).click();
    await page.getByRole('complementary').getByRole('button', { name: new RegExp(entry.title) }).click();
    const detail = page.getByRole('dialog');
    const action = page.viewportSize()!.width < 768
      ? detail.getByRole('button', { name: 'Ver evento', exact: true })
      : page.getByRole('complementary').getByRole('button', { name: 'Ver evento', exact: true });
    await action.click();
    await expect(page).toHaveURL(new RegExp(`/${entry.path}/${entry.id}$`));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(entry.title);
  });
}

test('evento cultural: tarjeta, detalle accesible y retorno con filtros', async ({ page }) => {
  await page.goto('/events?filter=today&free=1');
  await page.locator(`a[href="/events/${cultureId}"]`).first().click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(culture.title);
  await expect(page.getByRole('button', { name: 'Añadir a favoritos', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Volver', exact: true }).click();
  await expect(page).toHaveURL(/\/events\?filter=today&free=1$/);
  await expect(page.locator(`a[href="/events/${cultureId}"]`).first()).toBeVisible();
});

test('deportes: tarjeta, detalle y volver', async ({ page }) => {
  await page.goto('/sports');
  await page.locator(`a[href="/sports/${sportId}"]`).first().click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(sport.title);
  await page.getByRole('button', { name: 'Volver', exact: true }).click();
  await expect(page).toHaveURL(/\/sports$/);
  await expect(page.locator('[data-route="sports"]')).toHaveAttribute('data-mode', 'deportes');
});

test('cambio de modo y persistencia tras recarga', async ({ page }) => {
  await page.goto('/');
  const content = page.locator('#contenido-principal');
  await content.getByRole('button', { name: 'Deportes', exact: true }).click();
  await expect(page).toHaveURL(/\/sports$/);
  await page.reload();
  await expect(page.locator('[data-route="sports"]')).toHaveAttribute('data-mode', 'deportes');
  await page.getByRole('navigation').getByRole('button', { name: 'Eventos', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Eventos deportivos');
  await expect(page.locator('[data-route="events"]')).toHaveAttribute('data-mode', 'deportes');
  await page.getByRole('navigation').getByRole('button', { name: 'Inicio', exact: true }).click();
  await page.reload();
  await expect(page.locator('[data-route="home"]')).toHaveAttribute('data-mode', 'deportes');
  await expect(page.locator(`a[href="/sports/${sportId}"]`).first()).toBeVisible();
  await content.getByRole('button', { name: 'Eventos', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.reload();
  await expect(page.locator('[data-route="home"]')).toHaveAttribute('data-mode', 'eventos');
  await page.getByRole('navigation').getByRole('button', { name: 'Mapa', exact: true }).click();
  await expect(page).toHaveURL(/\/map$/);
});

for (const mode of ['eventos', 'deportes'] as const) {
  test(`calendario ${mode}: día, lista, mes y detalle`, async ({ page }) => {
    await page.goto(mode === 'deportes' ? '/sports' : '/');
    await page.getByRole('navigation').getByRole('button', { name: 'Calendario', exact: true }).click();
    const href = mode === 'deportes' ? `/sports/${sportId}` : `/events/${cultureId}`;
    await expect(page.locator(href.startsWith('/sports') ? '[data-mode="deportes"]' : '[data-mode="eventos"]')).toBeVisible();
    await page.getByRole('button', { name: /lunes 12 de octubre/i }).click();
    await expect(page.locator(`a[href="${href}"]`).first()).toBeVisible();
    await page.getByRole('tab', { name: 'Lista', exact: true }).click();
    await expect(page.locator(`a[href="${href}"]`).first()).toBeVisible();
    await page.getByRole('button', { name: 'Mes siguiente', exact: true }).click();
    await expect(page.locator(`a[href="${href}"]`)).toHaveCount(0);
    await page.getByRole('button', { name: 'Hoy', exact: true }).click();
    await page.locator(`a[href="${href}"]`).first().click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(mode === 'deportes' ? sport.title : culture.title);
    await page.getByRole('button', { name: 'Volver', exact: true }).click();
    await expect(page).toHaveURL(/\/calendar$/);
  });
}

test('farmacias: guardia, teléfono, directorio y mapa', async ({ page }) => {
  await page.goto('/pharmacies');
  await expect(page.getByRole('heading', { name: 'Farmacia QA', exact: true })).toBeVisible();
  await expect(page.locator('a[href="tel:952123456"]')).toBeVisible();
  await page.getByRole('tab', { name: 'Directorio', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Farmacia QA', exact: true })).toBeVisible();
  await page.locator('a[href^="/map?kind=pharmacy"]').click();
  await expect(page).toHaveURL(/\/map\?kind=pharmacy&lat=36.72&lng=-4.42$/);
  await page.getByRole('button', { name: 'Lista', exact: true }).click();
  await page.getByRole('complementary').getByRole('button', { name: /Farmacia QA/ }).click();
  await expect(page.getByRole('heading', { name: 'Farmacia QA', exact: true, level: 3 })).toBeVisible();
  if (page.viewportSize()!.width < 768) {
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Ver farmacia', exact: true }).click();
    await expect(page).toHaveURL(/\/pharmacies$/);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
});

test('404: recuperación y detalle cultural inexistente', async ({ page }) => {
  await page.goto('/ruta-qa-inexistente');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Página no encontrada');
  await page.locator('a[href="/events"]').click();
  await expect(page.locator(`a[href="/events/${cultureId}"]`).first()).toBeVisible();
  await page.goto('/events/44444444-4444-4444-8444-444444444444');
  await expect(page.getByRole('heading', { name: 'No encontrado', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Volver', exact: true }).last().click();
  await expect(page).toHaveURL(/\/events$/);
});

test('detalle deportivo inexistente permite volver', async ({ page }) => {
  await page.goto('/sports');
  await page.locator(`a[href="/sports/${sportId}"]`).first().click();
  await page.goto('/sports/44444444-4444-4444-8444-444444444444');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('No encontramos esta actividad deportiva');
  await page.getByRole('button', { name: 'Volver', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(sport.title);
});

test('perfil: nombres accesibles del tema también en móvil', async ({ page }) => {
  await page.goto('/profile');
  for (const name of ['Sistema', 'Claro', 'Oscuro']) {
    const button = page.getByRole('button', { name, exact: true });
    await expect(button).toBeVisible();
    await expect(button).toHaveAccessibleName(name);
    await button.click();
  }
  await expect(page.locator('html')).toHaveClass(/dark/);
});

test('calendario: drawer de filtros operable y cerrado sin bloquear navegación', async ({ page }) => {
  await page.goto('/calendar');
  await page.getByRole('button', { name: 'Afina tu agenda', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('navigation').getByRole('button', { name: 'Perfil', exact: true }).click();
  await expect(page).toHaveURL(/\/profile$/);
});

test('detalle: descarga de calendario y favorito anónimo', async ({ page }) => {
  await page.goto(`/events/${cultureId}`);
  const calendar = page.getByRole('button', { name: 'Añadir al calendario', exact: true }).first();
  const downloading = page.waitForEvent('download');
  await calendar.click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/\.ics$/);
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const ics = Buffer.concat(chunks).toString();
  expect(ics).toContain('BEGIN:VEVENT');
  expect(ics).toContain(`UID:${cultureId}@`);
  expect(ics).toContain('DTSTART:20261012T180000Z');
  await page.getByRole('button', { name: 'Añadir a favoritos', exact: true }).click();
  await expect(page).toHaveURL(/\/auth$/);
});

test('farmacias: municipio sin guardias y recuperación', async ({ page }) => {
  await page.goto('/pharmacies');
  await expect(page.getByRole('heading', { name: 'Farmacia QA', exact: true })).toBeVisible();
  await page.getByRole('main').getByRole('button', { name: 'Málaga', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Marbella', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Farmacia QA', exact: true })).toHaveCount(0);
  await expect(page.getByText(/para otras zonas de la provincia, pero no para Marbella/)).toBeVisible();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('main').getByRole('button', { name: 'Marbella', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Málaga', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Farmacia QA', exact: true })).toBeVisible();
});

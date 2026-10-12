import { test, expect, culture, cultureId, sport, sportId } from './fixtures/app';
import type { Page } from '@playwright/test';

async function failTable(page: Page, table: string) {
  let failed = true;
  await page.route(`**/rest/v1/${table}?**`, route => failed
    ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Controlled QA outage' }) })
    : route.fallback());
  return () => { failed = false; };
}

for (const entry of [
  { route: '/events', table: 'events', ready: culture.title },
  { route: '/events', table: 'events', ready: culture.title, network: true },
  { route: '/sports', table: 'sports_events', ready: sport.title },
  { route: '/map?kind=pharmacy', table: 'pharmacies_guard', ready: 'Farmacia QA' },
  { route: '/calendar', table: 'events', ready: culture.title },
  { route: '/pharmacies', table: 'pharmacies_guard', ready: 'Farmacia QA' },
  { route: '/pharmacies', table: 'pharmacies_directory', ready: 'Farmacia QA', directory: true },
]) {
  test(`${entry.route}: ${entry.table} ${entry.network ? 'network' : 'HTTP'} error y recuperación`, async ({ page }) => {
    const recover = await failTable(page, entry.table);
    if (entry.network) {
      let offline = true;
      await page.route('**/rest/v1/events?**', route => offline ? route.abort('failed') : route.fallback());
      const previous = recover;
      // Turn off the transport failure before the retry button is activated.
      await page.goto(entry.route);
      const retry = page.getByRole('button', { name: 'Reintentar', exact: true });
      await expect(retry).toBeVisible({ timeout: 10000 });
      offline = false;
      previous();
      await retry.click();
    } else {
      await page.goto(entry.route);
      if (entry.directory) await page.getByRole('tab', { name: 'Directorio', exact: true }).click();
      if (entry.route.startsWith('/map')) await page.getByRole('button', { name: 'Lista', exact: true }).click();
      if (entry.route.startsWith('/map')) await expect(page.getByRole('complementary').getByText('No hemos podido cargar los puntos del mapa.', { exact: true })).toBeVisible({ timeout: 10000 });
      const retry = page.getByRole('button', { name: 'Reintentar', exact: true }).first();
      await expect(retry).toBeVisible({ timeout: 10000 });
      if (entry.route === '/calendar') await expect(page.getByText('No hay eventos este día', { exact: true })).toHaveCount(0);
      recover();
      await retry.click();
    }
    if (entry.route.startsWith('/map')) {
      await expect(page.getByRole('complementary').getByRole('button', { name: /Farmacia QA/ })).toBeVisible();
    } else {
      await expect(page.getByRole('heading', { name: entry.ready, exact: true }).first()).toBeVisible();
    }
  });
}

test('agenda deportiva: error de consulta no se presenta como vacío', async ({ page }) => {
  const recover = await failTable(page, 'sports_entities');
  await page.goto('/sports');
  await page.getByRole('navigation').getByRole('button', { name: 'Eventos', exact: true }).click();
  const agenda = page.getByRole('region', { name: 'Agenda deportiva de Málaga' });
  await expect(agenda.getByRole('button', { name: 'Reintentar', exact: true })).toBeVisible({ timeout: 10000 });
  await expect(agenda.getByText(/No hay eventos verificados en este rango/)).toHaveCount(0);
  recover();
  await agenda.getByRole('button', { name: 'Reintentar', exact: true }).click();
  await expect(agenda.getByText(/No hay eventos verificados en este rango/)).toBeVisible();
});

test('detalle deportivo: fuente malformada e imagen fallida no rompen la página', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/rest/v1/sports_events?**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({
    ...sport, source_name: null, source_url: 'invalid-url', image_url: 'https://example.org/qa-broken.jpg',
  }) }));
  await page.route('https://example.org/qa-broken.jpg', route => route.fulfill({ status: 404, body: '' }));
  await page.goto(`/sports/${sportId}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(sport.title);
  await expect(page.locator('figure img')).toHaveJSProperty('complete', true);
  await expect.poll(() => page.locator('figure img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

for (const entry of [
  { route: '/events', table: 'events' }, { route: '/sports', table: 'sports_events' },
  { route: '/map', table: 'events' }, { route: '/calendar', table: 'events' },
  { route: '/pharmacies', table: 'pharmacies_guard' }, { route: `/events/${cultureId}`, table: 'events' },
]) {
  test(`${entry.route}: respuesta lenta no anticipa vacío o error`, async ({ page }) => {
    let release!: () => void;
    let requested!: () => void;
    const started = new Promise<void>(resolve => { requested = resolve; });
    const pending = new Promise<void>(resolve => { release = resolve; });
    await page.route(`**/rest/v1/${entry.table}?**`, async route => { requested(); await pending; await route.fallback(); });
    await page.goto(entry.route);
    try {
      await started;
      await expect(page.getByRole('button', { name: 'Reintentar', exact: true })).toHaveCount(0);
      await expect(page.getByText(/No hay eventos este día|No encontrado|Todavía no tenemos información actualizada/)).toHaveCount(0);
      if (entry.route === '/sports') await expect(page.getByRole('heading', { name: sport.title, exact: true })).toHaveCount(0);
      else await expect(page.getByRole('heading', { name: entry.route === '/pharmacies' ? 'Farmacia QA' : culture.title, exact: true })).toHaveCount(0);
    } finally { release(); }
    if (entry.route === '/map') {
      await page.getByRole('button', { name: 'Lista', exact: true }).click();
      await expect(page.getByRole('complementary').getByRole('button', { name: new RegExp(culture.title) })).toBeVisible();
    } else {
      await expect(page.getByRole('heading', { name: entry.route === '/sports' ? sport.title : entry.route === '/pharmacies' ? 'Farmacia QA' : culture.title, exact: true }).first()).toBeVisible();
    }
  });
}

test('detalle cultural: datos opcionales ausentes, fecha sin hora e imagen fallida', async ({ page }) => {
  await page.route('**/rest/v1/events?**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({
    ...culture, start_at: '2026-10-12', end_at: null, lat: null, lng: null, address: null, venue_name: null,
    image_url: 'https://example.org/qa-missing.jpg', price_info: null, ticket_url: null, url: null,
  }) }));
  await page.route('https://example.org/qa-missing.jpg', route => route.fulfill({ status: 404, body: '' }));
  await page.goto(`/events/${cultureId}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(culture.title);
  await expect(page.getByText(/Hora por confirmar/)).toBeVisible();
  await expect(page.locator('a[target="_blank"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Añadir al calendario', exact: true }).last()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ver en el mapa', exact: true })).toBeVisible();
});

for (const entry of [
  { route: '/events', table: 'events', empty: /No hay eventos con estos filtros/ },
  { route: '/sports', table: 'sports_events', empty: /No encontramos actividades con estos filtros/ },
  { route: '/calendar', table: 'events', empty: /No hay eventos este día/ },
  { route: '/pharmacies', table: 'pharmacies_guard', empty: /Todavía no tenemos información actualizada/ },
  { route: '/map', table: 'events', empty: /No hay puntos con coordenadas para hoy/ },
]) {
  test(`${entry.route}: vacío legítimo no se muestra como fallo de consulta`, async ({ page }) => {
    await page.route(`**/rest/v1/${entry.table}?**`, route => route.fulfill({ contentType: 'application/json', body: '[]' }));
    await page.goto(entry.route);
    if (entry.route === '/map') await page.getByRole('button', { name: 'Lista', exact: true }).click();
    await expect(page.getByText(entry.empty).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Error al cargar', exact: true })).toHaveCount(0);
    await expect(page.getByText('No hemos podido cargar los puntos del mapa.', { exact: true })).toHaveCount(0);
  });
}

test('deporte: ubicación, entradas, precio y hora opcionales sin datos inventados', async ({ page }) => {
  await page.route('**/rest/v1/sports_events?**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({
    ...sport, start_datetime: '2026-10-12', end_datetime: null, venue_name: null, city: null,
    address: null, tickets_url: null, registration_url: null, canonical_url: null, price_info: null,
    source_name: null, source_url: null,
  }) }));
  await page.goto(`/sports/${sportId}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(sport.title);
  await expect(page.getByText('Hora por confirmar', { exact: true })).toBeVisible();
  await expect(page.getByText('Recinto por confirmar', { exact: true })).toBeVisible();
  await expect(page.getByText('Fuente sin acreditar', { exact: true })).toBeVisible();
  await expect(page.locator('a[target="_blank"]')).toHaveCount(0);
  await expect(page.locator('a[href="/map"]')).toBeVisible();
});

test('mapa: fallo de deportes no bloquea eventos culturales', async ({ page }) => {
  await failTable(page, 'sports_events');
  await page.goto('/map?kind=event');
  await page.getByRole('button', { name: 'Lista', exact: true }).click();
  await expect(page.getByRole('complementary').getByRole('button', { name: new RegExp(culture.title) })).toBeVisible();
  await expect(page.getByText('No hemos podido cargar los puntos del mapa.', { exact: true })).toHaveCount(0);
});

test('mapa: vista del mapa distingue error de ausencia de puntos', async ({ page }) => {
  const recover = await failTable(page, 'events');
  await page.goto('/map');
  await expect(page.getByRole('alert').filter({ hasText: 'No hemos podido cargar los puntos del mapa.' })).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Hoy no hay puntos en el mapa', { exact: true })).toHaveCount(0);
  recover();
  await page.getByRole('alert').getByRole('button', { name: 'Reintentar', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

for (const entry of [
  { route: `/events/${cultureId}`, table: 'events', title: culture.title },
  { route: `/sports/${sportId}`, table: 'sports_events', title: sport.title },
]) {
  test(`${entry.route}: caída de consulta no se confunde con detalle inexistente`, async ({ page }) => {
    const recover = await failTable(page, entry.table);
    await page.goto(entry.route);
    const retry = page.getByRole('button', { name: 'Reintentar', exact: true });
    await expect(retry).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: /No encontrado|No encontramos esta actividad deportiva/ })).toHaveCount(0);
    recover();
    await retry.click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(entry.title);
  });
}

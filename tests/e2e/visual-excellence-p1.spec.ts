import { test, expect, culture, cultureId } from './fixtures/app';

const languages = [
  { code: 'es', unknown: 'Hora por confirmar', close: 'Cerrar', filters: 'Filtros', list: 'Lista' },
  { code: 'en', unknown: 'Time to be confirmed', close: 'Close', filters: 'Filters', list: 'List' },
  { code: 'de', unknown: 'Uhrzeit folgt', close: 'Schließen', filters: 'Filter', list: 'Liste' },
  { code: 'ar', unknown: 'الوقت قيد التأكيد', close: 'إغلاق', filters: 'الفلاتر', list: 'القائمة' },
];
for (const language of languages) {
  test.describe(language.code, () => {
    test.use({ language: language.code });
    test('fecha sin hora: tarjeta, destacado, detalle, mapa y calendario coherentes', async ({ page }) => {
      const event = { ...culture, start_at: '2026-10-13T00:00:00Z', end_at: null };
      await page.route('**/rest/v1/events?**', route => {
        const single = new URL(route.request().url()).searchParams.get('id')?.startsWith('eq.');
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify(single ? event : [event]), headers: { 'content-range': '0-0/1' } });
      });
      await page.goto('/');
      await expect(page.getByRole('region', { name: culture.title, exact: true })).toContainText(language.unknown);
      await page.goto('/events');
      await expect(page.getByRole('link').filter({ has: page.getByRole('heading', { name: culture.title, exact: true }) }).last()).toContainText(language.unknown);
      await page.goto(`/events/${cultureId}`);
      await expect(page.getByRole('main')).toContainText(language.unknown);
      await page.goto('/map?kind=events');
      await page.getByRole('button', { name: language.list, exact: true }).click();
      await expect(page.getByRole('complementary')).toContainText(language.unknown);
      await page.getByRole('complementary').getByRole('button').filter({ hasText: culture.title }).click();
      const preview = page.getByRole('dialog').or(page.getByRole('complementary'));
      await expect(preview).toContainText(language.unknown);
      await expect(preview).not.toContainText(/0[012]:00/);
      await page.goto('/calendar');
      await page.getByRole('button', { name: /13/ }).filter({ hasText: '13' }).click();
      await expect(page.getByRole('link').filter({ has: page.getByRole('heading', { name: culture.title, exact: true }) }).first()).toContainText(language.unknown);
    });
  });
}

test('filtros: apertura por teclado, contención, cierre y retorno al trigger', async ({ page }) => {
  await page.goto('/events');
  const trigger = page.getByRole('button', { name: 'Filtros', exact: true });
  await trigger.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Filtros', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Cerrar', exact: true })).toBeFocused();
  for (let index = 0; index < 36; index++) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await dialog.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test.describe('RTL', () => {
  test.use({ language: 'ar' });
  test('selector de modo y navegación siguen el orden árabe', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    const events = page.getByRole('button', { name: 'الفعاليات', exact: true }).filter({ hasNot: page.locator('.bottom-nav-label') });
    await expect(events).toHaveAttribute('aria-pressed', 'true');
    const profile = page.getByRole('navigation').getByRole('button', { name: 'الملف الشخصي', exact: true });
    await expect(profile).toBeVisible();
    expect(await profile.locator('.bottom-nav-label').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    const rect = await events.boundingBox();
    const surface = await events.locator('..').locator('span[aria-hidden="true"]').boundingBox();
    expect(rect).not.toBeNull();
    expect(surface).not.toBeNull();
    expect(Math.abs(rect!.x - surface!.x)).toBeLessThan(8);
    await profile.click();
    await expect(page).toHaveURL(/\/profile$/);
  });
});

test('el aviso de ubicación no bloquea la navegación inferior', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
      getCurrentPosition(_success: PositionCallback, error: PositionErrorCallback) {
        error({ code: 2 } as GeolocationPositionError);
      },
    } });
  });
  await page.goto('/events');
  await page.getByRole('button', { name: 'Cerca de mí', exact: true }).click();
  await expect(page.getByText('No pudimos obtener tu ubicación', { exact: true })).toBeVisible();
  const profile = page.getByRole('navigation').getByRole('button', { name: 'Perfil', exact: true });
  expect(await profile.evaluate(el => {
    const rect = el.getBoundingClientRect();
    return el.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
  })).toBe(true);
  await profile.click();
  await expect(page).toHaveURL(/\/profile$/);
});

test('filtros: cierre y foco no dependen de finalizar la animación', async ({ page }) => {
  // Replay the CI state: Radix is closed but the native exit animation cannot finish.
  await page.goto('/events');
  await page.addStyleTag({ content: '[data-vaul-drawer][data-state="closed"], [data-vaul-overlay][data-state="closed"] { animation-play-state: paused !important; }' });
  const trigger = page.getByRole('button', { name: 'Filtros', exact: true });
  for (const action of ['escape', 'close', 'apply']) {
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Filtros', exact: true });
    await expect(dialog).toBeVisible();
    if (action === 'escape') await page.keyboard.press('Escape');
    if (action === 'close') await dialog.getByRole('button', { name: 'Cerrar', exact: true }).click();
    if (action === 'apply') await dialog.getByRole('button', { name: 'Mostrar todo', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    expect(await trigger.evaluate(el => {
      const rect = el.getBoundingClientRect();
      return el.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
    })).toBe(true);
  }
});

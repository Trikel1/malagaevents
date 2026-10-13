import { test, expect, culture } from './fixtures/app';

for (const route of ['/', '/profile']) {
  test(`idioma: un indicador visible en ${route}`, async ({ page }) => {
    await page.goto(route);
    await page.getByRole('combobox', { name: 'Idioma', exact: true }).click();
    const selected = page.getByRole('option', { selected: true });
    await expect(selected).toHaveCount(1);
    await expect(selected.locator('svg')).toHaveCount(1);
    await page.keyboard.press('Escape');
  });
}

test('inicio: farmacias visible y accesible desde la primera pantalla', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto('/');
  const shortcuts = page.getByRole('region', { name: 'Accesos rápidos', exact: true });
  const pharmacies = shortcuts.getByRole('button', { name: 'Farmacias', exact: true });
  await expect(shortcuts.getByRole('button')).toHaveCount(6);
  await expect.poll(() => pharmacies.evaluate(el => el.getBoundingClientRect().bottom <= innerHeight)).toBe(true);
  await pharmacies.click();
  await expect(page).toHaveURL(/\/pharmacies$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('inicio: marcos idénticos para cartel fallido y ausente', async ({ page }) => {
  await page.route('**/rest/v1/events?**', route => route.fulfill({
    contentType: 'application/json', body: JSON.stringify([{ ...culture, image_url: 'https://example.org/broken-poster.jpg' }]),
  }));
  await page.route('https://example.org/broken-poster.jpg', route => route.abort());
  await page.goto('/');
  const frame = page.locator('.home-featured .home-event-image');
  await expect(frame).toHaveAttribute('data-failed', 'true');
  await expect(frame.getByRole('img', { name: /ilustrativa/ })).toBeVisible();
  const failed = await frame.boundingBox();
  await page.route('**/rest/v1/events?**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify([culture]) }));
  await page.reload();
  await expect(frame.getByRole('img', { name: /ilustrativa/ })).toBeVisible();
  const missing = await frame.boundingBox();
  expect(Math.abs(failed!.width - missing!.width)).toBeLessThan(1);
  expect(Math.abs(failed!.height - missing!.height)).toBeLessThan(1);
  expect(Math.abs(missing!.width / missing!.height - 1.6)).toBeLessThan(0.02);
});

test('agenda: separador estable al desplazarse', async ({ page }) => {
  await page.route('**/rest/v1/events?**', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify(Array.from({ length: 12 }, (_, index) => ({ ...culture, id: `11111111-1111-4111-8111-${String(index + 1).padStart(12, '0')}` }))),
  }));
  await page.goto('/events');
  await expect.poll(() => page.locator('.liquid-page-shell').evaluate(el => getComputedStyle(el).transform)).toBe('none');
  const header = page.getByRole('banner');
  for (const delta of [400, -300, 600]) {
    await page.evaluate(delta => window.scrollBy({ top: delta, behavior: 'instant' }), delta);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
    await expect.poll(() => header.evaluate(el => ({
      top: Math.round(el.getBoundingClientRect().top),
      shadow: getComputedStyle(el).boxShadow,
      blur: getComputedStyle(el).getPropertyValue('backdrop-filter') || getComputedStyle(el).getPropertyValue('-webkit-backdrop-filter') || 'none',
      borderTop: parseFloat(getComputedStyle(el).borderTopWidth),
    }))).toEqual({ top: 0, shadow: 'none', blur: 'none', borderTop: 0 });
  }
});

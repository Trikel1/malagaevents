import { test, expect, type Page } from '@playwright/test';
import { test as fixtureTest, culture, sport } from './fixtures/app';

test.use({ trace: 'retain-on-failure' });

async function expectHealthyImages(page: Page) {
  await expect(page.getByRole('main')).toBeVisible();

  // Check off-screen lazy images too. Re-query after an error so the actual
  // replacement image must also finish loading; pending images cannot pass.
  await expect.poll(async () => page.locator('img').evaluateAll(elements => {
    const images = elements as HTMLImageElement[];
    for (const image of images) image.loading = 'eager';
    const pendingImages = images
      .filter(image => !image.complete || image.naturalWidth === 0)
      .map(image => ({
        src: image.currentSrc || image.src,
        alt: image.alt,
        complete: image.complete,
        naturalWidth: image.naturalWidth,
      }));
    const loadingSkeletons = document.querySelectorAll('main .animate-pulse').length;
    return { loadingSkeletons, pendingImages };
  }), { message: 'Todas las imágenes deben cargar o mostrar un fallback válido' })
    .toEqual({ loadingSkeletons: 0, pendingImages: [] });
}

const routes = ['/', '/events', '/map', '/pharmacies', '/sports'];

for (const route of routes) {
  test(`${route} no contiene imágenes rotas`, async ({ page }) => {
    await page.goto(route);
    await expectHealthyImages(page);
  });
}

// The same providers found in the CI artifact, with controlled failures.
// Keep the live-data checks above and also prove the real components recover.
for (const scenario of [
  { route: '/', table: 'events', image: 'https://teatroestepona.com/wp-content/uploads/2025/03/santi-rodriguez.jpg', transportFailure: true },
  { route: '/events', table: 'events', image: 'https://www.teatrocervantes.com/public/images/content/espectaculos/512/ccb62aab7557dcbc5cad84a748a57339.jpg' },
  { route: '/sports', table: 'sports_events', image: 'https://static.acb.com/img/www/clubes2026/202526UnicajaLogo.png' },
]) {
  fixtureTest(`${scenario.route}: imagen remota fallida muestra fallback cargado`, async ({ page }) => {
    const event = { ...(scenario.table === 'events' ? culture : sport), image_url: scenario.image };
    await page.route(`**/rest/v1/${scenario.table}?**`, route => route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([event]),
      headers: { 'content-range': '0-0/1' },
    }));
    let failures = 0;
    await page.route(scenario.image, route => {
      failures++;
      return scenario.transportFailure ? route.abort('failed') : route.fulfill({ status: 403, body: '' });
    });
    await page.goto(scenario.route);
    await expect(page.getByRole('img', { name: /ilustrativa/ }).first()).toBeVisible();
    await expectHealthyImages(page);
    expect(failures).toBeGreaterThan(0);
    await expect(page.locator(`img[src="${scenario.image}"]`)).toHaveCount(0);
  });
}

import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { test as fixtureTest, culture, sport } from './fixtures/app';

test.use({ trace: 'retain-on-failure' });

const imageBudgetMs = 10_000;
const poster = 'https://example.org/qa-poster.jpg';
const posterBytes = readFileSync('src/assets/categories/musica.jpg');

async function expectHealthyImages(page: Page, timeout?: number) {
  await expect(page.getByRole('main')).toBeVisible();

  // Check off-screen lazy images too. Re-query after an error so the actual
  // replacement image must also finish loading; pending images cannot pass.
  await expect.poll(async () => {
    if (timeout) {
      for (const image of await page.locator('img').elementHandles()) {
        if (await image.evaluate(el => el.isConnected)) await image.scrollIntoViewIfNeeded();
      }
    }
    return page.locator('img').evaluateAll(elements => {
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
    });
  }, { message: 'Todas las imágenes deben cargar o mostrar un fallback válido', ...(timeout ? { timeout } : {}) })
    .toEqual({ loadingSkeletons: 0, pendingImages: [] });
}

const routes = ['/', '/events', '/map', '/pharmacies', '/sports'];

for (const route of routes) {
  test(`${route} no contiene imágenes rotas`, async ({ page }) => {
    const network: Array<{ url: string; status?: number; failure?: string }> = [];
    page.on('response', response => {
      if (response.request().resourceType() === 'image') network.push({ url: response.url(), status: response.status() });
    });
    page.on('requestfailed', request => {
      if (request.resourceType() === 'image') network.push({ url: request.url(), failure: request.failure()?.errorText });
    });
    await page.goto(route);
    await expect(page.getByRole('main')).toBeVisible();
    // The checker visits lazy posters as they appear, starting their real budget.
    // Network smoke uses the production deadline + the normal 5s assertion
    // budget for replacement/decode. Controlled checks below keep default waits.
    await expectHealthyImages(page, imageBudgetMs + 5_000);
    await test.info().attach('real-image-network', { body: JSON.stringify(network, null, 2), contentType: 'application/json' });
  });
}

for (const path of routes) {
  fixtureTest(`${path}: imagen controlada carga y se decodifica`, async ({ page }) => {
    for (const [table, event] of [['events', culture], ['sports_events', sport]] as const) {
      await page.route(`**/rest/v1/${table}?**`, route => route.fulfill({ contentType: 'application/json', body: JSON.stringify([{ ...event, image_url: poster }]) }));
    }
    let requests = 0;
    await page.route(poster, route => { requests++; return route.fulfill({ contentType: 'image/jpeg', body: posterBytes }); });
    await page.goto(path);
    if (path === '/' || path === '/events' || path === '/sports') {
      await expect(page.locator(`img[src="${poster}"]`).first()).toBeVisible();
    }
    await expectHealthyImages(page);
    if (path === '/' || path === '/events' || path === '/sports') expect(requests).toBeGreaterThan(0);
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


for (const path of ['/', '/events']) {
  fixtureTest(`${path}: petición pendiente termina en fallback y no revive al llegar tarde`, async ({ page }) => {
    await page.clock.install({ time: new Date('2026-10-12T08:00:00Z') });
    await page.route('**/rest/v1/events?**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify([{ ...culture, image_url: poster }]) }));
    let release!: () => void;
    let finish!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const finished = new Promise<void>(resolve => { finish = resolve; });
    await page.route(poster, async route => {
      await gate;
      try { await route.fulfill({ contentType: 'image/jpeg', body: posterBytes }); }
      finally { finish(); }
    });
    const requested = page.waitForRequest(poster);
    try {
      // A deliberately held image request must not block the navigation's load event.
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await requested;
      await page.locator(`img[src="${poster}"]`).first().scrollIntoViewIfNeeded();
      await page.clock.runFor(imageBudgetMs + 1);
      await expect(page.locator(`img[src="${poster}"]`)).toHaveCount(0);
      await expectHealthyImages(page);
      if (path === '/') await expect(page.locator('.home-featured .home-event-image')).toHaveAttribute('data-failed', 'true');
      release();
      await finished;
      await expect(page.locator(`img[src="${poster}"]`)).toHaveCount(0);
      await expectHealthyImages(page);
    } finally { release(); }
  });
}

fixtureTest('el checker rechaza un fallback local realmente roto', async ({ page }) => {
  await page.route('**/rest/v1/events?**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify([{ ...culture, image_url: poster }]) }));
  await page.route(poster, route => route.abort('failed'));
  await page.route('**/src/assets/categories/general.jpg', route => route.abort('failed'));
  await page.goto('/');
  await expect(page.locator('.home-image-fallback img')).toBeVisible();
  await expect(expectHealthyImages(page)).rejects.toThrow('Todas las imágenes deben cargar o mostrar un fallback válido');
});

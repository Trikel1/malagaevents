import { test, expect } from '@playwright/test';

const routes = [
  '/',
  '/events',
  '/map',
  '/pharmacies',
  '/sports',
];

for (const route of routes) {
  test(`${route} no contiene imágenes rotas`, async ({ page }) => {
    await page.goto(route);

    // Fuerza la carga de imágenes lazy
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });

    await page.waitForTimeout(1000);

    const brokenImages = await page.locator('img').evaluateAll((images) =>
      images
        .filter((img) => {
          const el = img as HTMLImageElement;
          return el.complete && el.naturalWidth === 0;
        })
        .map((img) => ({
          src: (img as HTMLImageElement).src,
          alt: (img as HTMLImageElement).alt,
        }))
    );

    expect(
      brokenImages,
      `Imágenes rotas encontradas:\n${JSON.stringify(brokenImages, null, 2)}`
    ).toEqual([]);
  });
}

import { test, expect } from '@playwright/test';

const routes = [
  { name: 'home', path: '/' },
  { name: 'events', path: '/events' },
  { name: 'map', path: '/map' },
  { name: 'pharmacies', path: '/pharmacies' },
  { name: 'sports', path: '/sports' },
];

for (const route of routes) {
  test(`${route.name} sin overflow horizontal`, async ({ page }, testInfo) => {
    await page.goto(route.path);

    await expect(page.locator('body')).toBeVisible();

    const overflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });

    expect(overflow).toBe(false);

    await page.screenshot({
      path: `tests/e2e/screenshots/${route.name}-${testInfo.project.name}.png`,
      fullPage: true,
    });
  });
}

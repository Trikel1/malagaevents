import { test, expect } from '@playwright/test';

const routes = [
  { name: 'home', path: '/' },
  { name: 'events', path: '/events' },
  { name: 'map', path: '/map' },
  { name: 'pharmacies', path: '/pharmacies' },
  { name: 'sports', path: '/sports' },
];

for (const route of routes) {
  test(`${route.name} sin overflow horizontal`, async ({ page }) => {
    await page.goto(route.path);

    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth
    );

    expect(overflow).toBe(false);
  });
}

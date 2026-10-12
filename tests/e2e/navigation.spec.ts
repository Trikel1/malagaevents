import { test, expect } from '@playwright/test';

const routes = [
  '/',
  '/events',
  '/map',
  '/pharmacies',
  '/sports',
];

for (const route of routes) {
  test(`${route} carga correctamente`, async ({ page }) => {
    const errors: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    page.on('pageerror', error => {
      errors.push(error.message);
    });

    await page.goto(route);

    await expect(page.locator('body')).toBeVisible();

    expect(errors).toEqual([]);
  });
}

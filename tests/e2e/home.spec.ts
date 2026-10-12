import { test, expect } from '@playwright/test';

test('Málaga Connect carga sin errores graves', async ({ page }) => {
  const errors: string[] = [];

  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  page.on('pageerror', error => {
    errors.push(error.message);
  });

  await page.goto('/');
  await expect(page.locator('body')).toBeVisible();

  expect(errors).toEqual([]);
});

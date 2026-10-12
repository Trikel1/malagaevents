import { test, expect } from '@playwright/test';

test('Málaga Connect carga sin errores graves', async ({ page }, testInfo) => {
  const consoleErrors: string[] = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('pageerror', error => {
    consoleErrors.push(error.message);
  });

  await page.goto('/');

  await expect(page.locator('body')).toBeVisible();

  await page.screenshot({
    path: `tests/e2e/home-${testInfo.project.name}.png`,
    fullPage: true,
  });

  expect(consoleErrors).toEqual([]);
});

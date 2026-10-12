import { test, expect } from '@playwright/test';

// Exercise navigation with the app's supported reduced-motion preference.
// Keep normal pointer clicks and actionability checks in WebKit/Linux CI.
test.use({ reducedMotion: 'reduce', trace: 'retain-on-failure' });

test('BottomNav permite navegar realmente', async ({ page }) => {
  await page.goto('/');

  const nav = page.locator('nav').filter({
    has: page.locator('button')
  }).first();

  await expect(nav).toBeVisible();

  const buttons = nav.locator('button');

  await expect(buttons).toHaveCount(5);

  // Segundo botón = Eventos según BottomNav
  await buttons.nth(1).click();
  await expect(page).toHaveURL(/\/events$/);

  await page.goto('/');

  // En modo normal el cuarto botón = Mapa.
  const freshNav = page.locator('nav').filter({
    has: page.locator('button')
  }).first();

  await freshNav.locator('button').nth(3).click();

  // El modo deportes puede sustituir Mapa por Venues.
  await expect(page).toHaveURL(/\/(map|venues)$/);
});

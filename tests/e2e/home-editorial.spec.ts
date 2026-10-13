import { test, expect, culture } from './fixtures/app';

const sizes = [
  { width: 360, height: 800 }, { width: 390, height: 844 },
  { width: 430, height: 932 }, { width: 768, height: 1024 },
  { width: 1280, height: 800 }, { width: 1440, height: 900 },
];

for (const language of ['es', 'en', 'de', 'ar']) {
  test.describe(language, () => {
    test.use({ language, reducedMotion: 'reduce' });
    for (const theme of ['light', 'dark']) {
      test(`Home ${theme}: paleta compartida, navegación original y contenido legible`, async ({ page }) => {
        await page.addInitScript(theme => localStorage.setItem('app-theme', theme), theme);
        await page.goto('/');
        await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /light/);
        await expect(page.locator('#featured-event-title')).toHaveText(culture.title);
        const header = page.locator('header');
        await expect(header.locator('button[aria-pressed]')).toHaveCount(2);
        await expect(page.locator('.home-services button[aria-pressed]')).toHaveCount(0);
        await expect(page.locator('.home-personalization .home-section-header button')).toHaveCount(1);
        await expect(page.locator('.home-event-card').filter({ has: page.getByRole('heading', { name: culture.title, exact: true }) })).toHaveCount(0);
        for (const size of sizes) {
          await page.setViewportSize(size);
          const state = await page.evaluate(() => {
            const scope = document.querySelector('[data-route="home"]')!;
            const nav = document.querySelector('nav.bottom-nav-dock')!;
            const mode = document.querySelector('header button[aria-pressed]')!;
            const rootStyle = getComputedStyle(document.documentElement), homeStyle = getComputedStyle(scope);
            const palette = ['--background', '--foreground', '--primary', '--accent', '--secondary', '--card', '--muted-foreground', '--border'];
            const nr = nav.getBoundingClientRect(), mr = mode.getBoundingClientRect();
            return {
              overflow: document.documentElement.scrollWidth > innerWidth,
              paletteInherited: palette.every(key => homeStyle.getPropertyValue(key).trim() === rootStyle.getPropertyValue(key).trim()),
              navTop: nr.top, navBottom: nr.bottom, modeTop: mr.top, modeHeight: mr.height,
              h1Size: parseFloat(getComputedStyle(document.querySelector('h1')!).fontSize),
              metadataSize: parseFloat(getComputedStyle(document.querySelector('.home-event-meta')!).fontSize),
              shortcuts: [...document.querySelectorAll('.home-intent')].map(el => ({ height: el.getBoundingClientRect().height, wraps: el.scrollWidth <= el.clientWidth })),
              dir: document.documentElement.dir,
            };
          });
          expect(state.overflow).toBe(false);
          expect(state.paletteInherited).toBe(true);
          expect(state.navTop).toBeGreaterThan(size.height / 2);
          expect(state.navBottom).toBeLessThanOrEqual(size.height);
          expect(state.modeTop).toBeLessThan(100);
          expect(state.modeHeight).toBeGreaterThanOrEqual(44);
          expect(state.h1Size).toBeGreaterThanOrEqual(32);
          expect(state.metadataSize).toBeGreaterThanOrEqual(14);
          expect(state.shortcuts).toHaveLength(4);
          for (const shortcut of state.shortcuts) { expect(shortcut.height).toBeGreaterThanOrEqual(44); expect(shortcut.wraps).toBe(true); }
          expect(state.dir).toBe(language === 'ar' ? 'rtl' : 'ltr');
        }
        await page.locator('.home-featured-link').click();
        await expect(page).toHaveURL(new RegExp(`/events/${culture.id}$`));
      });
    }
  });
}

test('Home: cartel vertical completo y fallo de imagen sin inventar precio u hora', async ({ page }) => {
  const portrait = { ...culture, image_url: 'https://example.org/home-portrait.svg', is_free: false, start_at: '2026-10-13T00:00:00Z' };
  await page.route('**/rest/v1/events?**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify([portrait]) }));
  await page.route(portrait.image_url, route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="400"><rect width="200" height="400" fill="navy"/></svg>' }));
  await page.goto('/');
  const featured = page.locator('.home-featured');
  await expect(featured.locator('.home-event-image')).toHaveAttribute('data-portrait', 'true');
  await expect(featured.getByRole('img')).toHaveCSS('object-fit', 'contain');
  await expect(featured.locator('time')).toContainText('Hora por confirmar');
  await expect(featured.locator('.home-price')).toHaveText('Precio sin confirmar');
  await page.route(portrait.image_url, route => route.abort());
  await page.reload();
  await expect(featured.locator('.home-event-image')).toHaveAttribute('data-failed', 'true');
  await expect(featured.locator('.home-image-fallback')).toBeVisible();
  await expect(featured.locator('.home-price')).toHaveText('Precio sin confirmar');
});

test('Home: error de destacado recuperable y vacío legítimo', async ({ page }) => {
  await page.route('**/rest/v1/events?**', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'QA outage' }) }));
  await page.goto('/');
  const alert = page.getByRole('alert').filter({ has: page.getByRole('heading', { name: 'No hemos podido cargar el plan destacado', exact: true }) });
  await expect(alert).toBeVisible();
  await page.route('**/rest/v1/events?**', route => route.fulfill({ contentType: 'application/json', body: '[]' }));
  await alert.getByRole('button', { name: 'Reintentar', exact: true }).click();
  await expect(page.locator('.home-featured')).toHaveCount(0);
  await expect(page.locator('#home-upcoming-title')).toBeVisible();
  await expect(page.locator('.home-notice[role="alert"]')).toHaveCount(0);
});

test('Home: búsqueda por teclado conserva foco y parámetros', async ({ page }) => {
  await page.goto('/');
  const toggle = page.locator('header').getByRole('button', { name: 'Buscar planes y eventos', exact: true });
  await toggle.focus();
  await page.keyboard.press('Enter');
  const search = page.getByRole('searchbox', { name: 'Buscar planes y eventos', exact: true });
  await expect(search).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('Enter');
  await search.fill('Teatro Málaga');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/events\?q=Teatro%20M%C3%A1laga$/);
});

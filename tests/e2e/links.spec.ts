import { test, expect } from '@playwright/test';

const routes = [
  '/',
  '/events',
  '/map',
  '/pharmacies',
  '/sports',
];

for (const route of routes) {
  test(`${route} no contiene enlaces inválidos`, async ({ page }) => {
    await page.goto(route);

    const invalidLinks = await page.locator('a').evaluateAll(links =>
      links
        .map(link => ({
          text: (link.textContent || '').trim(),
          href: link.getAttribute('href'),
        }))
        .filter(({ href }) =>
          href === null ||
          href.trim() === '' ||
          href.trim() === '#' ||
          href.toLowerCase().startsWith('javascript:')
        )
    );

    expect(invalidLinks).toEqual([]);
  });
}

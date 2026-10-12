#!/bin/bash

set -e

echo "======================================"
echo " Málaga Connect — Local QA Setup"
echo "======================================"
echo

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "→ Comprobando Playwright..."
if ! npm list @playwright/test >/dev/null 2>&1; then
  npm install -D @playwright/test
fi

echo "→ Comprobando navegadores Playwright..."
npx playwright install >/dev/null

echo "→ Creando directorios..."
mkdir -p tests/e2e/screenshots

echo "→ Limpiando artefactos anteriores..."
rm -rf test-results playwright-report

echo "→ Configurando Playwright..."

cat > playwright.config.ts <<'PWEOF'
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,

  use: {
    baseURL: 'http://127.0.0.1:8080',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'iphone',
      use: { ...devices['iPhone 15'] },
    },
    {
      name: 'ipad',
      use: { ...devices['iPad Pro 11'] },
    },
  ],
});
PWEOF

echo "→ Creando test de carga..."

cat > tests/e2e/home.spec.ts <<'PWEOF'
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
PWEOF

echo "→ Creando tests de navegación..."

cat > tests/e2e/navigation.spec.ts <<'PWEOF'
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
PWEOF

echo "→ Creando tests responsive..."

cat > tests/e2e/visual.spec.ts <<'PWEOF'
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
PWEOF

echo "→ Creando detector de imágenes rotas..."

cat > tests/e2e/images.spec.ts <<'PWEOF'
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

    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });

    await page.waitForTimeout(1000);

    const brokenImages = await page.locator('img').evaluateAll(images =>
      images
        .filter(img => {
          const el = img as HTMLImageElement;
          return el.complete && el.naturalWidth === 0;
        })
        .map(img => ({
          src: (img as HTMLImageElement).src,
          alt: (img as HTMLImageElement).alt,
        }))
    );

    expect(
      brokenImages,
      `Imágenes rotas:\n${JSON.stringify(brokenImages, null, 2)}`
    ).toEqual([]);
  });
}
PWEOF

echo "→ Creando detector de enlaces inválidos..."

cat > tests/e2e/links.spec.ts <<'PWEOF'
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
PWEOF

echo "→ Creando prueba real de BottomNav..."

cat > tests/e2e/user-flow.spec.ts <<'PWEOF'
import { test, expect } from '@playwright/test';

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
PWEOF

echo "→ Configurando scripts npm..."

node <<'NODE'
const fs = require('fs');

const packageFile = 'package.json';
const pkg = JSON.parse(fs.readFileSync(packageFile, 'utf8'));

pkg.scripts ||= {};

pkg.scripts.qa =
  'npm run test && npm run build && npx playwright test';

pkg.scripts['qa:e2e'] =
  'npx playwright test';

pkg.scripts['qa:setup'] =
  'bash scripts/setup-local-qa.sh';

fs.writeFileSync(
  packageFile,
  JSON.stringify(pkg, null, 2) + '\n'
);
NODE

echo "→ Configurando .gitignore..."

touch .gitignore

for entry in \
  "test-results/" \
  "playwright-report/" \
  "tests/e2e/*.png" \
  "tests/e2e/screenshots/"
do
  grep -qxF "$entry" .gitignore || echo "$entry" >> .gitignore
done

echo
echo "======================================"
echo " Setup terminado"
echo "======================================"
echo
echo "Comandos disponibles:"
echo
echo " npm run qa        → QA completo"
echo " npm run qa:e2e    → Solo navegador"
echo " npm run qa:setup  → Reconstruir QA"
echo

import { test, expect, culture, cultureId } from './fixtures/app';

const geoPages = [
  { path: '/map', name: 'Centrar el mapa en mi ubicación', success: /Mi ubicación/, error: /Permiso denegado|No hemos podido obtener tu ubicación/, loading: /Localizando/ },
  { path: '/pharmacies', name: 'Cerca de mí', success: /Quitar orden por distancia/, error: /Permiso de ubicación denegado|No pudimos obtener tu ubicación/, loading: /Localizando/ },
  { path: '/events', name: 'Cerca de mí', success: /Ordenado por cercanía/, error: /Permiso de ubicación denegado|No pudimos obtener tu ubicación/, loading: /Localizando/ },
];
for (const entry of geoPages) {
  test(`${entry.path}: geolocalización concedida por contexto de prueba`, async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 36.72, longitude: -4.42 });
    await page.addInitScript(() => {
      const locate = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
      navigator.geolocation.getCurrentPosition = (success, error, options) => locate(position => { (window as any).__geoGranted = true; success(position); }, error, options);
    });
    await page.goto(entry.path);
    const button = page.getByRole('button', { name: entry.path === '/pharmacies' ? /^(Cerca de mí|Localizando…|Quitar orden por distancia)$/ : entry.name, exact: true });
    await button.click();
    await expect.poll(() => page.evaluate(() => (window as any).__geoGranted)).toBe(true);
    await expect(button).toBeEnabled();
    if (entry.path !== '/map') await expect(button).toHaveAttribute('aria-pressed', 'true');
    else await expect(page.getByRole('status').filter({ hasText: entry.error })).toHaveCount(0);
    await page.getByRole('navigation').getByRole('button', { name: 'Perfil', exact: true }).click();
    await expect(page).toHaveURL(/\/profile$/);
  });

  for (const code of [1, 2]) {
    test(`${entry.path}: ubicación ${code === 1 ? 'denegada' : 'no disponible'}, carga y recuperación`, async ({ page }) => {
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
          getCurrentPosition(success: PositionCallback, error: PositionErrorCallback) {
            (window as any).__geo = { success, error };
          },
        } });
      });
      await page.goto(entry.path);
      const button = page.getByRole('button', { name: entry.path === '/pharmacies' ? /^(Cerca de mí|Localizando…|Quitar orden por distancia)$/ : entry.name, exact: true });
      await button.click();
      await expect(button).toBeDisabled();
      await page.evaluate(code => (window as any).__geo.error({ code, PERMISSION_DENIED: 1 }), code);
      await expect(page.getByText(entry.error).first()).toBeVisible();
      await expect(button).toBeEnabled();
      await button.click();
      await page.evaluate(() => (window as any).__geo.success({ coords: { latitude: 36.72, longitude: -4.42 } }));
      await expect(button).toBeEnabled();
      if (entry.path !== '/map') await expect(button).toHaveAttribute('aria-pressed', 'true');
      else await expect(page.getByRole('status').filter({ hasText: entry.error })).toHaveCount(0);
      await page.getByRole('navigation').getByRole('button', { name: 'Perfil', exact: true }).click();
      await expect(page).toHaveURL(/\/profile$/);
    });
  }
}

for (const scenario of ['available', 'absent', 'cancelled', 'failed', 'clipboard-failed'] as const) {
  test(`compartir: ${scenario}`, async ({ page }) => {
    await page.addInitScript(scenario => {
      (window as any).__shareCalls = [];
      (window as any).__clipboardCalls = [];
      Object.defineProperty(navigator, 'share', { configurable: true, value:
        scenario === 'absent' || scenario === 'clipboard-failed' ? undefined : async (data: ShareData) => {
          (window as any).__shareCalls.push(data);
          if (scenario === 'cancelled') throw new DOMException('Dismissed', 'AbortError');
          if (scenario === 'failed') throw new Error('Controlled share error');
        },
      });
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
        async writeText(text: string) {
          (window as any).__clipboardCalls.push(text);
          if (scenario === 'clipboard-failed') throw new Error('Controlled clipboard error');
        },
      } });
    }, scenario);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`/events/${cultureId}`);
    await page.getByRole('button', { name: 'Compartir', exact: true }).click();
    if (scenario === 'absent' || scenario === 'failed') await expect(page.getByText('Enlace copiado', { exact: true })).toBeVisible();
    if (scenario === 'clipboard-failed') await expect(page.getByText('No se puede compartir desde este navegador.', { exact: true })).toBeVisible();
    const calls = await page.evaluate(() => ({ share: (window as any).__shareCalls, clipboard: (window as any).__clipboardCalls }));
    if (scenario === 'available' || scenario === 'cancelled') {
      expect(calls.share).toEqual([{ title: culture.title, text: culture.description, url: page.url() }]);
      expect(calls.clipboard).toEqual([]);
    } else expect(calls.clipboard).toEqual([page.url()]);
    expect(errors).toEqual([]);
  });
}

test('calendario: teclado, foco del drawer y restauración', async ({ page }) => {
  await page.goto('/calendar');
  const trigger = page.getByRole('button', { name: 'Afina tu agenda', exact: true });
  await trigger.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect.poll(() => dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
  await dialog.getByRole('button', { name: 'Cerrar', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

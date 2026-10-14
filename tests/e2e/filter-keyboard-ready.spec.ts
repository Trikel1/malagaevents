import { test, expect } from './fixtures/app';

test('filtros: Escape funciona antes del listener de captura de la capa modal', async ({ page }) => {
  // Replay the initial mount window: React renders the dialog before the
  // library's capturing Escape listener is ready. Ordinary key events remain.
  await page.addInitScript(() => {
    const add = document.addEventListener.bind(document);
    document.addEventListener = ((type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) => {
      if (type === 'keydown' && (options === true || typeof options === 'object' && options.capture)) return;
      add(type, listener, options);
    }) as typeof document.addEventListener;
  });
  await page.goto('/events');
  const trigger = page.getByRole('button', { name: 'Filtros', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Filtros', exact: true });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(dialog).toBeVisible();
});

test('filtros: Escape cierra el calendario anidado y conserva el panel', async ({ page }) => {
  await page.goto('/events');
  await page.getByRole('button', { name: 'Filtros', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: 'Filtros', exact: true });
  await drawer.getByRole('button', { name: 'Desde', exact: true }).click();
  await expect(page.getByRole('grid')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('grid')).toHaveCount(0);
  await expect(drawer).toBeVisible();
});

import { test, expect, cultureId, sportId } from './fixtures/app';
import { login, mockAuth, userId } from './fixtures/auth';

// All auth traffic is intercepted, including mutations. No production credentials.
test('login, perfil, entradas y logout con sesión sintética', async ({ page }) => {
  const requests = await mockAuth(page);
  await login(page);
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/profile');
  await expect(page.getByText('qa@example.invalid', { exact: true })).toBeVisible();
  await page.locator('a[href="/tickets"]').click();
  await expect(page.locator('a[href="/tickets/add"]')).toBeVisible();
  await page.getByRole('navigation').getByRole('button', { name: 'Perfil', exact: true }).click();
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/profile');
  await expect(page.locator('a[href="/auth?mode=signup"]')).toBeVisible();
  expect(requests.some(r => r.path === 'token')).toBe(true);
  expect(requests.some(r => r.path === 'logout')).toBe(true);
});

test('login rechazado mantiene formulario y permite reintentar', async ({ page }) => {
  const options = { rejectLogin: true };
  await mockAuth(page, options);
  await login(page);
  await expect(page.getByText('Error controlado QA', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/auth$/);
  options.rejectLogin = false;
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('registro: contraseñas distintas avisan sin enviar solicitud', async ({ page }) => {
  const requests = await mockAuth(page);
  await page.goto('/auth?mode=signup');
  await page.getByLabel('Email', { exact: true }).fill('qa@example.invalid');
  await page.getByLabel('Contraseña', { exact: true }).fill('qa-password');
  await page.getByLabel('Confirmar contraseña', { exact: true }).fill('qa-different');
  await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Las contraseñas no coinciden' })).toBeVisible();
  expect(requests.filter(r => r.path === 'signup')).toHaveLength(0);
  await page.getByLabel('Confirmar contraseña', { exact: true }).fill('qa-password');
  await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(requests.filter(r => r.path === 'signup')).toHaveLength(1);
});

test('logout rechazado conserva perfil y permite recuperación', async ({ page }) => {
  const options = { rejectLogout: true };
  await mockAuth(page, options);
  await login(page);
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await expect(page.getByText('Error controlado QA', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByText('qa@example.invalid', { exact: true })).toBeVisible();
  options.rejectLogout = false;
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('favorito autenticado se añade y elimina para el usuario actual', async ({ page }) => {
  await mockAuth(page);
  let saved = false;
  await page.route('**/rest/v1/favorites**', async route => {
    if (route.request().method() === 'POST') {
      expect(route.request().postDataJSON()).toEqual({ user_id: userId, event_id: cultureId });
      saved = true;
    }
    if (route.request().method() === 'DELETE') {
      expect(new URL(route.request().url()).searchParams.get('user_id')).toBe(`eq.${userId}`);
      saved = false;
    }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(saved ? [{ user_id: userId, event_id: cultureId }] : []) });
  });
  await login(page);
  await expect(page).toHaveURL(/\/$/);
  await page.goto(`/events/${cultureId}`);
  await page.getByRole('button', { name: 'Añadir a favoritos', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Quitar de favoritos', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Quitar de favoritos', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Añadir a favoritos', exact: true })).toHaveAttribute('aria-pressed', 'false');
});

for (const path of ['/tickets', '/tickets/add', `/sports/${sportId}`]) {
  test(`anónimo: protección de ${path}`, async ({ page }) => {
    const requests = await mockAuth(page);
    await page.goto(path);
    if (path.startsWith('/sports/')) await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    else await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
    await expect(page).toHaveURL(/\/auth$/);
    expect(requests).toHaveLength(0);
  });
}

test('auth: controles con nombre, teclado y contraseña visible', async ({ page }) => {
  await mockAuth(page);
  await page.goto('/auth');
  await expect(page.getByRole('button', { name: 'Volver', exact: true })).toBeVisible();
  const input = page.getByLabel('Contraseña', { exact: true });
  await input.focus();
  await page.keyboard.press('Tab');
  const show = page.getByRole('button', { name: 'Mostrar contraseña', exact: true });
  await expect(show).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(input).toHaveAttribute('type', 'text');
  const hide = page.getByRole('button', { name: 'Ocultar contraseña', exact: true });
  await expect(hide).toHaveAttribute('aria-pressed', 'true');
  await hide.click();
  await expect(input).toHaveAttribute('type', 'password');
});

test('entradas: error de carga y recuperación con cuenta simulada', async ({ page }) => {
  await mockAuth(page);
  let failed = true;
  await page.route('**/rest/v1/tickets?**', route => failed
    ? route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"Controlled tickets outage"}' })
    : route.fallback());
  await login(page);
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/tickets');
  const retry = page.getByRole('button', { name: 'Reintentar', exact: true });
  await expect(retry).toBeVisible({ timeout: 10000 });
  failed = false;
  await retry.click();
  await expect(retry).toHaveCount(0);
  await expect(page.locator('a[href="/tickets/add"]').first()).toBeVisible();
});

test('entradas: eliminación accesible requiere confirmación', async ({ page }) => {
  await mockAuth(page);
  let deleted = false;
  await page.route('**/rest/v1/tickets?**', async route => {
    if (route.request().method() === 'DELETE') {
      expect(new URL(route.request().url()).searchParams.get('user_id')).toBe(`eq.${userId}`);
      deleted = true;
    }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(deleted ? [] : [{ id: cultureId, user_id: userId, title: 'Entrada QA', file_path: null }]) });
  });
  await login(page);
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/tickets');
  await page.getByRole('button', { name: 'Eliminar: Entrada QA', exact: true }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  expect(deleted).toBe(false);
  await page.getByRole('button', { name: 'Eliminar: Entrada QA', exact: true }).click();
  await dialog.getByRole('button', { name: 'Eliminar', exact: true }).click();
  await expect.poll(() => deleted).toBe(true);
  await expect(page.getByRole('heading', { name: 'No tienes entradas guardadas', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Entrada QA', exact: true })).toHaveCount(0);
});

test('recuperación sin sesión: formulario protegido y controles accesibles', async ({ page }) => {
  await mockAuth(page);
  await page.goto('/auth/reset');
  await expect(page.getByLabel('Nueva contraseña', { exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Actualizar contraseña', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Mostrar contraseña', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Volver', exact: true }).click();
  await expect(page).toHaveURL(/\/auth$/);
});

test('añadir entrada: volver tiene nombre accesible', async ({ page }) => {
  await mockAuth(page);
  await login(page);
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/tickets');
  await page.locator('a[href="/tickets/add"]').first().click();
  await page.getByRole('button', { name: 'Volver', exact: true }).click();
  await expect(page).toHaveURL(/\/tickets$/);
});

test('registro pendiente de confirmación no crea una sesión local', async ({ page }) => {
  await mockAuth(page, { confirmEmail: true });
  await page.goto('/auth?mode=signup');
  await page.getByLabel('Email', { exact: true }).fill('qa@example.invalid');
  await page.getByLabel('Contraseña', { exact: true }).fill('qa-password');
  await page.getByLabel('Confirmar contraseña', { exact: true }).fill('qa-password');
  await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/profile');
  await expect(page.locator('a[href="/auth?mode=signup"]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cerrar sesión', exact: true })).toHaveCount(0);
});

test('solicitar recuperación envía únicamente al endpoint simulado', async ({ page }) => {
  const requests = await mockAuth(page);
  await page.goto('/auth');
  await page.getByLabel('Email', { exact: true }).fill('qa@example.invalid');
  await page.getByRole('button', { name: '¿Olvidaste tu contraseña?', exact: true }).click();
  await expect(page.getByText('Email enviado', { exact: true })).toBeVisible();
  expect(requests.filter(r => r.path === 'recover')).toHaveLength(1);
});

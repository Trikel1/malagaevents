import type { Page } from '@playwright/test';

export const userId = '55555555-5555-4555-8555-555555555555';
export const user = {
  id: userId, aud: 'authenticated', role: 'authenticated', email: 'qa@example.invalid',
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: { display_name: 'Usuario QA' }, created_at: '2026-10-12T08:00:00Z',
};
const payload = Buffer.from(JSON.stringify({ sub: userId, aud: 'authenticated', role: 'authenticated', exp: 2000000000 })).toString('base64url');
// Deliberately unsigned synthetic token. It is only accepted by intercepted endpoints.
const session = { access_token: `eyJhbGciOiJub25lIn0.${payload}.qa`, refresh_token: 'qa-only-refresh', token_type: 'bearer', expires_in: 3600, user };

export async function mockAuth(page: Page, options: { rejectLogin?: boolean; rejectLogout?: boolean; confirmEmail?: boolean } = {}) {
  const requests: { path: string; method: string }[] = [];
  await page.route('**/auth/v1/**', async route => {
    const path = new URL(route.request().url()).pathname.split('/').pop()!;
    requests.push({ path, method: route.request().method() });
    if ((path === 'token' && options.rejectLogin) || (path === 'logout' && options.rejectLogout)) {
      await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: 'qa_error', msg: 'Error controlado QA' }) });
    } else {
      await route.fulfill({ status: path === 'logout' ? 204 : 200, contentType: 'application/json', body: path === 'logout' ? '' : JSON.stringify(path === 'user' || (path === 'signup' && options.confirmEmail) ? user : session) });
    }
  });
  await page.route('**/rest/v1/rpc/has_role', route => route.fulfill({ contentType: 'application/json', body: 'false' }));
  return requests;
}

export async function login(page: Page) {
  await page.goto('/auth');
  await page.getByLabel('Email', { exact: true }).fill(user.email);
  await page.getByLabel('Contraseña', { exact: true }).fill('qa-only-password');
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
}

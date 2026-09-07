import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  authorizeAdminRequest,
  parseStrictDateISO,
  SYNC_KEY_ENV_NAME,
  type AuthorizeDeps,
} from './security.ts';
import { validateSweepRequest, planSweepWrite } from './pharmacySweep.ts';

const REAL_KEY = 'test-sync-key-value-0123456789';

const env: Record<string, string> = {
  [SYNC_KEY_ENV_NAME]: REAL_KEY,
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'anon-key',
};

type ClientBehaviour = {
  user?: { id: string } | null;
  userError?: unknown;
  isAdmin?: boolean | null;
  rpcError?: unknown;
};

function deps(behaviour: ClientBehaviour = {}): AuthorizeDeps {
  return {
    getEnv: (name) => env[name],
    createClient: () => ({
      auth: {
        getUser: () =>
          Promise.resolve({
            data: { user: behaviour.user ?? null },
            error: behaviour.userError ?? null,
          }),
      },
      rpc: () =>
        Promise.resolve({
          data: behaviour.isAdmin ?? false,
          error: behaviour.rpcError ?? null,
        }),
    }),
  };
}

const req = (headers: Record<string, string> = {}) =>
  new Request('https://fn.local/', { method: 'POST', headers });

Deno.test('rejects a request with no credentials at all', async () => {
  const result = await authorizeAdminRequest(req(), deps());
  assertEquals(result.authorized, false);
  assertEquals(result.reason, 'Missing credentials');
});

Deno.test('rejects an anonymous caller presenting only the anon apikey header', async () => {
  const result = await authorizeAdminRequest(req({ apikey: 'anon-key' }), deps());
  assertEquals(result.authorized, false);
});

Deno.test('rejects a wrong shared key', async () => {
  const result = await authorizeAdminRequest(req({ 'x-sync-key': 'wrong-key' }), deps());
  assertEquals(result.authorized, false);
});

Deno.test('rejects a shared key of the right length but wrong content', async () => {
  const wrong = 'x'.repeat(REAL_KEY.length);
  const result = await authorizeAdminRequest(req({ 'x-sync-key': wrong }), deps());
  assertEquals(result.authorized, false);
});

Deno.test('accepts the key stored under the actually configured env name', async () => {
  const result = await authorizeAdminRequest(req({ 'x-sync-key': REAL_KEY }), deps());
  assertEquals(result.authorized, true);
  assertEquals(result.actor, 'cron');
});

Deno.test('does not fall back to a differently named secret', async () => {
  const result = await authorizeAdminRequest(req({ 'x-sync-key': 'legacy-admin-key' }), {
    getEnv: (name) => (name === 'SYNC_ADMIN_KEY' ? 'legacy-admin-key' : env[name]),
    createClient: deps().createClient,
  });
  assertEquals(result.authorized, false);
});

Deno.test('rejects a normal signed-in user without the admin role', async () => {
  const result = await authorizeAdminRequest(
    req({ authorization: 'Bearer user-jwt' }),
    deps({ user: { id: 'user-1' }, isAdmin: false }),
  );
  assertEquals(result.authorized, false);
  assertEquals(result.reason, 'Admin role required');
});

Deno.test('rejects an invalid or expired session', async () => {
  const result = await authorizeAdminRequest(
    req({ authorization: 'Bearer expired' }),
    deps({ user: null, userError: { message: 'jwt expired' } }),
  );
  assertEquals(result.authorized, false);
  assertEquals(result.reason, 'Invalid session');
});

Deno.test('accepts a verified admin (role checked server-side, not from the JWT)', async () => {
  const result = await authorizeAdminRequest(
    req({ authorization: 'Bearer admin-jwt' }),
    deps({ user: { id: 'admin-1' }, isAdmin: true }),
  );
  assertEquals(result.authorized, true);
  assertEquals(result.actor, 'admin');
});

Deno.test('denies when the role check itself fails', async () => {
  const result = await authorizeAdminRequest(
    req({ authorization: 'Bearer admin-jwt' }),
    deps({ user: { id: 'admin-1' }, isAdmin: null, rpcError: { message: 'boom' } }),
  );
  assertEquals(result.authorized, false);
});

Deno.test('denies when the auth backend throws', async () => {
  const result = await authorizeAdminRequest(req({ authorization: 'Bearer x' }), {
    getEnv: (name) => env[name],
    createClient: () => {
      throw new Error('network down');
    },
  });
  assertEquals(result.authorized, false);
  assertEquals(result.reason, 'Authorization check failed');
});

Deno.test('denies when the server is not configured', async () => {
  const result = await authorizeAdminRequest(req({ authorization: 'Bearer x' }), {
    getEnv: () => undefined,
  });
  assertEquals(result.authorized, false);
  assertEquals(result.reason, 'Server not configured');
});

// ---------------------------------------------------------------------------
// Strict date validation
// ---------------------------------------------------------------------------

Deno.test('parseStrictDateISO rejects impossible calendar dates', () => {
  assertEquals(parseStrictDateISO('2026-02-30'), null);
  assertEquals(parseStrictDateISO('2025-02-29'), null);
  assertEquals(parseStrictDateISO('2026-13-01'), null);
  assertEquals(parseStrictDateISO('2026-00-10'), null);
});

Deno.test('parseStrictDateISO rejects junk and non-string input', () => {
  assertEquals(parseStrictDateISO('2026-09-07T10:00:00Z'), null);
  assertEquals(parseStrictDateISO('2026-09-07; DROP TABLE'), null);
  assertEquals(parseStrictDateISO(20260907), null);
  assertEquals(parseStrictDateISO(null), null);
  assertEquals(parseStrictDateISO(undefined), null);
  assertEquals(parseStrictDateISO({}), null);
});

Deno.test('parseStrictDateISO accepts real dates including leap days', () => {
  assertEquals(parseStrictDateISO('2026-09-07'), '2026-09-07');
  assertEquals(parseStrictDateISO('2024-02-29'), '2024-02-29');
});

// ---------------------------------------------------------------------------
// Pharmacy sweep write safety
// ---------------------------------------------------------------------------

Deno.test('dry run performs zero writes', () => {
  const plan = planSweepWrite({ dryRun: true }, { zonesFailed: 0, rowCount: 120 });
  assertEquals(plan, { action: 'no_write', reason: 'dry_run' });
});

Deno.test('partial sweeps are rejected unless they are dry runs', () => {
  assertEquals(validateSweepRequest({ dryRun: false, onlyZoneId: '29' }).ok, false);
  assertEquals(validateSweepRequest({ dryRun: false, zonesLimit: 3 }).ok, false);
  assertEquals(validateSweepRequest({ dryRun: true, zonesLimit: 3 }).ok, true);
  assertEquals(validateSweepRequest({ dryRun: false }).ok, true);
});

Deno.test('zonesLimit must be a positive integer', () => {
  assertEquals(validateSweepRequest({ dryRun: true, zonesLimit: 0.5 }).ok, false);
  assertEquals(validateSweepRequest({ dryRun: true, zonesLimit: -1 }).ok, false);
  assertEquals(validateSweepRequest({ dryRun: true, zonesLimit: Number.NaN }).ok, false);
});

Deno.test('a full sweep with one failed zone preserves existing rows', () => {
  const plan = planSweepWrite({ dryRun: false }, { zonesFailed: 1, rowCount: 90 });
  assertEquals(plan, { action: 'no_write', reason: 'incomplete_sweep_failed_zones' });
});

Deno.test('an empty result never deletes anything', () => {
  const plan = planSweepWrite({ dryRun: false }, { zonesFailed: 0, rowCount: 0 });
  assertEquals(plan, { action: 'no_write', reason: 'no_rows' });
});

Deno.test('a complete successful sweep replaces the day', () => {
  const plan = planSweepWrite({ dryRun: false }, { zonesFailed: 0, rowCount: 117 });
  assertEquals(plan, { action: 'replace_day' });
});

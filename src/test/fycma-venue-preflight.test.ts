import { describe, it, expect, vi } from 'vitest';
import { resolveVenueAlias } from '../../supabase/functions/_shared/ingestion/venues';

// Edge entrypoints import URL/npm specifiers; stub them (no network, no client).
vi.mock('https://esm.sh/@supabase/supabase-js@2.45.4', () => ({ createClient: () => null }));
vi.mock('../../supabase/functions/_shared/security.ts', () => ({ getAllHeaders: () => ({}), corsHeaders: {} }));

// Non-literal paths keep the Deno entrypoints out of the app typecheck.
const SCRAPE = '../../supabase/functions/scrape-source/index';
const PREFLIGHT = '../../supabase/functions/admin-ingest-preflight/index';
type KeyFn = (adapterKey: string, venueName: string | null | undefined) => string | null | undefined;
const scrape = (await import(/* @vite-ignore */ SCRAPE)) as { venueAliasKeyFor: KeyFn };
const preflight = (await import(/* @vite-ignore */ PREFLIGHT)) as {
  venueAliasKeyFor: KeyFn;
  findExisting: (...a: unknown[]) => Promise<{ id: string; matchedBy?: string } | null>;
};

const LONG = 'FYCMA — Palacio de Ferias y Congresos de Málaga';

/** Read-only fake: records filters + any write attempt. */
function fakeDb(tables: Record<string, Array<Record<string, unknown>>>) {
  const calls: Array<{ table: string; filters: Record<string, unknown> }> = [];
  const writes: string[] = [];
  return {
    calls, writes,
    from(table: string) {
      const filters: Record<string, unknown> = {};
      const q = {
        select: () => q,
        eq: (k: string, v: unknown) => { filters[k] = v; return q; },
        gte: () => q, lte: () => q, limit: () => q,
        insert: () => { writes.push(`insert:${table}`); return q; },
        update: () => { writes.push(`update:${table}`); return q; },
        maybeSingle: async () => {
          calls.push({ table, filters: { ...filters } });
          const hit = (tables[table] ?? []).find((r) => Object.entries(filters).every(([k, v]) => r[k] === v));
          return { data: hit ?? null, error: null };
        },
      };
      return q;
    },
  };
}

describe('FYCMA venue alias key', () => {
  it("both functions resolve FYCMA through the exact 'FYCMA' alias", async () => {
    const db = fakeDb({ venue_aliases: [{ alias_normalized: 'fycma', venue_id: 'venue-x', canonical_name: 'FYCMA canónico' }] });
    for (const fn of [scrape.venueAliasKeyFor, preflight.venueAliasKeyFor]) {
      const key = fn('fycma', LONG);
      expect(key).toBe('FYCMA');
      const v = await resolveVenueAlias(db as never, key);
      expect(v).toEqual({ venueId: 'venue-x', canonicalName: 'FYCMA canónico' });
    }
    expect(db.writes).toEqual([]);
  });
  it('other adapters keep their own venue name', () => {
    expect(scrape.venueAliasKeyFor('teatro-cervantes', 'Teatro Cervantes')).toBe('Teatro Cervantes');
    expect(preflight.venueAliasKeyFor('teatro-cervantes', null)).toBeNull();
  });
});

describe('preflight lookup', () => {
  const row = { id: 'evt-1', content_hash: 'h', dedupe_key: 'old', source_id: 'src-f', external_id: '101' };
  const ev = { title: 'Revolver (nueva fecha)', startAt: '2027-01-20T19:00:00.000Z', externalId: '101', locality: 'malaga' };

  it('FYCMA reschedule matches the same UUID by externalId', async () => {
    const db = fakeDb({ events: [row] });
    const r = await preflight.findExisting(db, ev, null, 'new', { adapterKey: 'fycma', sourceId: 'src-f' });
    expect(r?.id).toBe('evt-1');
    expect(r?.matchedBy).toBe('external_id');
    expect(db.writes).toEqual([]);
  });
  it('other adapters keep dedupe_key/legacy lookup only', async () => {
    const db = fakeDb({ events: [row] });
    const r = await preflight.findExisting(db, ev, null, 'new', { adapterKey: 'teatro-cervantes', sourceId: 'src-f' });
    expect(r).toBeNull();
    expect(db.calls.every((c) => !('external_id' in c.filters))).toBe(true);
    expect(db.calls[0].filters).toEqual({ dedupe_key: 'new' });
  });
  it('FYCMA without externalId falls back to dedupe_key', async () => {
    const db = fakeDb({ events: [row] });
    const r = await preflight.findExisting(db, { ...ev, externalId: null }, null, 'old', { adapterKey: 'fycma', sourceId: 'src-f' });
    expect(r?.id).toBe('evt-1');
    expect(r?.matchedBy).toBeUndefined();
  });
});

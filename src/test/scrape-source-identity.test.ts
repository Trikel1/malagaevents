import { describe, it, expect, vi } from 'vitest';

// The edge entrypoint imports the client from a URL; stub it (no network).
vi.mock('https://esm.sh/@supabase/supabase-js@2.45.4', () => ({ createClient: () => null }));
vi.mock('npm:@supabase/supabase-js@2', () => ({ createClient: () => null }));
vi.mock('npm:@supabase/supabase-js@2/cors', () => ({ corsHeaders: {} }));
import {
  findExistingEvent,
  applyResolvedIds,
} from '../../supabase/functions/scrape-source/index';
import { mapCategory } from '../../supabase/functions/_shared/adapters/fycma';

type Row = { id: string; content_hash: string | null; dedupe_key: string | null; source_id?: string; external_id?: string };

/** Minimal in-memory stand-in for the events query builder (eq/gte/lte/limit/maybeSingle). */
function fakeDb(rows: Row[]) {
  const calls: Array<Record<string, unknown>> = [];
  return {
    calls,
    from() {
      const filters: Record<string, unknown> = {};
      const q = {
        select: () => q,
        eq: (k: string, v: unknown) => { filters[k] = v; return q; },
        gte: () => q, lte: () => q, limit: () => q,
        maybeSingle: async () => {
          calls.push({ ...filters });
          const hit = rows.find((r) => Object.entries(filters).every(([k, v]) => (r as Record<string, unknown>)[k] === v));
          return { data: hit ? { id: hit.id, content_hash: hit.content_hash, dedupe_key: hit.dedupe_key } : null };
        },
      };
      return q;
    },
  };
}

const ev = (over: Record<string, unknown> = {}) => ({
  title: 'Revolver', startAt: '2026-12-12T20:00:00.000Z', timezone: 'Europe/Madrid' as const,
  locality: 'malaga', sourceUrl: 'https://fycma.com/evento/revolver/', externalId: '101', ...over,
});

const SRC = 'src-fycma';
const existing: Row = { id: 'evt-uuid-1', content_hash: 'h', dedupe_key: 'old-key', source_id: SRC, external_id: '101' };

describe('scrape-source identity', () => {
  it('FYCMA reschedule with same externalId returns the same event UUID', async () => {
    const db = fakeDb([existing]);
    const moved = ev({ startAt: '2027-01-20T19:00:00.000Z', title: 'Revolver (nueva fecha)' });
    const r = await findExistingEvent(db, moved as never, null, 'new-key', { adapterKey: 'fycma', sourceId: SRC });
    expect(r?.id).toBe('evt-uuid-1');
    expect(db.calls[0]).toEqual({ source_id: SRC, external_id: '101' });
  });

  it('FYCMA lookup is scoped to its own source_id', async () => {
    const db = fakeDb([{ ...existing, source_id: 'other-source' }]);
    const r = await findExistingEvent(db, ev() as never, null, 'new-key', { adapterKey: 'fycma', sourceId: SRC });
    expect(r).toBeNull();
  });

  it('other adapters never use external_id and keep dedupe_key lookup', async () => {
    const db = fakeDb([existing]);
    const r = await findExistingEvent(db, ev() as never, null, 'new-key', { adapterKey: 'ayto-malaga-csv', sourceId: SRC });
    expect(r).toBeNull();
    expect(db.calls.every((c) => !('external_id' in c))).toBe(true);
    expect(db.calls[0]).toEqual({ dedupe_key: 'new-key' });
  });

  it('FYCMA without externalId falls back to dedupe_key', async () => {
    const db = fakeDb([existing]);
    const r = await findExistingEvent(db, ev({ externalId: null }) as never, null, 'old-key', { adapterKey: 'fycma', sourceId: SRC });
    expect(r?.id).toBe('evt-uuid-1');
    expect(db.calls[0]).toEqual({ dedupe_key: 'old-key' });
  });

  it('persists venue_id/location_id only when resolvers returned IDs', () => {
    expect(applyResolvedIds({}, 'venue-1', 'loc-1')).toEqual({ venue_id: 'venue-1', location_id: 'loc-1' });
    expect(applyResolvedIds({}, null, undefined)).toEqual({});
    expect(applyResolvedIds({}, '', 'loc-1')).toEqual({ location_id: 'loc-1' });
  });
});

describe('FYCMA canonical categories restored', () => {
  it('festival → festivals, deporte → sports', () => {
    expect(mapCategory([{ name: 'Festival' }])).toBe('festivals');
    expect(mapCategory([{ name: 'Deporte' }])).toBe('sports');
  });
});

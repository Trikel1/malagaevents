// Verifies the write-authorization gate refuses every path except when all
// six preconditions hold. This is the exact function the deployed Edge
// Function uses (shared module), so this test is a real regression guard.

import { describe, it, expect } from 'vitest';
import {
  authorizeWrite,
  MAX_WRITES_PER_RUN,
} from '../../supabase/functions/_shared/ingestion/write-auth';
import type { EventSourceRow } from '../../supabase/functions/_shared/ingestion/types';

const OK_SOURCE: EventSourceRow = {
  id: 'a0df1863-0442-4e7f-b476-ba2d8fd5c04a',
  slug: 'ayto-malaga-csv',
  name: 'Ayto. Málaga CSV',
  kind: 'csv',
  base_url:
    'https://datosabiertos.malaga.eu/recursos/cultura/agenda/2026.csv',
  adapter_key: 'ayto-malaga-csv',
  locality_slug: 'malaga',
  category_hints: null,
  priority: 1,
  enabled: true,
  schedule_cron: null,
  robots_ok: true,
  notes: null,
  write_confirmed_at: '2026-07-13T09:00:00.000Z',
  write_confirmed_by: 'admin',
};

const ADAPTER_KEY = 'ayto-malaga-csv';

describe('authorizeWrite gate', () => {
  it('refuses when writeEnabled is missing or false (dry-run default)', () => {
    expect(authorizeWrite({}, OK_SOURCE, ADAPTER_KEY)).toEqual({
      ok: false,
      reason: 'writeEnabled_false',
    });
    expect(
      authorizeWrite({ writeEnabled: false, dryRun: false }, OK_SOURCE, ADAPTER_KEY),
    ).toEqual({ ok: false, reason: 'writeEnabled_false' });
  });

  it('refuses when dryRun is true', () => {
    expect(
      authorizeWrite({ writeEnabled: true, dryRun: true }, OK_SOURCE, ADAPTER_KEY),
    ).toEqual({ ok: false, reason: 'dryRun_true' });
    // dryRun defaults to true implicitly in scrape-source, so `undefined` is
    // treated as dryRun_true too.
    expect(
      authorizeWrite({ writeEnabled: true }, OK_SOURCE, ADAPTER_KEY),
    ).toEqual({ ok: false, reason: 'dryRun_true' });
  });

  it('refuses when source is disabled', () => {
    expect(
      authorizeWrite(
        { writeEnabled: true, dryRun: false },
        { ...OK_SOURCE, enabled: false },
        ADAPTER_KEY,
      ),
    ).toEqual({ ok: false, reason: 'source_disabled' });
  });

  it('refuses when robots.txt has not been confirmed OK', () => {
    expect(
      authorizeWrite(
        { writeEnabled: true, dryRun: false },
        { ...OK_SOURCE, robots_ok: false },
        ADAPTER_KEY,
      ),
    ).toEqual({ ok: false, reason: 'robots_not_confirmed' });
  });

  it('refuses when write_confirmed_at is null', () => {
    expect(
      authorizeWrite(
        { writeEnabled: true, dryRun: false },
        { ...OK_SOURCE, write_confirmed_at: null },
        ADAPTER_KEY,
      ),
    ).toEqual({ ok: false, reason: 'write_not_confirmed' });
  });

  it('refuses when adapter_key mismatches source', () => {
    expect(
      authorizeWrite(
        { writeEnabled: true, dryRun: false },
        OK_SOURCE,
        'some-other-adapter',
      ),
    ).toEqual({ ok: false, reason: 'adapter_mismatch' });
  });

  it('refuses when maxWrites exceeds the hard cap', () => {
    expect(
      authorizeWrite(
        {
          writeEnabled: true,
          dryRun: false,
          maxWrites: MAX_WRITES_PER_RUN + 1,
        },
        OK_SOURCE,
        ADAPTER_KEY,
      ),
    ).toEqual({ ok: false, reason: 'max_writes_exceeded' });
  });

  it('authorizes only when all six gates pass, and clamps maxWrites', () => {
    const ok = authorizeWrite(
      { writeEnabled: true, dryRun: false, maxWrites: 10 },
      OK_SOURCE,
      ADAPTER_KEY,
    );
    expect(ok).toEqual({ ok: true, maxWrites: 10 });

    const okDefault = authorizeWrite(
      { writeEnabled: true, dryRun: false },
      OK_SOURCE,
      ADAPTER_KEY,
    );
    expect(okDefault).toEqual({ ok: true, maxWrites: MAX_WRITES_PER_RUN });
  });

  it('mirrors the real DB state of ayto-malaga-csv (disabled, robots_ok=false) — refuses', () => {
    // Snapshot of the row currently in event_sources.
    const realRow: EventSourceRow = {
      ...OK_SOURCE,
      enabled: false,
      robots_ok: false,
      write_confirmed_at: null,
    };
    expect(
      authorizeWrite(
        { writeEnabled: true, dryRun: false },
        realRow,
        ADAPTER_KEY,
      ).ok,
    ).toBe(false);
  });
});

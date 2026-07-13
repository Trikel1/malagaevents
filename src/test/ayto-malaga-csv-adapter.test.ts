// Integration test for the ayto-malaga-csv adapter.
// Executes the pure canonicalization pipeline against a local fixture that
// mirrors the real schema of https://datosabiertos.malaga.eu/recursos/cultura/agenda/2026.csv
// (verified header row on 2026-07-13). No network I/O, no DB access — the
// adapter is pure, and this test proves it.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  canonicalizeCsv,
  canonicalizeRow,
} from '../../supabase/functions/_shared/adapters/ayto-malaga-csv';
import { parseCsv } from '../../supabase/functions/_shared/adapters/lib/csv';
import { generateEventDedupeKey } from '../../supabase/functions/_shared/ingestion/dedupe';
import {
  parseSpanishDateToMadrid,
  formatMadridDedupeMinute,
} from '../../supabase/functions/_shared/ingestion/dates';

const CSV = readFileSync(
  resolve(
    __dirname,
    '../../supabase/functions/_shared/adapters/__fixtures__/ayto-malaga-csv.sample.csv',
  ),
  'utf8',
);

const SOURCE_URL =
  'https://datosabiertos.malaga.eu/recursos/cultura/agenda/2026.csv';

describe('ayto-malaga-csv adapter — canonicalization', () => {
  it('maps the real header schema onto CanonicalEvent', () => {
    const rows = parseCsv(CSV);
    expect(rows.length).toBeGreaterThanOrEqual(6);

    const first = canonicalizeRow(rows[0], SOURCE_URL)!;
    expect(first).not.toBeNull();
    expect(first.title).toBe(
      'Pasacalle de Reyes 2026 Distrito 11 Teatinos-Universidad',
    );
    expect(first.locality).toBe('Málaga');
    expect(first.timezone).toBe('Europe/Madrid');
    expect(first.externalId).toBe('51728');
    expect(first.venueName).toBe('Solar aparcamiento Avda. Plutarco');
    expect(first.venueAddress).toBe('Avenida Plutarco');
    expect(first.organizer).toBe('Junta Municipal de Distrito 11');
    expect(first.sourceUrl).toBe(
      'https://cultura.malaga.eu/agenda/51728',
    );
    expect(first.category).toBe('Fiestas populares');
  });

  it('parses dd/mm/yyyy hh:mm:ss dates as Europe/Madrid wall clock', () => {
    const events = canonicalizeCsv(CSV, SOURCE_URL);
    const concert = events.find((e) => e.externalId === '51900')!;
    expect(concert).toBeDefined();
    // 10/01/2026 20:00:00 in Madrid = 19:00 UTC (CET, UTC+1 in January).
    const parsed = parseSpanishDateToMadrid(concert.startAt)!;
    expect(formatMadridDedupeMinute(parsed)).toBe('2026-01-10T20:00');
    expect(concert.endAt).not.toBeNull();
    const end = parseSpanishDateToMadrid(concert.endAt!)!;
    expect(formatMadridDedupeMinute(end)).toBe('2026-01-10T22:00');
  });
});

describe('ayto-malaga-csv adapter — deterministic dedupe', () => {
  it('produces identical dedupe keys on two independent normalization runs', async () => {
    const runA = canonicalizeCsv(CSV, SOURCE_URL);
    const runB = canonicalizeCsv(CSV, SOURCE_URL);
    expect(runA).toHaveLength(runB.length);

    const keysA = await Promise.all(
      runA.map((ev) => generateEventDedupeKey(ev, ev.venueName)),
    );
    const keysB = await Promise.all(
      runB.map((ev) => generateEventDedupeKey(ev, ev.venueName)),
    );
    expect(keysA).toEqual(keysB);
    // Sanity: keys look like sha256 hex.
    for (const k of keysA) expect(k).toMatch(/^[0-9a-f]{64}$/);
  });

  it('collapses duplicate ESPECIALIDAD rows (same event, different category) via dedupe key', async () => {
    const events = canonicalizeCsv(CSV, SOURCE_URL);
    // Two rows in the fixture share ID_EVENTO=51728 with different CATEGORIA.
    const dupes = events.filter((e) => e.externalId === '51728');
    expect(dupes).toHaveLength(2);
    const [k1, k2] = await Promise.all(
      dupes.map((ev) => generateEventDedupeKey(ev, ev.venueName)),
    );
    // Title + venue + locality + minute are identical → same key → collapses.
    expect(k1).toBe(k2);

    // Whole set: 6 rows in fixture, 5 unique dedupe keys expected.
    const allKeys = await Promise.all(
      events.map((ev) => generateEventDedupeKey(ev, ev.venueName)),
    );
    expect(new Set(allKeys).size).toBe(events.length - 1);
  });

  it('produces a valid externalId for every canonical event', () => {
    const events = canonicalizeCsv(CSV, SOURCE_URL);
    for (const ev of events) {
      expect(ev.externalId).toMatch(/^\d+$/);
    }
  });
});

/**
 * Simulates the fields scrape-source would stamp on the events row at write
 * time. We do NOT touch the DB; this proves the canonical → row builder is
 * deterministic and emits valid ISO timestamps for `verified_at` and
 * `last_seen_at`, both required to be present on write.
 */
function buildWriteRow(
  ev: ReturnType<typeof canonicalizeRow>,
  now: Date,
): Record<string, unknown> {
  if (!ev) throw new Error('canonicalize returned null');
  const iso = now.toISOString();
  return {
    title: ev.title,
    start_at: ev.startAt,
    end_at: ev.endAt ?? null,
    venue_name: ev.venueName ?? null,
    location_name_raw: ev.locality,
    external_id: ev.externalId ?? null,
    source_ref: ev.sourceUrl,
    verified_at: iso,
    last_seen_at: iso,
    last_synced_at: iso,
  };
}

describe('ayto-malaga-csv adapter — write-row assembly', () => {
  it('stamps valid ISO verified_at and last_seen_at at a stable clock', () => {
    const events = canonicalizeCsv(CSV, SOURCE_URL);
    const now = new Date('2026-07-13T09:15:00.000Z');
    const rows = events.map((e) => buildWriteRow(e, now));
    for (const r of rows) {
      expect(r.verified_at).toBe('2026-07-13T09:15:00.000Z');
      expect(r.last_seen_at).toBe('2026-07-13T09:15:00.000Z');
      expect(r.last_synced_at).toBe('2026-07-13T09:15:00.000Z');
      expect(typeof r.start_at).toBe('string');
      expect(r.location_name_raw).toBe('Málaga');
    }
  });
});

describe('ayto-malaga-csv adapter — purity (no DB, no writes)', () => {
  it('canonicalize functions do not import Supabase and are pure', async () => {
    // Static evidence: the module has no supabase-js import. We assert this
    // by scanning its own source at test time; a change here forces a review.
    const source = readFileSync(
      resolve(
        __dirname,
        '../../supabase/functions/_shared/adapters/ayto-malaga-csv.ts',
      ),
      'utf8',
    );
    expect(source).not.toMatch(/from ["'][^"']*supabase-js[^"']*["']/);
    expect(source).not.toMatch(/\.from\(["']events["']\)/);
    expect(source).not.toMatch(/\.insert\s*\(/);
    expect(source).not.toMatch(/\.update\s*\(/);
    expect(source).not.toMatch(/\.upsert\s*\(/);
    expect(source).not.toMatch(/\.delete\s*\(/);
  });
});

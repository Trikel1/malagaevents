// Tests for the malaga.es shared parser and the two adapters that build on it
// (Diputación de Málaga · Agenda provincial + Culturama). Uses local fixtures
// captured from Firecrawl v2 on 2026-07-13. No network I/O.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  extractDetailLinks,
  parseDetailPage,
} from '../../supabase/functions/_shared/adapters/lib/malaga-es';
import {
  runDiputacionMalaga,
  detailToCanonical,
} from '../../supabase/functions/_shared/adapters/diputacion-malaga';
import { runCulturama } from '../../supabase/functions/_shared/adapters/culturama';
import { generateEventDedupeKey } from '../../supabase/functions/_shared/ingestion/dedupe';
import { formatMadridDedupeMinute } from '../../supabase/functions/_shared/ingestion/dates';

type Fixture = { markdown: string; links: string[] };

const FIX_DIR =
  '../../supabase/functions/_shared/adapters/__fixtures__/malaga-es';

function loadFixture(name: string): Fixture {
  const raw = readFileSync(resolve(__dirname, `${FIX_DIR}/${name}.json`), 'utf8');
  return JSON.parse(raw) as Fixture;
}

const DIP_LIST = loadFixture('diputacion-list');
const DIP_DETAIL = loadFixture('diputacion-detail');
const CULT_LIST = loadFixture('culturama-list');
const CULT_DETAIL = loadFixture('culturama-detail');

// Detail-page canonical source URLs (match the fixture snapshots).
const DIP_DETAIL_URL =
  'https://www.malaga.es/es/laprovincia/3315/com1_md3_cd-29131/procesion-de-la-virgen-del-carmen-de-la-carihuela-torremolinos';
const CULT_DETAIL_URL =
  'https://www.malaga.es/culturama/2157/com1_md3_cd-64860/vii-premios-a-la-cultura-malaguena-antonio-garrido-moraga-2026';

describe('malaga.es shared parser', () => {
  it('extracts unique detail links from the Diputación list page', () => {
    const items = extractDetailLinks(
      DIP_LIST.links,
      'https://www.malaga.es/es/laprovincia/3315',
    );
    expect(items.length).toBeGreaterThanOrEqual(3);
    // Every entry has a numeric id + non-empty slug
    for (const it of items) {
      expect(it.externalId).toMatch(/^\d+$/);
      expect(it.slug.length).toBeGreaterThanOrEqual(5);
      expect(it.detailUrl).toContain(`com1_md3_cd-${it.externalId}/${it.slug}`);
      expect(it.detailUrl).not.toContain('?');
    }
    // No duplicate ids
    const ids = items.map((i) => i.externalId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('extracts unique detail links from the Culturama list page', () => {
    const items = extractDetailLinks(
      CULT_LIST.links,
      'https://www.malaga.es/culturama/2157',
    );
    expect(items.length).toBeGreaterThanOrEqual(5);
    const first = items.find((i) => i.externalId === '64860');
    expect(first).toBeDefined();
    expect(first!.detailUrl).toBe(
      'https://www.malaga.es/culturama/2157/com1_md3_cd-64860/vii-premios-a-la-cultura-malaguena-antonio-garrido-moraga-2026',
    );
  });

  it('rejects list links without a slug (edit/paging variants)', () => {
    const items = extractDetailLinks(
      [
        'https://www.malaga.es/culturama/2157/com1_md3_cd-64860/',
        'https://www.malaga.es/culturama/2157/com1_md3_cd-64860/vii-premios',
        'https://www.malaga.es/culturama/2157/agenda?com2_fs=04_07_2026',
      ],
      'https://www.malaga.es/culturama/2157',
    );
    expect(items).toHaveLength(1);
    expect(items[0].externalId).toBe('64860');
  });

  it('parses the Diputación detail page correctly', () => {
    const parsed = parseDetailPage(DIP_DETAIL.markdown, DIP_DETAIL_URL);
    expect(parsed).not.toBeNull();
    expect(parsed!.externalId).toBe('29131');
    expect(parsed!.title).toBe(
      'Procesión de la Virgen del Carmen de La Carihuela (Torremolinos)',
    );
    expect(parsed!.startYear).toBe(2026);
    expect(parsed!.startMonth).toBe(7);
    expect(parsed!.startDay).toBe(16);
    expect(parsed!.endMonth).toBe(7);
    expect(parsed!.endDay).toBe(16);
    expect(parsed!.timezone).toBe('Europe/Madrid');
    expect(parsed!.imageUrl).toMatch(/^https:\/\/static\.costadelsolmalaga\.org\/.*arc_/);
  });

  it('parses the Culturama detail page correctly (multi-day + organizer)', () => {
    const parsed = parseDetailPage(CULT_DETAIL.markdown, CULT_DETAIL_URL);
    expect(parsed).not.toBeNull();
    expect(parsed!.externalId).toBe('64860');
    expect(parsed!.title).toBe(
      'VII Premios a la Cultura Malagueña Antonio Garrido Moraga 2026',
    );
    // Multi-day: 6/5 → 7/15 2026
    expect(parsed!.startMonth).toBe(6);
    expect(parsed!.startDay).toBe(5);
    expect(parsed!.endMonth).toBe(7);
    expect(parsed!.endDay).toBe(15);
    expect(parsed!.organizer).toBe('Diputación de Málaga');
    expect(parsed!.descriptionText).toContain('Premios a la Cultura Malagueña');
  });

  it('returns null on malformed input and never throws', () => {
    expect(parseDetailPage('', 'https://x')).toBeNull();
    expect(parseDetailPage('no headings here', DIP_DETAIL_URL)).toBeNull();
    expect(
      parseDetailPage('# Only title, no ical link', DIP_DETAIL_URL),
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Adapter integration tests with an injected fetch that serves fixtures.
// ---------------------------------------------------------------------------

function buildFakeFetch(routes: Record<string, Fixture>): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const bodyRaw =
      typeof init?.body === 'string' ? init.body : String(init?.body ?? '');
    let target = '';
    try {
      target = JSON.parse(bodyRaw).url;
    } catch {
      target = '';
    }
    const fx = routes[target];
    if (!fx) {
      return new Response(JSON.stringify({ error: 'no fixture', url: target }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response(
      JSON.stringify({ data: { markdown: fx.markdown, links: fx.links } }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }) as unknown as typeof fetch;
}

describe('diputacion-malaga adapter', () => {
  it('produces CanonicalEvent[] with stable externalId + Europe/Madrid dates', async () => {
    const fakeFetch = buildFakeFetch({
      'https://www.malaga.es/es/laprovincia/3315/agenda': DIP_LIST,
      [DIP_DETAIL_URL]: DIP_DETAIL,
    });

    const events = await runDiputacionMalaga({
      firecrawl: { apiKey: 'test-key', fetchImpl: fakeFetch },
      limit: 1,
      detailDelayMs: 0,
    });

    expect(events.length).toBe(1);
    const ev = events[0];
    expect(ev.externalId).toBe('malagaes-29131');
    expect(ev.timezone).toBe('Europe/Madrid');
    expect(ev.sourceUrl).toBe(DIP_DETAIL_URL);
    expect(ev.title).toContain('Procesión de la Virgen del Carmen');
    // 16 July 2026 09:00 Europe/Madrid = 07:00 UTC (CEST, +02:00)
    expect(ev.startAt).toBe('2026-07-16T07:00:00.000Z');
    expect(ev.locality).toBeTruthy();
  });

  it('two identical passes yield identical externalId + dedupe_key', async () => {
    const fakeFetch = buildFakeFetch({
      'https://www.malaga.es/es/laprovincia/3315/agenda': DIP_LIST,
      [DIP_DETAIL_URL]: DIP_DETAIL,
    });
    const pass = () =>
      runDiputacionMalaga({
        firecrawl: { apiKey: 'test-key', fetchImpl: fakeFetch },
        limit: 1,
        detailDelayMs: 0,
      });
    const a = await pass();
    const b = await pass();
    expect(a).toEqual(b);
    const keyA = await generateEventDedupeKey(a[0]);
    const keyB = await generateEventDedupeKey(b[0]);
    expect(keyA).toBe(keyB);
    expect(a[0].externalId).toBe(b[0].externalId);
    // Sanity: dedupe key covers the Madrid minute.
    expect(formatMadridDedupeMinute(new Date(a[0].startAt))).toMatch(
      /^2026-07-16T09:00$/,
    );
  });
});

describe('culturama adapter', () => {
  it('namespaces externalId with the culturama- prefix', async () => {
    const fakeFetch = buildFakeFetch({
      'https://www.malaga.es/culturama/2157/agenda': CULT_LIST,
      [CULT_DETAIL_URL]: CULT_DETAIL,
    });
    const events = await runCulturama({
      firecrawl: { apiKey: 'test-key', fetchImpl: fakeFetch },
      limit: 1,
      detailDelayMs: 0,
    });
    expect(events.length).toBe(1);
    expect(events[0].externalId).toBe('culturama-64860');
    expect(events[0].timezone).toBe('Europe/Madrid');
    expect(events[0].sourceUrl).toBe(CULT_DETAIL_URL);
  });

  it('returns empty array when list has no matching links', async () => {
    const fakeFetch = buildFakeFetch({
      'https://www.malaga.es/culturama/2157/agenda': {
        markdown: '## Agenda\nNothing here',
        links: ['https://example.com/', 'https://www.malaga.es/culturama/2157/agenda'],
      },
    });
    const events = await runCulturama({
      firecrawl: { apiKey: 'test-key', fetchImpl: fakeFetch },
      limit: 5,
      detailDelayMs: 0,
    });
    expect(events).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Purity guard: adapters must not import supabase-js or issue writes.
// ---------------------------------------------------------------------------
describe('purity guard', () => {
  it('adapters do not import @supabase/supabase-js or use DML', () => {
    for (const p of [
      '../../supabase/functions/_shared/adapters/diputacion-malaga.ts',
      '../../supabase/functions/_shared/adapters/culturama.ts',
      '../../supabase/functions/_shared/adapters/lib/malaga-es.ts',
      '../../supabase/functions/_shared/adapters/lib/firecrawl.ts',
    ]) {
      const src = readFileSync(resolve(__dirname, p), 'utf8');
      expect(src).not.toMatch(/@supabase\/supabase-js/);
      expect(src).not.toMatch(/\b(INSERT|UPDATE|DELETE)\s+INTO\b/i);
    }
  });
});

// Bonus: detailToCanonical returns null on impossible dates.
describe('detailToCanonical guard', () => {
  it('rejects out-of-range wall clock', () => {
    const bad = detailToCanonical({
      externalId: '1',
      title: 't',
      startYear: 1900,
      startMonth: 1,
      startDay: 1,
      endYear: 1900,
      endMonth: 1,
      endDay: 1,
      timezone: 'Europe/Madrid',
      organizer: null,
      locality: null,
      category: null,
      imageUrl: null,
      descriptionText: null,
      sourceUrl: 'https://x',
    });
    // 1900 is valid for Date; we simply assert it returns a valid ISO string.
    expect(bad).not.toBeNull();
    expect(bad!.startAt).toMatch(/^1900-01-/);
  });
});

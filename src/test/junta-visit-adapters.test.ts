// Tests for Bloque 4: Junta de Andalucía · Cultura Málaga and Visit Costa del Sol.
// Uses local fixtures captured 2026-07-13. No network I/O.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  extractJuntaListLinks,
  parseJuntaDetailPage,
  extractVisitSitemapLinks,
  parseVisitDetailMarkdown,
} from '../../supabase/functions/_shared/adapters/lib/junta-visit';
import {
  runJuntaAndalucia,
  juntaDetailToCanonical,
} from '../../supabase/functions/_shared/adapters/junta-andalucia-cultura';
import {
  runVisitCostaDelSol,
  visitDetailToCanonical,
} from '../../supabase/functions/_shared/adapters/visit-costa-del-sol';
import { generateEventDedupeKey } from '../../supabase/functions/_shared/ingestion/dedupe';
import { formatMadridDedupeMinute } from '../../supabase/functions/_shared/ingestion/dates';

const JUNTA_LIST = readFileSync(
  resolve(__dirname, '../../supabase/functions/_shared/adapters/__fixtures__/junta/list.html'),
  'utf8',
);
const JUNTA_DETAIL = readFileSync(
  resolve(__dirname, '../../supabase/functions/_shared/adapters/__fixtures__/junta/detail.html'),
  'utf8',
);
const VS_SITEMAP = readFileSync(
  resolve(__dirname, '../../supabase/functions/_shared/adapters/__fixtures__/visit-costa/sitemap-art.xml'),
  'utf8',
);
const VS_DETAIL = JSON.parse(
  readFileSync(
    resolve(
      __dirname,
      '../../supabase/functions/_shared/adapters/__fixtures__/visit-costa/detail-ama-break-fest.json',
    ),
    'utf8',
  ),
) as { markdown: string; links: string[] };

const JUNTA_LIST_URL =
  'https://www.juntadeandalucia.es/cultura/agendaculturaldeandalucia/malaga';
const JUNTA_DETAIL_URL =
  'https://www.juntadeandalucia.es/cultura/agendaculturaldeandalucia/evento/aguilera-y-meni-mision-impro-sible-en-marbella';
const VS_DETAIL_URL =
  'https://www.visitacostadelsol.com/agenda/ama-break-fest-p110208';

// ---------------------------------------------------------------------------
// Junta parser
// ---------------------------------------------------------------------------

describe('junta-andalucia-cultura parser', () => {
  it('extracts unique detail URLs from the Málaga listing', () => {
    const items = extractJuntaListLinks(JUNTA_LIST);
    expect(items.length).toBeGreaterThanOrEqual(10);
    for (const it of items) {
      expect(it.externalId).toMatch(/^[a-z0-9\-]+$/);
      expect(it.detailUrl).toContain('/cultura/agendaculturaldeandalucia/evento/');
    }
    expect(new Set(items.map((i) => i.externalId)).size).toBe(items.length);
  });

  it('parses the detail page (JSON-LD + fa-calendar/fa-clock)', () => {
    const parsed = parseJuntaDetailPage(JUNTA_DETAIL, JUNTA_DETAIL_URL);
    expect(parsed).not.toBeNull();
    expect(parsed!.externalId).toBe('74070'); // schema.org @id
    expect(parsed!.title).toBe('Aguilera y Mení: Misión impro-sible en Marbella');
    expect(parsed!.venueName).toBe('Plaza de Toros de Marbella');
    expect(parsed!.venueAddress).toBe('Av. Reina Victoria, 5');
    expect(parsed!.locality).toBe('Marbella');
    expect(parsed!.region).toBe('Málaga');
    expect(parsed!.postalCode).toBe('29603');
    expect(parsed!.latitude).toBeCloseTo(36.5175, 3);
    expect(parsed!.longitude).toBeCloseTo(-4.8774, 3);
    expect(parsed!.year).toBe(2026);
    expect(parsed!.month).toBe(7);
    expect(parsed!.day).toBe(18);
    expect(parsed!.hour).toBe(22);
    expect(parsed!.minute).toBe(0);
    expect(parsed!.hasExplicitTime).toBe(true);
    expect(parsed!.imageUrl).toMatch(/aguilera_meni\.jpg\.webp/);
  });

  it('returns null on missing JSON-LD or missing date block', () => {
    expect(parseJuntaDetailPage('', JUNTA_DETAIL_URL)).toBeNull();
    expect(parseJuntaDetailPage('<html><body>nothing</body></html>', JUNTA_DETAIL_URL)).toBeNull();
  });
});

describe('junta-andalucia-cultura adapter', () => {
  function buildFixtureGetter(): (url: string) => Promise<string> {
    return async (url: string) => {
      if (url === JUNTA_LIST_URL) return JUNTA_LIST;
      if (url === JUNTA_DETAIL_URL) return JUNTA_DETAIL;
      // Emulate 404 for any other detail URL — the adapter must survive.
      throw new Error('junta_http_404');
    };
  }

  it('produces one CanonicalEvent for the fixture detail (all sibling details 404 gracefully)', async () => {
    const events = await runJuntaAndalucia({
      httpGet: buildFixtureGetter(),
      limit: 30,
      detailDelayMs: 0,
    });
    expect(events.length).toBeGreaterThanOrEqual(1);
    const ev = events.find((e) => e.externalId === 'junta-74070');
    expect(ev).toBeDefined();
    expect(ev!.timezone).toBe('Europe/Madrid');
    // 18 July 2026 22:00 Europe/Madrid → 20:00 UTC (CEST, +02:00)
    expect(ev!.startAt).toBe('2026-07-18T20:00:00.000Z');
    expect(ev!.locality).toBe('Marbella');
    expect(ev!.venueName).toBe('Plaza de Toros de Marbella');
    expect(ev!.sourceUrl).toBe(JUNTA_DETAIL_URL);
    expect(ev!.organizer).toBe('Junta de Andalucía');
  });

  it('two identical passes yield identical externalId + dedupe_key', async () => {
    const getter = buildFixtureGetter();
    const pass = () =>
      runJuntaAndalucia({ httpGet: getter, limit: 30, detailDelayMs: 0 });
    const a = await pass();
    const b = await pass();
    expect(a).toEqual(b);
    const ev = a.find((e) => e.externalId === 'junta-74070')!;
    const evB = b.find((e) => e.externalId === 'junta-74070')!;
    expect(await generateEventDedupeKey(ev)).toBe(await generateEventDedupeKey(evB));
    expect(formatMadridDedupeMinute(new Date(ev.startAt))).toBe('2026-07-18T22:00');
  });
});

// ---------------------------------------------------------------------------
// Visit Costa del Sol
// ---------------------------------------------------------------------------

describe('visit-costa-del-sol parser', () => {
  it('extracts unique event URLs from the sitemap', () => {
    const items = extractVisitSitemapLinks(VS_SITEMAP);
    expect(items.length).toBeGreaterThanOrEqual(10);
    for (const it of items) {
      expect(it.externalId).toMatch(/^\d+$/);
      expect(it.detailUrl).toMatch(
        /^https:\/\/www\.visitacostadelsol\.com\/agenda\/[a-z0-9\-]+-p\d+$/,
      );
    }
    expect(new Set(items.map((i) => i.externalId)).size).toBe(items.length);
  });

  it('parses the detail markdown correctly', () => {
    const parsed = parseVisitDetailMarkdown(VS_DETAIL.markdown, VS_DETAIL_URL);
    expect(parsed).not.toBeNull();
    expect(parsed!.externalId).toBe('110208');
    expect(parsed!.slug).toBe('ama-break-fest');
    expect(parsed!.title).toBe('AMA BREAK FEST');
    expect(parsed!.locality).toBe('Málaga');
    expect(parsed!.year).toBe(2026);
    expect(parsed!.month).toBe(7);
    expect(parsed!.day).toBe(25);
    expect(parsed!.imageUrl).toMatch(/arc_41453_[gm]\.jpg/);
    expect(parsed!.externalWebsite).toBe(
      'https://linke-arte.com/esp/en/5-aniv-alameda-ama-break-fest',
    );
  });

  it('returns null on empty markdown', () => {
    expect(parseVisitDetailMarkdown('', VS_DETAIL_URL)).toBeNull();
  });
});

describe('visit-costa-del-sol adapter', () => {
  function buildFakeFirecrawlFetch(md: string): typeof fetch {
    return (async (input: RequestInfo | URL, init?: RequestInit) => {
      const body = typeof init?.body === 'string' ? init.body : '';
      let target = '';
      try {
        target = JSON.parse(body).url;
      } catch {
        target = '';
      }
      if (target !== VS_DETAIL_URL) {
        return new Response(JSON.stringify({ error: 'no fixture', url: target }), {
          status: 404,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response(
        JSON.stringify({ data: { markdown: md, links: [] } }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }) as unknown as typeof fetch;
  }

  it('produces CanonicalEvent[] with Europe/Madrid dates + stable externalId', async () => {
    const events = await runVisitCostaDelSol({
      firecrawl: { apiKey: 'test-key', fetchImpl: buildFakeFirecrawlFetch(VS_DETAIL.markdown) },
      sitemapGet: async () => VS_SITEMAP,
      limit: 34,
      detailDelayMs: 0,
    });
    const ev = events.find((e) => e.externalId === 'vcs-110208');
    expect(ev).toBeDefined();
    expect(ev!.timezone).toBe('Europe/Madrid');
    expect(ev!.title).toBe('AMA BREAK FEST');
    expect(ev!.locality).toBe('Málaga');
    // 25 July 2026 10:00 Europe/Madrid → 08:00 UTC
    expect(ev!.startAt).toBe('2026-07-25T08:00:00.000Z');
    expect(ev!.sourceUrl).toBe(VS_DETAIL_URL);
    expect(ev!.ticketUrl).toBe('https://linke-arte.com/esp/en/5-aniv-alameda-ama-break-fest');
  });

  it('two identical passes yield identical externalId + dedupe_key', async () => {
    const cfg = () => ({
      firecrawl: { apiKey: 'k', fetchImpl: buildFakeFirecrawlFetch(VS_DETAIL.markdown) },
      sitemapGet: async () => VS_SITEMAP,
      limit: 34,
      detailDelayMs: 0,
    });
    const a = await runVisitCostaDelSol(cfg());
    const b = await runVisitCostaDelSol(cfg());
    expect(a).toEqual(b);
    const evA = a.find((e) => e.externalId === 'vcs-110208')!;
    const evB = b.find((e) => e.externalId === 'vcs-110208')!;
    expect(await generateEventDedupeKey(evA)).toBe(await generateEventDedupeKey(evB));
  });
});

// ---------------------------------------------------------------------------
// Purity guard
// ---------------------------------------------------------------------------

describe('purity guard (Bloque 4)', () => {
  it('adapters do not import @supabase/supabase-js and issue no DML', () => {
    for (const p of [
      '../../supabase/functions/_shared/adapters/junta-andalucia-cultura.ts',
      '../../supabase/functions/_shared/adapters/visit-costa-del-sol.ts',
      '../../supabase/functions/_shared/adapters/lib/junta-visit.ts',
    ]) {
      const src = readFileSync(resolve(__dirname, p), 'utf8');
      expect(src).not.toMatch(/from\s+["']@supabase\/supabase-js["']/);
      expect(src).not.toMatch(/\b(INSERT|UPDATE|DELETE)\s+INTO\b/i);
    }
  });
});

// Bonus: canonical converters produce null-safe outputs.
describe('canonical converter guards', () => {
  it('juntaDetailToCanonical returns a valid ISO', () => {
    const c = juntaDetailToCanonical({
      externalId: '1',
      slug: 'x',
      title: 't',
      description: null,
      detailUrl: 'https://x',
      imageUrl: null,
      venueName: null,
      venueAddress: null,
      locality: 'Málaga',
      region: null,
      postalCode: null,
      latitude: null,
      longitude: null,
      year: 2026,
      month: 12,
      day: 31,
      hour: 23,
      minute: 30,
      hasExplicitTime: true,
    });
    expect(c).not.toBeNull();
    expect(c!.startAt).toMatch(/^2026-12-31T22:30/); // CET +01:00 in December
    expect(c!.externalId).toBe('junta-1');
  });

  it('visitDetailToCanonical builds a range when end > start', () => {
    const c = visitDetailToCanonical({
      externalId: '9',
      slug: 'x',
      title: 't',
      detailUrl: 'https://x',
      locality: 'Málaga',
      year: 2026,
      month: 8,
      day: 1,
      endYear: 2026,
      endMonth: 8,
      endDay: 3,
      descriptionText: null,
      imageUrl: null,
      externalWebsite: null,
    });
    expect(c).not.toBeNull();
    expect(c!.startAt).toBe('2026-08-01T08:00:00.000Z');
    expect(c!.endAt).toBe('2026-08-03T20:00:00.000Z');
    expect(c!.externalId).toBe('vcs-9');
  });
});

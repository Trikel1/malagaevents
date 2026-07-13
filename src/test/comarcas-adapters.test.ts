// Tests for Bloque 5: Axarquía Costa del Sol + Serranía de Ronda.
// Uses local fixtures captured 2026-07-13. No network I/O.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  extractAxarquiaListLinks,
  parseAxarquiaDetailPage,
  parseSerraniaListing,
} from '../../supabase/functions/_shared/adapters/lib/comarcas';
import {
  runAxarquia,
  axarquiaDetailToCanonical,
} from '../../supabase/functions/_shared/adapters/axarquia-costa-del-sol';
import {
  runSerrania,
  serraniaDetailToCanonical,
} from '../../supabase/functions/_shared/adapters/serrania-de-ronda';
import { generateEventDedupeKey } from '../../supabase/functions/_shared/ingestion/dedupe';

const FIX = (name: string) =>
  readFileSync(
    resolve(
      __dirname,
      `../../supabase/functions/_shared/adapters/__fixtures__/comarcas/${name}`,
    ),
    'utf8',
  );

const AX_LIST = FIX('axarquia-list.html');
const AX_DETAIL = FIX('axarquia-detail.html');
const SR_LIST = FIX('serrania-list.html');

const AX_LIST_URL =
  'https://axarquiacostadelsol.es/eventosaxarquiacostadelsol/';
const AX_DETAIL_URL =
  'https://axarquiacostadelsol.es/evento/los40-summer-live-en-torre-del-mar/';
const SR_LIST_URL = 'https://www.serraniaderonda.com/portal/es/eventos.php';

// ---------------------------------------------------------------------------
// Axarquía parser
// ---------------------------------------------------------------------------

describe('axarquia-costa-del-sol parser', () => {
  it('extracts unique detail URLs from the listing', () => {
    const items = extractAxarquiaListLinks(AX_LIST);
    expect(items.length).toBeGreaterThanOrEqual(5);
    for (const it of items) {
      expect(it.externalId).toMatch(/^[a-z0-9\-]+$/);
      expect(it.detailUrl).toMatch(
        /^https:\/\/axarquiacostadelsol\.es\/evento\/[a-z0-9\-]+\/$/,
      );
    }
    expect(new Set(items.map((i) => i.externalId)).size).toBe(items.length);
  });

  it('parses the detail JSON-LD Event with full address', () => {
    const parsed = parseAxarquiaDetailPage(AX_DETAIL, AX_DETAIL_URL);
    expect(parsed).not.toBeNull();
    expect(parsed!.slug).toBe('los40-summer-live-en-torre-del-mar');
    expect(parsed!.title).toBe('LOS40 Summer Live en Torre del Mar');
    expect(parsed!.venueName).toBe('Paseo Marítimo Torre del Mar');
    expect(parsed!.locality).toBe('Vélez-Málaga');
    expect(parsed!.region).toBe('Málaga');
    expect(parsed!.postalCode).toBe('29740');
    expect(parsed!.year).toBe(2026);
    expect(parsed!.month).toBe(7);
    expect(parsed!.day).toBe(15);
    expect(parsed!.hour).toBe(20);
    expect(parsed!.hasExplicitTime).toBe(false);
    expect(parsed!.organizer).toBe('Ayuntamiento de Vélez-Málaga');
  });

  it('rejects events outside Málaga province (invented locality guard)', () => {
    const fake = `<script type="application/ld+json">${JSON.stringify([
      {
        '@context': 'http://schema.org',
        '@type': 'Event',
        name: 'Fake Almuñécar',
        startDate: '2026-08-01T00:00:00+00:00',
        endDate: '2026-08-01T23:59:59+00:00',
        location: {
          '@type': 'Place',
          address: {
            addressLocality: 'Almuñécar',
            addressRegion: 'Granada',
            postalCode: '18690',
          },
        },
      },
    ])}</script>`;
    expect(
      parseAxarquiaDetailPage(fake, 'https://axarquiacostadelsol.es/evento/fake/'),
    ).toBeNull();
  });

  it('returns null on missing JSON-LD', () => {
    expect(parseAxarquiaDetailPage('', AX_DETAIL_URL)).toBeNull();
    expect(parseAxarquiaDetailPage('<html><body>nothing</body></html>', AX_DETAIL_URL)).toBeNull();
  });
});

describe('axarquia-costa-del-sol adapter', () => {
  function buildFixtureGetter(): (url: string) => Promise<string> {
    return async (url: string) => {
      if (url === AX_LIST_URL) return AX_LIST;
      if (url === AX_DETAIL_URL) return AX_DETAIL;
      throw new Error('axarquia_http_404');
    };
  }

  it('produces a CanonicalEvent for the fixture detail (siblings 404 gracefully)', async () => {
    const events = await runAxarquia({
      httpGet: buildFixtureGetter(),
      limit: 30,
      detailDelayMs: 0,
    });
    expect(events.length).toBeGreaterThanOrEqual(1);
    const ev = events.find(
      (e) => e.externalId === 'axarquia-los40-summer-live-en-torre-del-mar',
    );
    expect(ev).toBeDefined();
    expect(ev!.timezone).toBe('Europe/Madrid');
    // 15 July 2026 20:00 Europe/Madrid → 18:00 UTC (CEST +02:00)
    expect(ev!.startAt).toBe('2026-07-15T18:00:00.000Z');
    expect(ev!.locality).toBe('Vélez-Málaga');
    expect(ev!.sourceUrl).toBe(AX_DETAIL_URL);
    expect(ev!.organizer).toBe('Ayuntamiento de Vélez-Málaga');
  });

  it('two identical passes yield identical externalId + dedupe_key', async () => {
    const getter = buildFixtureGetter();
    const pass = () =>
      runAxarquia({ httpGet: getter, limit: 30, detailDelayMs: 0 });
    const a = await pass();
    const b = await pass();
    expect(a).toEqual(b);
    const evA = a.find((e) =>
      e.externalId === 'axarquia-los40-summer-live-en-torre-del-mar',
    )!;
    const evB = b.find((e) =>
      e.externalId === 'axarquia-los40-summer-live-en-torre-del-mar',
    )!;
    expect(await generateEventDedupeKey(evA)).toBe(
      await generateEventDedupeKey(evB),
    );
  });
});

// ---------------------------------------------------------------------------
// Serranía parser
// ---------------------------------------------------------------------------

describe('serrania-de-ronda parser', () => {
  it('extracts vevent items with dtstart/dtend/location', () => {
    const items = parseSerraniaListing(SR_LIST);
    expect(items.length).toBeGreaterThanOrEqual(3);
    for (const it of items) {
      expect(it.externalId).toMatch(/^[a-z0-9\-]+$/);
      expect(it.year).toBeGreaterThanOrEqual(2025);
      expect(it.month).toBeGreaterThanOrEqual(1);
      expect(it.month).toBeLessThanOrEqual(12);
      expect(it.day).toBeGreaterThanOrEqual(1);
      expect(it.day).toBeLessThanOrEqual(31);
      expect(it.locality.length).toBeGreaterThan(0);
      expect(it.detailUrl).toMatch(/^https:\/\/www\.serraniaderonda\.com\/portal\/es\/eventos\//);
    }
    expect(new Set(items.map((i) => i.externalId)).size).toBe(items.length);
  });

  it('splits comma-separated locations to first municipality', () => {
    const items = parseSerraniaListing(SR_LIST);
    const pueblos = items.find((i) => i.externalId === 'pueblos-blancos-music-festival');
    expect(pueblos).toBeDefined();
    expect(pueblos!.locality).toBe('Montejaque');
  });
});

describe('serrania-de-ronda adapter', () => {
  const getter = async (url: string) => {
    if (url === SR_LIST_URL) return SR_LIST;
    throw new Error('serrania_http_404');
  };

  it('produces CanonicalEvent[] with Europe/Madrid defaults', async () => {
    const events = await runSerrania({ httpGet: getter, limit: 20 });
    expect(events.length).toBeGreaterThanOrEqual(3);
    const setenil = events.find((e) => e.externalId === 'serrania-carrera-urbana-nocturna-de-setenil');
    expect(setenil).toBeDefined();
    expect(setenil!.locality).toBe('Setenil');
    expect(setenil!.timezone).toBe('Europe/Madrid');
    // 1 Aug 2026 20:00 Madrid → 18:00 UTC
    expect(setenil!.startAt).toBe('2026-08-01T18:00:00.000Z');
    expect(setenil!.sourceUrl).toMatch(/serraniaderonda\.com/);
  });

  it('two identical passes yield identical externalId + dedupe_key', async () => {
    const pass = () => runSerrania({ httpGet: getter, limit: 20 });
    const a = await pass();
    const b = await pass();
    expect(a).toEqual(b);
    for (let i = 0; i < a.length; i++) {
      expect(await generateEventDedupeKey(a[i])).toBe(
        await generateEventDedupeKey(b[i]),
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Purity guard
// ---------------------------------------------------------------------------

describe('purity guard (Bloque 5)', () => {
  it('adapters do not import @supabase/supabase-js and issue no DML', () => {
    for (const p of [
      '../../supabase/functions/_shared/adapters/axarquia-costa-del-sol.ts',
      '../../supabase/functions/_shared/adapters/serrania-de-ronda.ts',
      '../../supabase/functions/_shared/adapters/lib/comarcas.ts',
    ]) {
      const src = readFileSync(resolve(__dirname, p), 'utf8');
      expect(src).not.toMatch(/from\s+["']@supabase\/supabase-js["']/);
      expect(src).not.toMatch(/\b(INSERT|UPDATE|DELETE)\s+INTO\b/i);
    }
  });
});

// Canonical converter guards
describe('canonical converter guards (Bloque 5)', () => {
  it('axarquiaDetailToCanonical builds range when end > start', () => {
    const c = axarquiaDetailToCanonical({
      externalId: 'x',
      slug: 'x',
      title: 't',
      description: null,
      detailUrl: 'https://x',
      imageUrl: null,
      venueName: null,
      venueAddress: null,
      locality: 'Vélez-Málaga',
      region: 'Málaga',
      postalCode: '29740',
      organizer: null,
      year: 2026,
      month: 8,
      day: 10,
      hour: 20,
      minute: 0,
      hasExplicitTime: false,
      endYear: 2026,
      endMonth: 8,
      endDay: 12,
    });
    expect(c).not.toBeNull();
    expect(c!.startAt).toBe('2026-08-10T18:00:00.000Z');
    expect(c!.endAt).toMatch(/^2026-08-12T21:59/);
    expect(c!.externalId).toBe('axarquia-x');
  });

  it('serraniaDetailToCanonical uses 20:00 Madrid default', () => {
    const c = serraniaDetailToCanonical({
      externalId: 'y',
      title: 't',
      description: null,
      detailUrl: 'https://y',
      imageUrl: null,
      locality: 'Ronda',
      venueName: null,
      year: 2026,
      month: 12,
      day: 31,
      endYear: 2026,
      endMonth: 12,
      endDay: 31,
    });
    expect(c).not.toBeNull();
    // Dec 31 2026 20:00 Madrid → CET +01:00 → 19:00 UTC
    expect(c!.startAt).toBe('2026-12-31T19:00:00.000Z');
    expect(c!.externalId).toBe('serrania-y');
    expect(c!.endAt).toBeNull(); // same day → no range
  });
});

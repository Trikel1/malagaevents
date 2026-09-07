import { describe, it, expect } from 'vitest';
import {
  mapTribeEvent,
  fetchTribeEvents,
  tribeEndpointFor,
} from '../../supabase/functions/_shared/ingestion/tribeEvents.ts';

// Real shape captured from axarquiacostadelsol.es on 2026-09-08.
const allDaySample = {
  id: 35615,
  global_id: 'axarquiacostadelsol.es?id=35615',
  status: 'publish',
  url: 'https://axarquiacostadelsol.es/evento/xxvi-dia-de-vineros/',
  title: 'XXVI Día de Viñeros · Moclinejo',
  description: '<p>Fiesta del vino</p>',
  start_date: '2026-09-13 00:00:00',
  end_date: '2026-09-13 23:59:59',
  all_day: true,
  cost: '',
  website: '',
  venue: [],
  image: { url: 'https://axarquiacostadelsol.es/wp-content/uploads/2026/09/Vineros_1.jpg' },
  categories: [{ name: 'Fiestas culturales' }],
};

const timedSample = {
  ...allDaySample,
  id: 100,
  global_id: 'example.org?id=100',
  url: 'https://example.org/evento/concierto/',
  title: 'Concierto de otoño',
  start_date: '2026-10-26 20:30:00',
  end_date: '2026-10-26 22:00:00',
  all_day: false,
  cost: '12 €',
  venue: { venue: 'Teatro Municipal', city: 'Vélez-Málaga', address: 'Plaza de las Carmelitas 1' },
};

const responder = (pages: Record<number, unknown>) => async (url: string) => {
  const page = Number(new URL(url).searchParams.get('page') ?? '1');
  const body = pages[page];
  if (body === undefined) return { ok: false, status: 404, json: async () => ({}) };
  return { ok: true, status: 200, json: async () => body };
};

describe('Tribe Events adapter', () => {
  it('keeps an all-day event without inventing a time', () => {
    const mapped = mapTribeEvent(allDaySample)!;
    expect(mapped.allDay).toBe(true);
    expect(mapped.occurrences[0]).toEqual({ date: '2026-09-13', time: undefined, end_time: undefined });
  });

  it('never turns an unknown price into "Gratis"', () => {
    expect(mapTribeEvent(allDaySample)!.isFree).toBeUndefined();
    expect(mapTribeEvent({ ...timedSample, cost: 'Gratis' })!.isFree).toBe(true);
    expect(mapTribeEvent(timedSample)!.isFree).toBe(false);
  });

  it('does not invent a venue when the feed publishes none', () => {
    expect(mapTribeEvent(allDaySample)!.venue).toBeUndefined();
    expect(mapTribeEvent(timedSample)!.venue).toBe('Teatro Municipal');
    expect(mapTribeEvent(timedSample)!.city).toBe('Vélez-Málaga');
  });

  it('keeps the published time and the source identity', () => {
    const mapped = mapTribeEvent(timedSample)!;
    expect(mapped.occurrences[0]).toEqual({ date: '2026-10-26', time: '20:30', end_time: '22:00' });
    expect(mapped.externalId).toBe('example.org?id=100');
    expect(mapped.eventUrl).toBe('https://example.org/evento/concierto/');
    expect(mapped.imageUrl).toContain('Vineros_1.jpg');
  });

  it('marks a cancelled entry instead of dropping it silently', () => {
    expect(mapTribeEvent({ ...timedSample, status: 'canceled' })!.scheduleStatus).toBe('canceled');
  });

  it('reads every page of a multi-page agenda', async () => {
    const result = await fetchTribeEvents('https://example.org/agenda/', responder({
      1: { total: 3, total_pages: 2, events: [timedSample, { ...timedSample, id: 101, global_id: 'example.org?id=101' }] },
      2: { total: 3, total_pages: 2, events: [{ ...timedSample, id: 102, global_id: 'example.org?id=102' }] },
    }), { perPage: 2, maxPages: 6 });

    expect(result.ok).toBe(true);
    expect(result.pagesVisited).toBe(2);
    expect(result.events).toHaveLength(3);
    expect(result.coverage).toBe('complete');
    expect(result.totalReported).toBe(3);
  });

  it('reports partial coverage instead of claiming a full agenda', async () => {
    const result = await fetchTribeEvents('https://example.org/agenda/', responder({
      1: { total: 90, total_pages: 9, events: [timedSample] },
    }), { perPage: 10, maxPages: 1 });
    expect(result.coverage).toBe('partial');
  });

  it('reimporting the same feed yields the same identities', async () => {
    const pages = { 1: { total: 1, total_pages: 1, events: [timedSample] } };
    const a = await fetchTribeEvents('https://example.org/', responder(pages));
    const b = await fetchTribeEvents('https://example.org/', responder(pages));
    expect(a.events.map((e) => e.externalId)).toEqual(b.events.map((e) => e.externalId));
  });

  it('a missing plugin is an access result, not an empty agenda', async () => {
    const result = await fetchTribeEvents('https://example.org/', async () => ({
      ok: false, status: 404, json: async () => ({}),
    }));
    expect(result.ok).toBe(false);
    expect(result.coverage).toBe('none');
    expect(result.error).toBe('HTTP 404');
  });

  it('a network failure never looks like a successful empty run', async () => {
    const result = await fetchTribeEvents('https://example.org/', async () => {
      throw new Error('connection reset');
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe('connection reset');
  });

  it('derives the endpoint from any page of the site', () => {
    expect(tribeEndpointFor('https://axarquiacostadelsol.es/eventosaxarquiacostadelsol/'))
      .toBe('https://axarquiacostadelsol.es/wp-json/tribe/events/v1/events');
  });
});

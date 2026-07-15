import { describe, it, expect } from 'vitest';
import {
  normalizeCulturalCategory,
  getMadridHour,
  momentMatches,
  countActiveGroups,
  applyCulturalFilters,
  applySportsFilters,
  availableCulturalGroups,
  availableSportCategories,
  EMPTY_CALENDAR_FILTERS,
  type CalendarFilters,
} from './calendarFilters';
import type { CalendarEntry } from './calendarEntries';
import type { Event } from '@/types';
import type { SportEvent } from '@/types/sports';

const makeEvent = (over: Partial<Event> & Pick<Event, 'id' | 'start_at' | 'category'>): Event => ({
  title: 't',
  description: '',
  venue_name: 'v',
  address: '',
  is_free: false,
  source_type: 'official_feed',
  status: 'published',
  created_at: '2026-07-01T00:00:00.000Z',
  ...over,
});

const makeEntry = (ev: Event, over: Partial<CalendarEntry> = {}): CalendarEntry => ({
  id: `occ-${ev.id}`,
  event_id: ev.id,
  start_datetime: ev.start_at,
  event: ev,
  ...over,
});

const makeSport = (over: Partial<SportEvent> & Pick<SportEvent, 'id' | 'start_at' | 'sport'>): SportEvent => ({
  title: 't',
  competition: 'c',
  venue: 'v',
  city: 'Málaga',
  ...over,
});

describe('normalizeCulturalCategory', () => {
  it('groups music-like categories', () => {
    expect(normalizeCulturalCategory('music')).toBe('musica');
    expect(normalizeCulturalCategory('Concierto')).toBe('musica');
    expect(normalizeCulturalCategory('Flamenco')).toBe('musica');
  });

  it('groups escena categories', () => {
    expect(normalizeCulturalCategory('theater')).toBe('escena');
    expect(normalizeCulturalCategory('Teatro')).toBe('escena');
    expect(normalizeCulturalCategory('Espectáculo')).toBe('escena');
    expect(normalizeCulturalCategory('cine')).toBe('escena');
    expect(normalizeCulturalCategory('danza')).toBe('escena');
  });

  it('groups arte, talleres, fiestas, familia', () => {
    expect(normalizeCulturalCategory('exhibition')).toBe('arte');
    expect(normalizeCulturalCategory('Galería')).toBe('arte');
    expect(normalizeCulturalCategory('workshop')).toBe('talleres');
    expect(normalizeCulturalCategory('Charla')).toBe('talleres');
    expect(normalizeCulturalCategory('festival')).toBe('fiestas');
    expect(normalizeCulturalCategory('feria')).toBe('fiestas');
    expect(normalizeCulturalCategory('kids')).toBe('familia');
    expect(normalizeCulturalCategory('Infantil')).toBe('familia');
    expect(normalizeCulturalCategory('Niños')).toBe('familia');
  });

  it('falls back to otros for unknown or missing', () => {
    expect(normalizeCulturalCategory('random')).toBe('otros');
    expect(normalizeCulturalCategory(undefined)).toBe('otros');
    expect(normalizeCulturalCategory(null)).toBe('otros');
  });
});

describe('Europe/Madrid moment logic', () => {
  it('returns Madrid hour with summer offset (+2h)', () => {
    // 08:00Z in July is 10:00 Madrid
    expect(getMadridHour('2026-07-15T08:00:00Z')).toBe(10);
    // 22:00Z in July is 00:00 next day Madrid
    expect(getMadridHour('2026-07-15T22:00:00Z')).toBe(0);
  });

  it('returns Madrid hour with winter offset (+1h)', () => {
    expect(getMadridHour('2026-01-15T08:00:00Z')).toBe(9);
  });

  it('assigns morning/afternoon/evening buckets', () => {
    // 10:00 Madrid → morning
    expect(momentMatches('2026-07-15T08:00:00Z', 'morning')).toBe(true);
    expect(momentMatches('2026-07-15T08:00:00Z', 'afternoon')).toBe(false);
    // 16:00 Madrid → afternoon
    expect(momentMatches('2026-07-15T14:00:00Z', 'afternoon')).toBe(true);
    // 21:00 Madrid → evening
    expect(momentMatches('2026-07-15T19:00:00Z', 'evening')).toBe(true);
    // boundaries: 14:00 Madrid → afternoon
    expect(momentMatches('2026-07-15T12:00:00Z', 'afternoon')).toBe(true);
    expect(momentMatches('2026-07-15T12:00:00Z', 'morning')).toBe(false);
    // 20:00 Madrid → evening
    expect(momentMatches('2026-07-15T18:00:00Z', 'evening')).toBe(true);
    expect(momentMatches('2026-07-15T18:00:00Z', 'afternoon')).toBe(false);
  });

  it('any moment matches everything', () => {
    expect(momentMatches('2026-07-15T03:00:00Z', 'any')).toBe(true);
  });
});

describe('countActiveGroups', () => {
  it('counts each active group once, categories only once', () => {
    expect(countActiveGroups(EMPTY_CALENDAR_FILTERS)).toBe(0);
    const f: CalendarFilters = {
      moment: 'evening',
      categories: ['musica', 'escena', 'arte'],
      isFree: true,
      withTickets: true,
    };
    expect(countActiveGroups(f)).toBe(4);
  });
});

describe('applyCulturalFilters', () => {
  const evMusic = makeEvent({ id: 'a', start_at: '2026-07-15T08:00:00Z', category: 'music', is_free: true });
  const evTheaterPaid = makeEvent({ id: 'b', start_at: '2026-07-15T19:00:00Z', category: 'teatro', ticket_url: 'https://x' });
  const evKidsFree = makeEvent({ id: 'c', start_at: '2026-07-15T14:00:00Z', category: 'infantil', is_free: true });
  const entries = [evMusic, evTheaterPaid, evKidsFree].map((e) => makeEntry(e));

  it('combines moment + categories + free + tickets correctly', () => {
    expect(applyCulturalFilters(entries, EMPTY_CALENDAR_FILTERS)).toHaveLength(3);

    expect(
      applyCulturalFilters(entries, { ...EMPTY_CALENDAR_FILTERS, moment: 'morning' }),
    ).toHaveLength(1);

    expect(
      applyCulturalFilters(entries, { ...EMPTY_CALENDAR_FILTERS, categories: ['musica', 'familia'] }),
    ).toHaveLength(2);

    expect(
      applyCulturalFilters(entries, { ...EMPTY_CALENDAR_FILTERS, isFree: true }),
    ).toHaveLength(2);

    expect(
      applyCulturalFilters(entries, { ...EMPTY_CALENDAR_FILTERS, withTickets: true }),
    ).toHaveLength(1);

    // Combined: evening + escena → only theater
    expect(
      applyCulturalFilters(entries, {
        moment: 'evening',
        categories: ['escena'],
        isFree: false,
        withTickets: false,
      }),
    ).toEqual([expect.objectContaining({ event_id: 'b' })]);
  });
});

describe('applySportsFilters', () => {
  const a = makeSport({ id: '1', start_at: '2026-07-15T18:00:00Z', sport: 'futbol' }); // 20:00 evening
  const b = makeSport({ id: '2', start_at: '2026-07-15T08:00:00Z', sport: 'baloncesto' }); // 10:00 morning

  it('applies moment and category filters', () => {
    expect(applySportsFilters([a, b], EMPTY_CALENDAR_FILTERS)).toHaveLength(2);
    expect(
      applySportsFilters([a, b], { ...EMPTY_CALENDAR_FILTERS, moment: 'morning' }),
    ).toHaveLength(1);
    expect(
      applySportsFilters([a, b], { ...EMPTY_CALENDAR_FILTERS, categories: ['futbol'] }),
    ).toEqual([a]);
  });
});

describe('available categories', () => {
  it('lists only cultural groups present in dataset, in canonical order', () => {
    const entries = [
      makeEntry(makeEvent({ id: 'a', start_at: '2026-07-01T10:00:00Z', category: 'infantil' })),
      makeEntry(makeEvent({ id: 'b', start_at: '2026-07-02T10:00:00Z', category: 'music' })),
    ];
    expect(availableCulturalGroups(entries)).toEqual(['musica', 'familia']);
  });

  it('lists only sport categories present in dataset', () => {
    const events = [
      makeSport({ id: '1', start_at: '2026-07-01T10:00:00Z', sport: 'tenis' }),
      makeSport({ id: '2', start_at: '2026-07-02T10:00:00Z', sport: 'futbol' }),
    ];
    expect(availableSportCategories(events)).toEqual(['futbol', 'tenis']);
  });
});

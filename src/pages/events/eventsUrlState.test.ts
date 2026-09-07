import { describe, it, expect } from 'vitest';
import {
  parseEventsUrl,
  serializeEventsUrl,
  clearedEventsUrl,
  isSameSearch,
  parseDayKey,
} from './eventsUrlState';

const sp = (s: string) => new URLSearchParams(s);
const round = (s: string) => serializeEventsUrl(sp(s), parseEventsUrl(sp(s))).toString();

describe('eventsUrlState — parse', () => {
  it('reads legacy filter=today and filter=weekend', () => {
    expect(parseEventsUrl(sp('filter=today')).filters.datePreset).toBe('today');
    expect(parseEventsUrl(sp('filter=weekend')).filters.datePreset).toBe('weekend');
  });

  it('keeps every scope of a combined legacy link', () => {
    const { filters } = parseEventsUrl(sp('filter=family,free,weekend'));
    expect(filters.familyKids).toBe(true);
    expect(filters.isFree).toBe(true);
    expect(filters.datePreset).toBe('weekend');
  });

  it('canonical preset wins over the legacy key', () => {
    expect(parseEventsUrl(sp('filter=today&preset=next30')).filters.datePreset).toBe('next30');
  });

  it('rejects unknown presets, categories and age ranges', () => {
    const { filters } = parseEventsUrl(sp('preset=someday&category=music,__evil&age=99-100'));
    expect(filters.datePreset).toBeUndefined();
    expect(filters.categories).toEqual(['music']);
    expect(filters.ageRange).toBeUndefined();
  });

  it('only accepts UUIDs in venue and location lists', () => {
    const ok = '11111111-2222-3333-4444-555555555555';
    const { venueIds, locationIds } = parseEventsUrl(
      sp(`venues=${ok},not-a-uuid&locations=' OR 1=1--`),
    );
    expect(venueIds).toEqual([ok]);
    expect(locationIds).toEqual([]);
  });

  it('validates day keys', () => {
    expect(parseDayKey('2026-02-31')).toBeUndefined();
    expect(parseDayKey('yesterday')).toBeUndefined();
    expect(parseDayKey('2026-09-07')?.getDate()).toBe(7);
  });
});

describe('eventsUrlState — serialize', () => {
  it('rewrites legacy links to canonical keys without losing scope', () => {
    const out = sp(round('filter=family,free&preset=weekend'));
    expect(out.get('filter')).toBeNull();
    expect(out.get('family')).toBe('1');
    expect(out.get('free')).toBe('1');
    expect(out.get('preset')).toBe('weekend');
  });

  it('preserves unrelated params on every write and on reset', () => {
    const base = sp('utm_source=news&preset=today&free=1');
    const next = serializeEventsUrl(base, {
      ...parseEventsUrl(base),
      filters: { ...parseEventsUrl(base).filters, isFree: undefined },
    });
    expect(next.get('utm_source')).toBe('news');
    expect(next.get('free')).toBeNull();

    const cleared = clearedEventsUrl(base);
    expect(cleared.toString()).toBe('utm_source=news');
  });

  it('round-trips a full state', () => {
    const uuid = '11111111-2222-3333-4444-555555555555';
    const s = `q=jazz&category=music,theater&preset=weekend&free=1&family=1&age=4-8&venues=${uuid}`;
    const state = parseEventsUrl(sp(s));
    expect(parseEventsUrl(serializeEventsUrl(sp(''), state))).toEqual(state);
  });

  it('isSameSearch ignores param order', () => {
    expect(isSameSearch(sp('a=1&b=2'), sp('b=2&a=1'))).toBe(true);
    expect(isSameSearch(sp('a=1'), sp('a=2'))).toBe(false);
  });
});

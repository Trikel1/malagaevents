import { describe, it, expect } from 'vitest';
import {
  getMadridDateKey,
  mergeCalendarEntries,
  groupCalendarEntries,
} from './calendarEntries';
import type { Event, EventOccurrence } from '@/types';

const makeEvent = (over: Partial<Event> & Pick<Event, 'id' | 'start_at'>): Event => ({
  title: 't',
  description: '',
  category: 'music',
  venue_name: 'v',
  address: '',
  is_free: false,
  source_type: 'official_feed',
  status: 'published',
  created_at: '2026-07-01T00:00:00.000Z',
  ...over,
});

const makeOcc = (over: Partial<EventOccurrence> & Pick<EventOccurrence, 'id' | 'event_id' | 'start_datetime'>): EventOccurrence => ({
  created_at: '2026-07-01T00:00:00.000Z',
  updated_at: '2026-07-01T00:00:00.000Z',
  ...over,
});

describe('getMadridDateKey', () => {
  it('resolves UTC->Madrid day rollover correctly', () => {
    // 22:30Z on 2026-07-14 is 00:30 in Madrid on 2026-07-15
    expect(getMadridDateKey('2026-07-14T22:30:00Z')).toBe('2026-07-15');
    // 21:00Z on 2026-07-14 is 23:00 in Madrid on 2026-07-14
    expect(getMadridDateKey('2026-07-14T21:00:00Z')).toBe('2026-07-14');
  });

  it('handles winter offset correctly', () => {
    // 22:30Z on 2026-01-10 is 23:30 in Madrid on 2026-01-10 (winter, +1h)
    expect(getMadridDateKey('2026-01-10T22:30:00Z')).toBe('2026-01-10');
    // 23:30Z on 2026-01-10 is 00:30 in Madrid on 2026-01-11
    expect(getMadridDateKey('2026-01-10T23:30:00Z')).toBe('2026-01-11');
  });
});

describe('mergeCalendarEntries', () => {
  it('never duplicates an event that already has an occurrence', () => {
    const ev = makeEvent({ id: 'e1', start_at: '2026-07-15T18:00:00Z' });
    const occ = makeOcc({
      id: 'o1',
      event_id: 'e1',
      start_datetime: '2026-07-15T18:00:00Z',
      event: ev,
    });

    const merged = mergeCalendarEntries([occ], [ev]);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe('o1');
    expect(merged[0].isSynthetic).toBeUndefined();
  });

  it('projects an event without occurrence into a synthetic entry', () => {
    const ev = makeEvent({ id: 'e2', start_at: '2026-07-20T20:00:00Z', end_at: '2026-07-20T22:00:00Z' });

    const merged = mergeCalendarEntries([], [ev]);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe('event:e2:2026-07-20T20:00:00Z');
    expect(merged[0].event_id).toBe('e2');
    expect(merged[0].start_datetime).toBe('2026-07-20T20:00:00Z');
    expect(merged[0].end_datetime).toBe('2026-07-20T22:00:00Z');
    expect(merged[0].isSynthetic).toBe(true);
  });

  it('merges real occurrences and synthetic entries sorted by start', () => {
    const evOccOnly = makeEvent({ id: 'a', start_at: '2026-07-10T10:00:00Z' });
    const evSyntheticOnly = makeEvent({ id: 'b', start_at: '2026-07-05T09:00:00Z' });
    const occ = makeOcc({
      id: 'occ-a',
      event_id: 'a',
      start_datetime: '2026-07-10T10:00:00Z',
      event: evOccOnly,
    });

    const merged = mergeCalendarEntries([occ], [evOccOnly, evSyntheticOnly]);
    expect(merged).toHaveLength(2);
    expect(merged[0].event_id).toBe('b');
    expect(merged[1].event_id).toBe('a');
  });
});

describe('groupCalendarEntries', () => {
  it('groups entries by Madrid date key even across UTC day boundary', () => {
    const evLateUtc = makeEvent({ id: 'e1', start_at: '2026-07-14T22:30:00Z' }); // Madrid 15th
    const evEarlyUtc = makeEvent({ id: 'e2', start_at: '2026-07-15T05:00:00Z' }); // Madrid 15th
    const evOtherDay = makeEvent({ id: 'e3', start_at: '2026-07-16T09:00:00Z' }); // Madrid 16th

    const merged = mergeCalendarEntries([], [evLateUtc, evEarlyUtc, evOtherDay]);
    const grouped = groupCalendarEntries(merged);

    expect(Object.keys(grouped).sort()).toEqual(['2026-07-15', '2026-07-16']);
    expect(grouped['2026-07-15']).toHaveLength(2);
    expect(grouped['2026-07-16']).toHaveLength(1);
  });
});

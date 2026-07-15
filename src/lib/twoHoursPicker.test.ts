import { describe, it, expect } from 'vitest';
import { pickTwoHoursEvents, type TwoHoursEvent } from './twoHoursPicker';

const NOW = Date.parse('2026-07-15T10:00:00Z');

const iso = (d: Date | number) => new Date(d).toISOString();
const inMin = (m: number) => iso(NOW + m * 60_000);

function mk(over: Partial<TwoHoursEvent> & { id: string; start_at: string }): TwoHoursEvent {
  return {
    title: 'Evento ' + over.id,
    venue_name: 'Sala',
    end_at: null,
    is_free: null,
    is_family_friendly: null,
    ...over,
  };
}

describe('pickTwoHoursEvents', () => {
  it('excludes events that already started', () => {
    const events = [
      mk({ id: 'a', start_at: inMin(-10), end_at: inMin(50) }),
      mk({ id: 'b', start_at: inMin(15), end_at: inMin(90) }),
    ];
    const r = pickTwoHoursEvents(events, { nowMs: NOW, budgetMinutes: 120, horizon: 'now' });
    expect(r.fits.map((e) => e.id)).toEqual(['b']);
  });

  it('only counts as "fits" when end_at exists AND duration <= budget', () => {
    const events = [
      mk({ id: 'noEnd', start_at: inMin(30) }), // no end_at → unconfirmed
      mk({ id: 'ok', start_at: inMin(30), end_at: inMin(130) }), // 100 min
      mk({ id: 'tooLong', start_at: inMin(20), end_at: inMin(200) }), // 180 min > 120
    ];
    const r = pickTwoHoursEvents(events, { nowMs: NOW, budgetMinutes: 120, horizon: 'now' });
    expect(r.fits.map((e) => e.id)).toEqual(['ok']);
    expect(r.unconfirmed.map((e) => e.id)).toEqual(['noEnd']);
  });

  it('accepts exact-boundary duration equal to budget', () => {
    const events = [mk({ id: 'edge', start_at: inMin(30), end_at: inMin(150) })]; // exactly 120
    const r = pickTwoHoursEvents(events, { nowMs: NOW, budgetMinutes: 120, horizon: 'now' });
    expect(r.fits.map((e) => e.id)).toEqual(['edge']);
  });

  it('produces a stable order (start_at asc, id asc as tiebreaker) and caps to 3', () => {
    const shared = inMin(45);
    const events = [
      mk({ id: 'c', start_at: shared, end_at: inMin(90) }),
      mk({ id: 'a', start_at: shared, end_at: inMin(90) }),
      mk({ id: 'b', start_at: shared, end_at: inMin(90) }),
      mk({ id: 'd', start_at: shared, end_at: inMin(90) }),
      mk({ id: 'e', start_at: inMin(10), end_at: inMin(60) }),
    ];
    const r = pickTwoHoursEvents(events, { nowMs: NOW, budgetMinutes: 120, horizon: 'now' });
    expect(r.fits.map((e) => e.id)).toEqual(['e', 'a', 'b']);
  });

  it('applies free and family filters without inference', () => {
    const events = [
      mk({ id: 'paidFam', start_at: inMin(15), end_at: inMin(60), is_free: false, is_family_friendly: true }),
      mk({ id: 'freeAdult', start_at: inMin(15), end_at: inMin(60), is_free: true }),
      mk({ id: 'freeFam', start_at: inMin(15), end_at: inMin(60), is_free: true, is_family_friendly: true }),
    ];
    const r = pickTwoHoursEvents(events, {
      nowMs: NOW,
      budgetMinutes: 120,
      horizon: 'now',
      onlyFree: true,
      onlyFamily: true,
    });
    expect(r.fits.map((e) => e.id)).toEqual(['freeFam']);
  });

  it('ignores distance when user coords are missing (no invented location)', () => {
    const events = [
      mk({ id: 'far', start_at: inMin(20), end_at: inMin(60), lat: 36.7, lng: -4.4 }),
      mk({ id: 'noCoords', start_at: inMin(20), end_at: inMin(60) }),
    ];
    const r = pickTwoHoursEvents(events, { nowMs: NOW, budgetMinutes: 120, horizon: 'now' });
    for (const e of r.fits) expect(e.distanceKm).toBeNull();
  });

  it('drops events outside the horizon window', () => {
    const events = [
      mk({ id: 'inWindow', start_at: inMin(30), end_at: inMin(60) }),
      mk({ id: 'past', start_at: inMin(200), end_at: inMin(240) }), // > 120 window
    ];
    const r = pickTwoHoursEvents(events, { nowMs: NOW, budgetMinutes: 120, horizon: 'now' });
    expect(r.fits.map((e) => e.id)).toEqual(['inWindow']);
  });
});

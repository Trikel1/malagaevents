import { describe, it, expect } from 'vitest';
import { toCoordNumber, toLatLng, lookupVenueCoords, resolvePoint } from './venueCoords';

describe('toCoordNumber', () => {
  it('rejects null, undefined and empty string instead of turning them into 0', () => {
    expect(toCoordNumber(null, 90)).toBeNull();
    expect(toCoordNumber(undefined, 90)).toBeNull();
    expect(toCoordNumber('', 90)).toBeNull();
  });

  it('rejects non-finite and out-of-range values', () => {
    expect(toCoordNumber(NaN, 90)).toBeNull();
    expect(toCoordNumber(Infinity, 90)).toBeNull();
    expect(toCoordNumber(120, 90)).toBeNull();
    expect(toCoordNumber('abc', 180)).toBeNull();
  });

  it('accepts numeric strings from the database', () => {
    expect(toCoordNumber('36.7213', 90)).toBeCloseTo(36.7213);
  });
});

describe('toLatLng', () => {
  it('never accepts 0,0', () => {
    expect(toLatLng(0, 0)).toBeNull();
    expect(toLatLng(null, null)).toBeNull();
  });

  it('requires both values', () => {
    expect(toLatLng(36.72, null)).toBeNull();
  });

  it('returns a valid pair', () => {
    expect(toLatLng('36.7213', '-4.4214')).toEqual({ lat: 36.7213, lng: -4.4214 });
  });
});

describe('lookupVenueCoords', () => {
  it('matches an exact curated venue name', () => {
    expect(lookupVenueCoords('Teatro Cervantes')).not.toBeNull();
  });

  it('does not guess from a partial name', () => {
    expect(lookupVenueCoords('Teatro')).toBeNull();
    expect(lookupVenueCoords('Teatro Cervantes de Sevilla')).toBeNull();
  });

  it('returns null for unknown venues instead of inventing a point', () => {
    expect(lookupVenueCoords('Bar desconocido 42')).toBeNull();
    expect(lookupVenueCoords(null)).toBeNull();
  });
});

describe('resolvePoint', () => {
  it('prefers the record coordinates and reports them as exact', () => {
    expect(resolvePoint({ lat: 36.5, lng: -4.5, venueName: 'Teatro Cervantes' })).toEqual({
      lat: 36.5,
      lng: -4.5,
      precision: 'exact',
    });
  });

  it('falls back to the joined venue coordinates', () => {
    expect(resolvePoint({ lat: null, lng: null, venueLat: 36.6, venueLng: -4.4 })).toEqual({
      lat: 36.6,
      lng: -4.4,
      precision: 'exact',
    });
  });

  it('uses the curated catalogue only as approximate', () => {
    const p = resolvePoint({ venueName: 'La Térmica' });
    expect(p?.precision).toBe('approximate');
  });

  it('returns null when nothing is verified — no invented pin', () => {
    expect(resolvePoint({ lat: null, lng: null, venueName: 'Local sin datos' })).toBeNull();
  });
});

import { describe, it, expect } from 'vitest';
import { madridDay, madridWeekEnd, isWithinScope } from './mapTimeScope';

describe('mapTimeScope', () => {
  it('formats dates in Europe/Madrid', () => {
    // 2026-08-18T23:30Z is already 2026-08-19 in Madrid (UTC+2)
    expect(madridDay('2026-08-18T23:30:00Z')).toBe('2026-08-19');
  });

  it('closes the week on Sunday', () => {
    expect(madridWeekEnd('2026-08-18')).toBe('2026-08-23'); // Tuesday -> Sunday
    expect(madridWeekEnd('2026-08-23')).toBe('2026-08-23'); // Sunday -> itself
  });

  it('keeps undated items in scope', () => {
    expect(isWithinScope(null, 'today')).toBe(true);
  });

  it('filters by day inclusively', () => {
    const now = new Date('2026-08-18T10:00:00Z');
    expect(isWithinScope('2026-08-18T20:00:00Z', 'today', now)).toBe(true);
    expect(isWithinScope('2026-08-19T20:00:00Z', 'today', now)).toBe(false);
    expect(isWithinScope('2026-08-23T20:00:00Z', 'week', now)).toBe(true);
    expect(isWithinScope('2026-08-24T20:00:00Z', 'week', now)).toBe(false);
    expect(isWithinScope('2026-08-24T20:00:00Z', 'all', now)).toBe(true);
  });
});

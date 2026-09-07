import { describe, it, expect } from 'vitest';
import {
  madridDayKey,
  madridDayOfWeek,
  madridPresetRange,
  formatMadrid,
  sanitizeIlikeTerm,
} from './madridTime';

describe('madridTime', () => {
  it('uses the Madrid calendar day, not UTC, late at night (summer, UTC+2)', () => {
    // 2026-07-15 22:30 UTC is already 2026-07-16 in Madrid.
    expect(madridDayKey(new Date('2026-07-15T22:30:00Z'))).toBe('2026-07-16');
  });

  it('uses the Madrid calendar day in winter (UTC+1)', () => {
    expect(madridDayKey(new Date('2026-01-15T23:30:00Z'))).toBe('2026-01-16');
    expect(madridDayKey(new Date('2026-01-15T22:30:00Z'))).toBe('2026-01-15');
  });

  it('today range covers exactly the Madrid day (DST aware)', () => {
    const [start, end] = madridPresetRange('today', new Date('2026-07-15T10:00:00Z'));
    expect(start.toISOString()).toBe('2026-07-14T22:00:00.000Z'); // 00:00 CEST
    expect(end.toISOString()).toBe('2026-07-15T22:00:00.000Z');

    const [wStart, wEnd] = madridPresetRange('today', new Date('2026-01-15T10:00:00Z'));
    expect(wStart.toISOString()).toBe('2026-01-14T23:00:00.000Z'); // 00:00 CET
    expect(wEnd.toISOString()).toBe('2026-01-15T23:00:00.000Z');
  });

  it('spans the DST change without losing or duplicating a day', () => {
    // Spring forward: 2026-03-29 in Spain.
    const [start, end] = madridPresetRange('thisWeek', new Date('2026-03-26T12:00:00Z'));
    expect(start.toISOString()).toBe('2026-03-25T23:00:00.000Z');
    expect(end.toISOString()).toBe('2026-04-01T22:00:00.000Z');
  });

  it('weekend on a Friday covers Fri+Sat+Sun', () => {
    const friday = new Date('2026-07-17T09:00:00Z');
    expect(madridDayOfWeek(friday)).toBe(5);
    const [start, end] = madridPresetRange('weekend', friday);
    expect(start.toISOString()).toBe('2026-07-16T22:00:00.000Z'); // Fri 00:00
    expect(end.toISOString()).toBe('2026-07-19T22:00:00.000Z'); // Mon 00:00
  });

  it('weekend on a Tuesday jumps to the coming Friday', () => {
    const tuesday = new Date('2026-07-14T09:00:00Z');
    expect(madridDayOfWeek(tuesday)).toBe(2);
    const [start] = madridPresetRange('weekend', tuesday);
    expect(start.toISOString()).toBe('2026-07-16T22:00:00.000Z');
  });

  it('weekend late on Sunday night still shows Sunday, not next Friday', () => {
    // 2026-07-19 21:00 UTC = Sunday 23:00 in Madrid.
    const sundayNight = new Date('2026-07-19T21:00:00Z');
    expect(madridDayOfWeek(sundayNight)).toBe(0);
    const [start, end] = madridPresetRange('weekend', sundayNight);
    expect(start.toISOString()).toBe('2026-07-18T22:00:00.000Z');
    expect(end.toISOString()).toBe('2026-07-19T22:00:00.000Z');
  });

  it('formats event times in Madrid regardless of device timezone', () => {
    expect(formatMadrid('2026-07-15T19:30:00Z', 'HH:mm')).toBe('21:30');
    expect(formatMadrid('2026-01-15T19:30:00Z', 'HH:mm')).toBe('20:30');
  });

  it('strips PostgREST or() delimiters from search terms', () => {
    expect(sanitizeIlikeTerm('rock, pop (2026)')).toBe('rock pop 2026');
    expect(sanitizeIlikeTerm('100% teatro')).toBe('100 teatro');
  });
});

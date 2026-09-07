import { describe, it, expect } from 'vitest';
import {
  parseSpanishDateToMadrid,
  madridWallTimeToDate,
} from '../../supabase/functions/_shared/ingestion/dates';

describe('ingestion date parsing (Europe/Madrid)', () => {
  it('keeps the date-only unknown-hour convention (UTC midnight, no invented 20:00)', () => {
    expect(parseSpanishDateToMadrid('2026-09-12')!.toISOString()).toBe('2026-09-12T00:00:00.000Z');
    expect(parseSpanishDateToMadrid('12 de septiembre de 2026')!.toISOString()).toBe('2026-09-12T00:00:00.000Z');
    expect(parseSpanishDateToMadrid('12/09/2026')!.toISOString()).toBe('2026-09-12T00:00:00.000Z');
  });

  it('reads timezone-less ISO as Madrid wall time in summer (CEST, +02:00)', () => {
    expect(parseSpanishDateToMadrid('2026-09-12T22:00')!.toISOString()).toBe('2026-09-12T20:00:00.000Z');
    expect(parseSpanishDateToMadrid('2026-09-12T22:00:00')!.toISOString()).toBe('2026-09-12T20:00:00.000Z');
  });

  it('reads timezone-less ISO as Madrid wall time in winter (CET, +01:00)', () => {
    expect(parseSpanishDateToMadrid('2026-01-15T20:30')!.toISOString()).toBe('2026-01-15T19:30:00.000Z');
  });

  it('preserves explicit offsets and Z exactly as declared', () => {
    expect(parseSpanishDateToMadrid('2026-09-12T22:00:00+02:00')!.toISOString()).toBe('2026-09-12T20:00:00.000Z');
    expect(parseSpanishDateToMadrid('2026-09-12T20:00:00Z')!.toISOString()).toBe('2026-09-12T20:00:00.000Z');
  });

  it('rejects non-existent calendar days instead of rolling them over', () => {
    expect(parseSpanishDateToMadrid('2026-02-30')).toBeNull();
    expect(parseSpanishDateToMadrid('2025-02-29')).toBeNull();
    expect(parseSpanishDateToMadrid('30/02/2026')).toBeNull();
    expect(parseSpanishDateToMadrid('30 de febrero de 2026')).toBeNull();
    expect(parseSpanishDateToMadrid('2026-13-01')).toBeNull();
  });

  it('accepts real leap days and Spanish forms with time', () => {
    expect(parseSpanishDateToMadrid('2028-02-29')!.toISOString()).toBe('2028-02-29T00:00:00.000Z');
    expect(parseSpanishDateToMadrid('12 de julio de 2026 20:30')!.toISOString()).toBe('2026-07-12T18:30:00.000Z');
  });

  it('rejects impossible clock times and unparseable input', () => {
    expect(parseSpanishDateToMadrid('2026-09-12T25:00')).toBeNull();
    expect(parseSpanishDateToMadrid('12/09/2026 25:00')).toBeNull();
    expect(parseSpanishDateToMadrid('proximamente')).toBeNull();
    expect(parseSpanishDateToMadrid('')).toBeNull();
    expect(parseSpanishDateToMadrid(null)).toBeNull();
  });

  it('converts Madrid wall time to UTC across the DST boundary', () => {
    expect(madridWallTimeToDate(2026, 3, 28, 12, 0).toISOString()).toBe('2026-03-28T11:00:00.000Z');
    expect(madridWallTimeToDate(2026, 3, 29, 12, 0).toISOString()).toBe('2026-03-29T10:00:00.000Z');
  });
});

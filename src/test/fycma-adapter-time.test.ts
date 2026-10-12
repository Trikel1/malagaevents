import { describe, it, expect } from 'vitest';
import { normalizeFycmaEvent, mapCategory } from '../../supabase/functions/_shared/adapters/fycma';

const base = { id: 1, title: 'Revolver', url: 'https://fycma.com/evento/revolver/' };

describe('FYCMA times', () => {
  it('Revolver 12-dic 21:00 Madrid → 20:00Z', () => {
    const r = normalizeFycmaEvent({ ...base, start_date: '2026-12-12 21:00:00', utc_start_date: '2026-12-12 20:00:00' });
    expect(r.normalized?.startAt).toBe('2026-12-12T20:00:00.000Z');
  });
  it('wall-time fallback is also correct in winter', () => {
    const r = normalizeFycmaEvent({ ...base, start_date: '2026-12-12 21:00:00' });
    expect(r.normalized?.startAt).toBe('2026-12-12T20:00:00.000Z');
  });
  it('congress 15–16 oct keeps its end date (summer time)', () => {
    const r = normalizeFycmaEvent({ ...base, start_date: '2026-10-15 09:00:00', end_date: '2026-10-16 18:00:00' });
    expect(r.normalized?.startAt).toBe('2026-10-15T07:00:00.000Z');
    expect(r.normalized?.endAt).toBe('2026-10-16T16:00:00.000Z');
    expect(r.normalized?.isMultiDay).toBe(true);
  });
  it('AGRITECH 4–5 nov all-day: day sentinels, last day inclusive', () => {
    const r = normalizeFycmaEvent({ ...base, title: 'AGRITECH', all_day: true,
      start_date: '2026-11-04 00:00:00', end_date: '2026-11-05 23:59:59',
      utc_start_date: '2026-11-03 23:00:00', utc_end_date: '2026-11-05 22:59:59' });
    expect(r.normalized?.startAt).toBe('2026-11-04T00:00:00.000Z');
    expect(r.normalized?.endAt).toBe('2026-11-05T00:00:00.000Z');
    expect(r.normalized?.timeAssumed).toBe(true);
    expect(r.normalized?.isMultiDay).toBe(true);
  });
  it('invalid UTC values fall back to valid wall time without throwing', () => {
    for (const bad of ['2026-02-30 20:00:00', '2026-12-12 25:00:00', 'garbage', '2026-12-12 20:00:00xyz']) {
      const r = normalizeFycmaEvent({ ...base, start_date: '2026-12-12 21:00:00', utc_start_date: bad, utc_end_date: bad });
      expect(r.ok).toBe(true);
      expect(r.normalized?.startAt).toBe('2026-12-12T20:00:00.000Z');
      expect((r.normalized?.raw as { utcFallback: string[] }).utcFallback).toEqual(['start', 'end']);
    }
  });
  it('impossible wall start is rejected, not thrown', () => {
    const r = normalizeFycmaEvent({ ...base, start_date: '2026-02-30 21:00:00', utc_start_date: 'x' });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('bad_start_date');
  });
  it('end before start is dropped', () => {
    const r = normalizeFycmaEvent({ ...base, start_date: '2026-12-12 21:00:00', end_date: '2026-12-12 19:00:00' });
    expect(r.normalized?.endAt).toBeNull();
  });
});

describe('FYCMA titles and categories', () => {
  it('decodes HTML entities in title as plain text', () => {
    const r = normalizeFycmaEvent({ ...base, title: 'Foro Tech &#038; Talento &#8211; Edición &amp; más', start_date: '2026-10-15 09:00:00' });
    expect(r.normalized?.title).toBe('Foro Tech & Talento – Edición & más');
  });
  it('maps official categories and ignores auxiliary ones', () => {
    const aux = { name: 'Entrada o inscripción disponible' };
    expect(mapCategory([aux, { name: 'Conciertos' }])).toBe('music');
    expect(mapCategory([{ name: 'Congresos' }, aux])).toBe('conferences');
    expect(mapCategory([{ name: 'Jornadas' }])).toBe('conferences');
    expect(mapCategory([{ name: 'Ferias' }])).toBe('exhibitions');
    expect(mapCategory([{ name: 'Otros Eventos' }])).toBe('other');
    expect(mapCategory([aux])).toBe('other');
  });
});

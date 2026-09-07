/**
 * Regressions for the legacy cultural ingestion path (sync-events).
 *
 * The bugs reproduced here were real: an absent hour became 20:00, a
 * timezone-less ISO was read as UTC (the official Olías event published for
 * 12/09/2026 at 22:00 Málaga was stored as 22:00Z), a missing year rolled the
 * date to the next one, and an event with no usable date was still written
 * with `now` as its start.
 */
import { describe, it, expect } from 'vitest';
import {
  resolveOccurrenceDate,
  resolveOccurrences,
  isUnknownHour,
} from '../../supabase/functions/_shared/ingestion/occurrences';
import { canonicalizeRow } from '../../supabase/functions/_shared/adapters/ayto-malaga-csv';

describe('legacy occurrence date resolution', () => {
  it('stores the official Olías 12 Sep 2026 22:00 Málaga start as 20:00Z', () => {
    expect(resolveOccurrenceDate('2026-09-12T22:00')!.toISOString()).toBe(
      '2026-09-12T20:00:00.000Z',
    );
    expect(resolveOccurrenceDate('12/09/2026', '22:00')!.toISOString()).toBe(
      '2026-09-12T20:00:00.000Z',
    );
  });

  it('applies the winter offset (CET) to the same wall time', () => {
    expect(resolveOccurrenceDate('15/01/2026', '20:30')!.toISOString()).toBe(
      '2026-01-15T19:30:00.000Z',
    );
  });

  it('preserves an explicit UTC or offset published by the source', () => {
    expect(resolveOccurrenceDate('2026-09-12T22:00:00Z')!.toISOString()).toBe(
      '2026-09-12T22:00:00.000Z',
    );
    expect(resolveOccurrenceDate('2026-09-12T22:00:00+02:00')!.toISOString()).toBe(
      '2026-09-12T20:00:00.000Z',
    );
    // A separate time field never overrides an instant the source declared.
    expect(resolveOccurrenceDate('2026-09-12T22:00:00Z', '18:00')!.toISOString()).toBe(
      '2026-09-12T22:00:00.000Z',
    );
  });

  it('never invents 20:00 or 21:00 when the source publishes no hour', () => {
    const parsed = resolveOccurrenceDate('12/09/2026')!;
    expect(parsed.toISOString()).toBe('2026-09-12T00:00:00.000Z');
    expect(isUnknownHour(parsed)).toBe(true);
  });

  it('rejects impossible dates and times instead of rolling them over', () => {
    expect(resolveOccurrenceDate('30/02/2026', '20:00')).toBeNull();
    expect(resolveOccurrenceDate('2026-13-01')).toBeNull();
    expect(resolveOccurrenceDate('12/09/2026', '25:00')).toBeNull();
  });

  it('rejects a day/month with no year rather than guessing the next one', () => {
    expect(resolveOccurrenceDate('12/09')).toBeNull();
    expect(resolveOccurrenceDate('12/09', '21:00')).toBeNull();
  });
});

describe('occurrence set resolution before any write', () => {
  it('reports zero usable occurrences so nothing is written', () => {
    const res = resolveOccurrences([{ date: '12/09' }, { date: '30/02/2026' }]);
    expect(res.valid).toHaveLength(0);
    expect(res.earliest).toBeNull();
    expect(res.skipped).toBe(2);
  });

  it('keeps the earliest real occurrence when the first one is invalid', () => {
    const res = resolveOccurrences([
      { date: '30/02/2026', time: '20:00' },
      { date: '20/09/2026', time: '19:00' },
      { date: '14/09/2026', time: '18:00' },
    ]);
    expect(res.skipped).toBe(1);
    expect(res.valid).toHaveLength(2);
    expect(res.earliest!.start.toISOString()).toBe('2026-09-14T16:00:00.000Z');
  });

  it('does not persist an end earlier than or equal to its start', () => {
    const res = resolveOccurrences([
      { date: '12/09/2026', time: '22:00', end_time: '21:00' },
      { date: '13/09/2026', time: '19:00', end_time: '19:00' },
    ]);
    expect(res.valid.map((o) => o.end)).toEqual([null, null]);
    const good = resolveOccurrences([
      { date: '12/09/2026', time: '19:00', end_time: '21:30' },
    ]);
    expect(good.valid[0].end!.toISOString()).toBe('2026-09-12T19:30:00.000Z');
  });
});

describe('malaga open data CSV row canonicalisation', () => {
  const row = (extra: Record<string, string>) => ({
    NOMBRE: 'Concierto en Olías',
    F_INICIO: '2026-09-12T22:00',
    EQP_DESCRIPCION: 'Centro Ciudadano',
    ...extra,
  });

  it('reads a timezone-less official start as Madrid wall time', () => {
    const out = canonicalizeRow(row({}), 'https://datosabiertos.malaga.eu/x.csv');
    expect(out!.startAt).toBe('2026-09-12T20:00:00.000Z');
  });

  it('keeps a real interval as one event with start and end', () => {
    const out = canonicalizeRow(
      row({ F_FIN: '2026-09-14T22:00' }),
      'https://datosabiertos.malaga.eu/x.csv',
    );
    expect(out!.startAt).toBe('2026-09-12T20:00:00.000Z');
    expect(out!.endAt).toBe('2026-09-14T20:00:00.000Z');
  });

  it('drops an end that is not after the start', () => {
    const out = canonicalizeRow(
      row({ F_FIN: '2026-09-12T21:00' }),
      'https://datosabiertos.malaga.eu/x.csv',
    );
    expect(out!.endAt).toBeNull();
  });

  it('rejects an impossible published date', () => {
    const out = canonicalizeRow(
      { NOMBRE: 'Evento', F_INICIO: '2026-02-30' },
      'https://datosabiertos.malaga.eu/x.csv',
    );
    expect(out).toBeNull();
  });
});

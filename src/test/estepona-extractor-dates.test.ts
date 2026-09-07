/**
 * Regression for the concrete case that produced the wrong hours stored for
 * Teatro Auditorio Felipe VI (Estepona), ingested through the Tribe/The Events
 * Calendar extractor in `sync-events`.
 *
 * Shape produced by that extractor for the Estepona feed:
 *   occurrences: [{ date: '2026-09-12', time: '21:00' }]
 * The theatre publishes "12 de septiembre – 21.00h", i.e. Málaga wall time.
 * The stored value used to be 21:00Z (23:00 in Málaga). It must be 19:00Z.
 */
import { describe, it, expect } from 'vitest';
import { parseSpanishDate } from '../../supabase/functions/sync-events/parse-date';

describe('Teatro Auditorio Felipe VI (Estepona) — hours from the Tribe extractor', () => {
  it('reads "12 de septiembre – 21.00h" (summer time) as 19:00Z, not 21:00Z', () => {
    expect(parseSpanishDate('2026-09-12', '21:00')!.toISOString()).toBe(
      '2026-09-12T19:00:00.000Z',
    );
  });

  it('applies the winter offset to a November 21.00h show', () => {
    expect(parseSpanishDate('2026-11-21', '21:00')!.toISOString()).toBe(
      '2026-11-21T20:00:00.000Z',
    );
  });

  it('handles the half-hour form published by the theatre (20.30h)', () => {
    expect(parseSpanishDate('2027-10-09', '20.30')!.toISOString()).toBe(
      '2027-10-09T18:30:00.000Z',
    );
  });

  it('keeps the instant when the feed writes an explicit offset', () => {
    expect(parseSpanishDate('2026-09-12T21:00:00+02:00')!.toISOString()).toBe(
      '2026-09-12T19:00:00.000Z',
    );
    expect(parseSpanishDate('2026-09-12T21:00:00Z')!.toISOString()).toBe(
      '2026-09-12T21:00:00.000Z',
    );
  });

  it('does not invent an hour when the feed only publishes the day', () => {
    expect(parseSpanishDate('2026-09-12')!.toISOString()).toBe('2026-09-12T00:00:00.000Z');
  });

  it('rejects impossible values instead of wrapping them', () => {
    expect(parseSpanishDate('2026-02-30', '21:00')).toBeNull();
    expect(parseSpanishDate('2026-09-12', '25:00')).toBeNull();
  });
});

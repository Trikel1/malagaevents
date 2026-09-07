import { describe, expect, it } from 'vitest';
import { discoverIcsUrls } from '../../supabase/functions/_shared/sports-sync/adapters/html';
import { sportsIcsDateToIso } from '../../supabase/functions/_shared/sports-sync/adapters/ics-date';
import { parseSportsIcs } from '../../supabase/functions/_shared/sports-sync/adapters/ics';
import type { IcsDateTime } from '../../supabase/functions/_shared/adapters/lib/ics';

const local = (iso: string, tzid: string | null = 'Europe/Madrid'): IcsDateTime =>
  ({ raw: iso, iso, tzid, kind: 'date-time-local' });

const utcStamp = () => new Date(Date.now() + 7 * 86400000).toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');

describe('sports calendar source integrity', () => {
  it('discovers the official Unicaja calendar endpoint without a .ics extension', () => {
    expect(discoverIcsUrls('<a href="/calendario/ics">Descargar Calendario (ics)</a>', 'https://www.unicajabaloncesto.com/calendario'))
      .toEqual(['https://www.unicajabaloncesto.com/calendario/ics']);
  });
  it('supports declared calendar MIME types and HTML query escaping', () => {
    expect(discoverIcsUrls('<link type="text/calendar" href="/export?club=1&amp;year=2026"/>', 'https://example.com'))
      .toEqual(['https://example.com/export?club=1&year=2026']);
  });
  it('rejects executable and credential-bearing calendar URLs', () => {
    expect(discoverIcsUrls('<a type="text/calendar" href="javascript:alert(1)">x</a><a href="https://user:pass@example.com/x.ics">y</a>', 'https://example.com'))
      .toEqual([]);
  });
  it.each([
    ['2026-07-15T21:00:00', '2026-07-15T19:00:00.000Z'],
    ['2026-01-15T21:00:00', '2026-01-15T20:00:00.000Z'],
    ['2026-03-29T03:30:00', '2026-03-29T01:30:00.000Z'],
    ['2026-10-25T03:30:00', '2026-10-25T02:30:00.000Z'],
  ])('converts Madrid wall time %s with the actual offset', (input, expected) => {
    expect(sportsIcsDateToIso(local(input))).toBe(expected);
  });
  it('honors a source timezone outside Madrid', () => {
    expect(sportsIcsDateToIso(local('2026-07-15T21:00:00', 'Europe/London'))).toBe('2026-07-15T20:00:00.000Z');
  });
  it('uses Madrid for a floating time without TZID', () => {
    expect(sportsIcsDateToIso(local('2026-07-15T21:00:00', null))).toBe('2026-07-15T19:00:00.000Z');
  });
  it.each(['2026-02-30T20:00:00', '2026-07-15T25:00:00', '2026-03-29T02:30:00', '2026-10-25T02:30:00'])('does not invent an instant for invalid or ambiguous %s', iso => {
    expect(sportsIcsDateToIso(local(iso))).toBeNull();
  });
  it('rejects an unsupported TZID instead of guessing', () => {
    expect(sportsIcsDateToIso(local('2026-07-15T21:00:00', 'Not/AZone'))).toBeNull();
  });
  it('preserves the application date-only convention', () => {
    expect(sportsIcsDateToIso({ raw: '20260715', iso: '2026-07-15', tzid: null, kind: 'date' })).toBe('2026-07-15T00:00:00.000Z');
  });
  it('rejects impossible date-only values', () => {
    expect(sportsIcsDateToIso({ raw: '20260230', iso: '2026-02-30', tzid: null, kind: 'date' })).toBeNull();
  });
  it('preserves valid UTC instants', () => {
    expect(sportsIcsDateToIso({ raw: '20260715T190000Z', iso: '2026-07-15T19:00:00Z', tzid: null, kind: 'date-time-utc' })).toBe('2026-07-15T19:00:00.000Z');
  });
  it('does not invent a venue when the calendar has no LOCATION', () => {
    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0',
      'BEGIN:VEVENT', 'SUMMARY:Unicaja - C.B. Canarias', 'UID:test-1',
      'DTSTART:' + utcStamp(), 'END:VEVENT', 'END:VCALENDAR',
    ].join('\r\n');
    const [event] = parseSportsIcs(ics, {
      sourceName: 'Unicaja Baloncesto',
      sourceUrl: 'https://www.unicajabaloncesto.com/calendario/ics',
      defaultMunicipality: 'Málaga',
      defaultCategory: 'basketball',
    });
    expect(event.venue_name).toBe('');
    expect(event.address).toBeNull();
  });
});

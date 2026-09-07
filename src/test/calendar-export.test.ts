/**
 * RFC 5545 regressions for the event calendar export.
 *
 * The old inline template produced files that broke on import: no UID, no
 * DTSTAMP, LF line endings, unescaped commas and semicolons, unfolded long
 * lines, an invented two-hour duration and a fake 00:00 start for events whose
 * hour the source never published.
 */
import { describe, it, expect } from 'vitest';
import {
  buildEventIcs,
  escapeIcsText,
  foldIcsLine,
  icsFileName,
} from '../lib/calendarExport';

const NOW = new Date('2026-09-01T10:00:00Z');
const base = {
  id: 'evt-1',
  title: 'Concierto',
  description: 'Descripción',
  start_at: '2026-09-12T20:00:00.000Z', // 22:00 Madrid
  end_at: null as string | null,
  venue_name: 'Teatro Cervantes',
  address: 'Calle Ramos Marín, s/n',
};

const lines = (ics: string) => ics.split('\r\n');

describe('ics text handling', () => {
  it('escapes backslashes, semicolons, commas and newlines', () => {
    expect(escapeIcsText('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne');
  });

  it('folds long lines at 75 octets counting UTF-8 bytes', () => {
    const folded = foldIcsLine('SUMMARY:' + 'áé'.repeat(60));
    const parts = folded.split('\r\n');
    expect(parts.length).toBeGreaterThan(1);
    for (const part of parts) {
      expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
    }
    expect(parts.slice(1).every((p) => p.startsWith(' '))).toBe(true);
  });

  it('produces a filesystem-safe download name', () => {
    expect(icsFileName('Concierto de Málaga, 2026')).toBe('concierto-de-malaga-2026.ics');
    expect(icsFileName(null)).toBe('evento.ics');
  });
});

describe('buildEventIcs', () => {
  it('uses CRLF, a stable UID and a DTSTAMP', () => {
    const ics = buildEventIcs(base, { now: NOW })!;
    expect(ics.includes('\r\n')).toBe(true);
    expect(ics.split('\n').every((l) => l === '' || l.endsWith('\r'))).toBe(true);
    expect(lines(ics)).toContain('UID:evt-1@malagaevents.lovable.app');
    expect(lines(ics)).toContain('DTSTAMP:20260901T100000Z');
    // A second export of the same event is identical → no duplicate on import.
    expect(buildEventIcs(base, { now: NOW })).toBe(ics);
  });

  it('exports the real UTC instant for a timed event', () => {
    const ics = buildEventIcs(base, { now: NOW })!;
    expect(lines(ics)).toContain('DTSTART:20260912T200000Z');
  });

  it('never invents a two-hour duration when no end is published', () => {
    const ics = buildEventIcs(base, { now: NOW })!;
    expect(ics).not.toContain('DTEND');
  });

  it('writes DTEND only when the source published a later end', () => {
    const withEnd = buildEventIcs({ ...base, end_at: '2026-09-12T22:30:00.000Z' }, { now: NOW })!;
    expect(lines(withEnd)).toContain('DTEND:20260912T223000Z');
    const badEnd = buildEventIcs({ ...base, end_at: '2026-09-12T19:00:00.000Z' }, { now: NOW })!;
    expect(badEnd).not.toContain('DTEND');
  });

  it('exports an unknown-hour event as an all-day VALUE=DATE entry', () => {
    const ics = buildEventIcs(
      { ...base, start_at: '2026-09-12T00:00:00.000Z' },
      { now: NOW },
    )!;
    expect(lines(ics)).toContain('DTSTART;VALUE=DATE:20260912');
    expect(ics).not.toContain('DTSTART:2026');
  });

  it('makes the end of an inclusive all-day range exclusive', () => {
    const ics = buildEventIcs(
      {
        ...base,
        start_at: '2026-09-12T00:00:00.000Z',
        end_at: '2026-09-14T00:00:00.000Z',
      },
      { now: NOW },
    )!;
    expect(lines(ics)).toContain('DTEND;VALUE=DATE:20260915');
  });

  it('escapes the location and summary', () => {
    const ics = buildEventIcs({ ...base, title: 'Jazz, blues; más' }, { now: NOW })!;
    expect(ics).toContain('SUMMARY:Jazz\\, blues\\; más');
    expect(ics).toContain('LOCATION:Teatro Cervantes\\, Calle Ramos Marín\\, s/n');
  });

  it('is null-safe with a missing description, venue and address', () => {
    const ics = buildEventIcs(
      { id: 'x', title: 'Sin datos', description: null, start_at: base.start_at },
      { now: NOW },
    )!;
    expect(ics).not.toContain('DESCRIPTION:');
    expect(ics).not.toContain('LOCATION:');
    expect(lines(ics)).toContain('END:VCALENDAR');
  });

  it('returns null instead of exporting an unusable date', () => {
    expect(buildEventIcs({ ...base, start_at: 'no-es-fecha' }, { now: NOW })).toBeNull();
  });
});

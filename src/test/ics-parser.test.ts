import { describe, it, expect } from 'vitest';
import { parseIcs } from '../../supabase/functions/_shared/adapters/lib/ics';

// Line folds intentionally present. CRLF used per RFC 5545.
const ICS_FIXTURE = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//Test//EN',
  'METHOD:PUBLISH',
  'BEGIN:VEVENT',
  'UID:evt-1@example.test',
  'DTSTAMP:20260713T090000Z',
  'DTSTART;TZID=Europe/Madrid:20260801T210000',
  'DTEND;TZID=Europe/Madrid:20260801T230000',
  'SUMMARY:Concierto: verano\\, jazz\\n Teatro',
  'DESCRIPTION:Primera línea\\nSegunda línea con \\; punto y coma',
  'LOCATION:Teatro Cervantes\\, Málaga',
  'URL:https://example.test/evt/1',
  'STATUS:CONFIRMED',
  'CATEGORIES:Música,Jazz',
  'GEO:36.7213;-4.4213',
  'RRULE:FREQ=WEEKLY;BYDAY=FR',
  'X-CUSTOM-ID:12345',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:evt-2@example.test',
  'DTSTART;VALUE=DATE:20260815',
  'DTEND;VALUE=DATE:20260816',
  'SUMMARY:Día festivo',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:evt-3@example.test',
  'DTSTART:20260901T180000Z',
  'SUMMARY:Evento con des',
  ' cripción folded',
  'END:VEVENT',
  'END:VCALENDAR',
  '',
].join('\r\n');

describe('parseIcs', () => {
  const cal = parseIcs(ICS_FIXTURE);

  it('reads calendar-level metadata', () => {
    expect(cal.prodId).toBe('-//Test//EN');
    expect(cal.version).toBe('2.0');
    expect(cal.method).toBe('PUBLISH');
    expect(cal.events).toHaveLength(3);
  });

  it('parses a full VEVENT with TZID, escapes and RRULE', () => {
    const e = cal.events[0];
    expect(e.uid).toBe('evt-1@example.test');
    expect(e.summary).toBe('Concierto: verano, jazz\n Teatro');
    expect(e.description).toBe('Primera línea\nSegunda línea con ; punto y coma');
    expect(e.location).toBe('Teatro Cervantes, Málaga');
    expect(e.url).toBe('https://example.test/evt/1');
    expect(e.status).toBe('CONFIRMED');
    expect(e.categories).toEqual(['Música', 'Jazz']);
    expect(e.rrule).toBe('FREQ=WEEKLY;BYDAY=FR');
    expect(e.dtstart?.kind).toBe('date-time-local');
    expect(e.dtstart?.tzid).toBe('Europe/Madrid');
    expect(e.dtstart?.iso).toBe('2026-08-01T21:00:00');
    expect(e.dtend?.iso).toBe('2026-08-01T23:00:00');
    expect(e.geo).toEqual({ lat: 36.7213, lng: -4.4213 });
    expect(e.raw['X-CUSTOM-ID']).toBe('12345');
  });

  it('parses VALUE=DATE all-day events', () => {
    const e = cal.events[1];
    expect(e.dtstart?.kind).toBe('date');
    expect(e.dtstart?.iso).toBe('2026-08-15');
    expect(e.dtend?.iso).toBe('2026-08-16');
  });

  it('parses UTC date-times and unfolds folded lines', () => {
    const e = cal.events[2];
    expect(e.dtstart?.kind).toBe('date-time-utc');
    expect(e.dtstart?.iso).toBe('2026-09-01T18:00:00Z');
    expect(e.summary).toBe('Evento con descripción folded');
  });

  it('returns an empty calendar for empty input without throwing', () => {
    const empty = parseIcs('');
    expect(empty.events).toEqual([]);
  });

  it('ignores unparseable dates gracefully', () => {
    const bad = parseIcs(
      [
        'BEGIN:VCALENDAR',
        'BEGIN:VEVENT',
        'UID:x',
        'DTSTART:not-a-date',
        'SUMMARY:x',
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n'),
    );
    expect(bad.events[0].dtstart?.iso).toBeNull();
    expect(bad.events[0].dtstart?.raw).toBe('not-a-date');
  });
});

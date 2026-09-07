// RFC 5545 iCalendar export for a single event.
//
// The previous inline template was invalid in several ways: it never escaped
// commas, semicolons or backslashes, it never folded long lines (so a long
// description broke the file), it used LF instead of CRLF, it had no UID or
// DTSTAMP (so re-importing duplicated the entry), and it invented a two-hour
// duration plus a fake 00:00 start for events whose hour is unknown.
//
// Rules applied here:
// - timed events export the real UTC instant (…Z);
// - DTEND is written only when the source actually published an end;
// - an event with an unknown hour exports as an all-day VALUE=DATE entry, and
//   an inclusive date range gets the RFC-mandated exclusive DTEND;
// - every text value is escaped and folded at 75 octets (UTF-8 aware).

import { hasExplicitTime } from './eventTime';
import { formatMadrid } from './madridTime';

export interface CalendarEventInput {
  id?: string | null;
  title?: string | null;
  description?: string | null;
  start_at: string;
  end_at?: string | null;
  venue_name?: string | null;
  address?: string | null;
  url?: string | null;
}

/** RFC 5545 §3.3.11 text escaping. */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/**
 * Fold a content line at 75 octets (RFC 5545 §3.1). Folding must count bytes,
 * not characters: an accented Spanish title is longer than it looks.
 */
export function foldIcsLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;

  const out: string[] = [];
  let current = '';
  let currentBytes = 0;
  let limit = 75;

  for (const char of Array.from(line)) {
    const size = encoder.encode(char).length;
    if (currentBytes + size > limit) {
      out.push(current);
      current = ' ' + char; // continuation lines start with a space
      currentBytes = 1 + size;
      limit = 75;
    } else {
      current += char;
      currentBytes += size;
    }
  }
  if (current) out.push(current);
  return out.join('\r\n');
}

const pad = (n: number) => String(n).padStart(2, '0');

/** UTC form: 20260912T200000Z */
export function toIcsUtcStamp(date: Date): string {
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

/** Local date form for all-day entries, based on the Madrid calendar day. */
export function toIcsDate(date: Date): string {
  return formatMadrid(date, 'yyyyMMdd');
}

function addOneDay(date: Date): Date {
  return new Date(date.getTime() + 86400000);
}

export interface BuildIcsOptions {
  /** Injected in tests so DTSTAMP is deterministic. */
  now?: Date;
  /** Absolute link to the event page. */
  url?: string | null;
  /** Domain used for the UID suffix. */
  uidDomain?: string;
}

/**
 * Build the .ics payload. Returns null when the event has no usable start —
 * we never export a calendar entry with an invented date.
 */
export function buildEventIcs(
  event: CalendarEventInput,
  options: BuildIcsOptions = {},
): string | null {
  const start = new Date(event.start_at);
  if (Number.isNaN(start.getTime())) return null;

  const now = options.now ?? new Date();
  const uid = `${event.id ?? toIcsUtcStamp(start)}@${options.uidDomain ?? 'malagaevents.lovable.app'}`;
  const timed = hasExplicitTime(event.start_at);

  const end = event.end_at ? new Date(event.end_at) : null;
  const validEnd = end && !Number.isNaN(end.getTime()) && end.getTime() > start.getTime()
    ? end
    : null;

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MalagaEvents//ES',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${toIcsUtcStamp(now)}`,
  ];

  if (timed) {
    lines.push(`DTSTART:${toIcsUtcStamp(start)}`);
    // No fabricated duration: an unknown end simply is not written.
    if (validEnd) lines.push(`DTEND:${toIcsUtcStamp(validEnd)}`);
  } else {
    lines.push(`DTSTART;VALUE=DATE:${toIcsDate(start)}`);
    // Inclusive published range → exclusive DTEND, as RFC 5545 requires.
    if (validEnd) lines.push(`DTEND;VALUE=DATE:${toIcsDate(addOneDay(validEnd))}`);
  }

  lines.push(`SUMMARY:${escapeIcsText(event.title ?? '')}`);

  const description = (event.description ?? '').trim();
  if (description) lines.push(`DESCRIPTION:${escapeIcsText(description)}`);

  const location = [event.venue_name, event.address]
    .map((part) => (part ?? '').trim())
    .filter(Boolean)
    .join(', ');
  if (location) lines.push(`LOCATION:${escapeIcsText(location)}`);

  const url = options.url ?? event.url;
  if (url) lines.push(`URL:${escapeIcsText(url)}`);

  lines.push('END:VEVENT', 'END:VCALENDAR');

  return lines.map(foldIcsLine).join('\r\n') + '\r\n';
}

/** Filesystem-safe download name derived from the title. */
export function icsFileName(title: string | null | undefined): string {
  const base = (title ?? 'evento')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]+/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60)
    .toLowerCase();
  return `${base || 'evento'}.ics`;
}

// Europe/Madrid time helpers (DST-safe).
//
// Previously both `useEvents` and `useEventsOptimized` claimed "Europe/Madrid"
// but computed day boundaries with device-local `Date` getters, so a user in
// another timezone (or a device with a wrong clock) got the wrong "hoy" /
// "este finde" window. These helpers derive the calendar day in Madrid and
// convert its boundaries back to UTC instants.

import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import type { Locale } from 'date-fns';

export const MADRID_TZ = 'Europe/Madrid';

/** Calendar day (YYYY-MM-DD) of an instant, in Europe/Madrid. */
export const madridDayKey = (date: Date = new Date()): string =>
  formatInTimeZone(date, MADRID_TZ, 'yyyy-MM-dd');

/** Day of week in Madrid (0 = Sunday … 6 = Saturday). */
export const madridDayOfWeek = (date: Date = new Date()): number =>
  Number(formatInTimeZone(date, MADRID_TZ, 'i')) % 7; // ISO 1..7 (Mon..Sun) -> 0..6

/** UTC instant for 00:00 Madrid time of the given calendar day key. */
export const madridDayStart = (dayKey: string): Date =>
  fromZonedTime(`${dayKey}T00:00:00`, MADRID_TZ);

/** Add whole calendar days to a YYYY-MM-DD key. */
export const addDaysToKey = (dayKey: string, days: number): string => {
  const [y, m, d] = dayKey.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
};

/** UTC instant for the start of "today" in Madrid. */
export const madridStartOfToday = (now: Date = new Date()): Date =>
  madridDayStart(madridDayKey(now));

export type MadridPreset = 'today' | 'tomorrow' | 'thisWeek' | 'next30' | 'weekend';

/**
 * [start, end) UTC range for a preset, anchored on the Madrid calendar.
 * Weekend rules preserved from the previous implementation:
 * Fri/Sat/Sun show the remaining weekend days, Mon-Thu show the next weekend.
 */
export const madridPresetRange = (
  preset: MadridPreset,
  now: Date = new Date()
): [Date, Date] => {
  const today = madridDayKey(now);
  const at = (offset: number) => madridDayStart(addDaysToKey(today, offset));
  switch (preset) {
    case 'today':
      return [at(0), at(1)];
    case 'tomorrow':
      return [at(1), at(2)];
    case 'thisWeek':
      return [at(0), at(7)];
    case 'next30':
      return [at(0), at(30)];
    case 'weekend': {
      const dow = madridDayOfWeek(now);
      if (dow === 0) return [at(0), at(1)];
      if (dow === 6) return [at(0), at(2)];
      if (dow === 5) return [at(0), at(3)];
      const daysUntilFri = (5 - dow + 7) % 7;
      return [at(daysUntilFri), at(daysUntilFri + 3)];
    }
  }
};

/** Format an instant in Madrid local time (never the device timezone). */
export const formatMadrid = (
  iso: string | Date,
  pattern: string,
  locale?: Locale
): string => formatInTimeZone(iso, MADRID_TZ, pattern, { locale });

/**
 * PostgREST `or()` values are comma/parenthesis delimited. Raw user input with
 * `,` `(` `)` used to break the filter (400) or alter its meaning. Strip the
 * delimiters and `%`/`\` wildcards before interpolating into an ilike pattern.
 */
export const sanitizeIlikeTerm = (term: string): string =>
  term.replace(/[,()\\%*]/g, ' ').replace(/\s+/g, ' ').trim();

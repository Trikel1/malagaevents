import { madridDayKeyFromIso } from './dates.ts';
import { isUnknownHour, type ResolvedOccurrence } from './occurrences.ts';

export interface StoredCocheraOccurrence {
  event_id: string;
  start_datetime: string;
  buy_url: string | null;
}

/** Only the Cochera caller may use this: its listing gives a day and a precise event page. */
export function retainPublishedHour(incoming: {
  eventId: string; start: string; buyUrl: string | null; hourUnknown: boolean;
}, existing: StoredCocheraOccurrence[]): boolean {
  const date = new Date(incoming.start);
  if (!incoming.hourUnknown || !incoming.eventId || !incoming.buyUrl?.trim()
    || !Number.isFinite(date.getTime()) || !isUnknownHour(date) || date.getUTCMilliseconds() !== 0) return false;
  // The established UTC-midnight sentinel stores the calendar day, not a Madrid instant.
  const day = date.toISOString().slice(0, 10);
  return existing.some(row => {
    if (row.event_id !== incoming.eventId || row.buy_url !== incoming.buyUrl) return false;
    const known = new Date(row.start_datetime);
    return Number.isFinite(known.getTime()) && !isUnknownHour(known) && madridDayKeyFromIso(known) === day;
  });
}

/** Map weaker listing timestamps to the earliest already-published time on that exact page/day. */
export function planCocheraHourRetention(eventId: string, buyUrl: string | null,
  incoming: ResolvedOccurrence[], existing: StoredCocheraOccurrence[]): Map<string, Date> {
  const retained = new Map<string, Date>();
  for (const occurrence of incoming) {
    const key = occurrence.start.toISOString();
    const input = { eventId, buyUrl, start: key, hourUnknown: occurrence.hourUnknown };
    const matches = existing.filter(row => retainPublishedHour(input, [row]))
      .map(row => new Date(row.start_datetime)).sort((a, b) => a.getTime() - b.getTime());
    if (matches.length) retained.set(key, matches[0]);
  }
  return retained;
}

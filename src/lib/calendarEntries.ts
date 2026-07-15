import { formatInTimeZone } from 'date-fns-tz';
import type { Event, EventOccurrence } from '@/types';

export const CALENDAR_TIMEZONE = 'Europe/Madrid';

/**
 * Returns the yyyy-MM-dd key for a given ISO date in the Europe/Madrid timezone.
 * This is the canonical grouping key used everywhere in the calendar.
 */
export function getMadridDateKey(iso: string | Date): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  return formatInTimeZone(date, CALENDAR_TIMEZONE, 'yyyy-MM-dd');
}

/**
 * A "calendar entry" is the unified projection used by the calendar view.
 * It re-uses the EventOccurrence shape so that consumers do not need to
 * differentiate between real occurrences and synthetic projections from
 * `events.start_at`.
 */
export type CalendarEntry = EventOccurrence & {
  /** True when this entry is a synthetic projection from events.start_at */
  isSynthetic?: boolean;
};

/**
 * Merge real occurrences with a projection built from published events.
 *
 * Rules:
 *  - Every real occurrence is preserved as-is.
 *  - For each event that has NO real occurrence within the requested range,
 *    one synthetic entry is produced from start_at / end_at.
 *  - Never duplicate an event_id that already has at least one occurrence.
 *  - Synthetic id is deterministic: `event:${event.id}:${event.start_at}`.
 */
export function mergeCalendarEntries(
  occurrences: EventOccurrence[],
  events: Event[],
): CalendarEntry[] {
  const eventIdsWithOccurrence = new Set<string>();
  for (const occ of occurrences) {
    if (occ.event_id) eventIdsWithOccurrence.add(occ.event_id);
  }

  const synthetic: CalendarEntry[] = [];
  for (const ev of events) {
    if (!ev?.id || !ev.start_at) continue;
    if (eventIdsWithOccurrence.has(ev.id)) continue;

    synthetic.push({
      id: `event:${ev.id}:${ev.start_at}`,
      event_id: ev.id,
      start_datetime: ev.start_at,
      end_datetime: ev.end_at,
      created_at: ev.created_at ?? ev.start_at,
      updated_at: ev.updated_at ?? ev.start_at,
      event: ev,
      isSynthetic: true,
    });
  }

  const merged: CalendarEntry[] = [...occurrences, ...synthetic];
  merged.sort((a, b) => a.start_datetime.localeCompare(b.start_datetime));
  return merged;
}

/**
 * Group calendar entries by Europe/Madrid date key (yyyy-MM-dd).
 */
export function groupCalendarEntries(
  entries: CalendarEntry[],
): Record<string, CalendarEntry[]> {
  const grouped: Record<string, CalendarEntry[]> = {};
  for (const entry of entries) {
    const key = getMadridDateKey(entry.start_datetime);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(entry);
  }
  return grouped;
}

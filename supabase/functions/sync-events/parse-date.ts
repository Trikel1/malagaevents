/**
 * Date parsing for the legacy cultural extractors (sync-events).
 *
 * Extracted into its own module so the concrete cases that produced wrong
 * hours in production (Teatro Auditorio Felipe VI, Estepona) can be covered by
 * regression tests without booting the whole edge function.
 *
 * Rules (no exceptions):
 * - never invent an hour: a source that only publishes a day yields the
 *   "day known, hour unknown" sentinel (UTC midnight of that Madrid day);
 * - never roll a date to the next year without the source stating the year;
 * - an explicit offset or Z in the source is preserved as the real instant;
 * - a wall clock with no offset is Europe/Madrid time, never UTC;
 * - impossible dates and times (30/02, 25:00) are rejected, never wrapped.
 */
import { parseSpanishDateToMadrid, madridWallTimeToDate } from '../_shared/ingestion/dates.ts';

const ISO_WITH_EXPLICIT_ZONE =
  /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/i;
const DATE_TEXT_HAS_CLOCK = /\d{1,2}\s*[:h]\s*\d{2}/i;

export function parseClockText(timeText?: string): { hour: number; minute: number } | null {
  if (!timeText) return null;
  const match = timeText.match(/(\d{1,2})(?:[:.](\d{2}))?\s*h?/i);
  if (!match) return null;
  const hour = parseInt(match[1], 10);
  const minute = match[2] ? parseInt(match[2], 10) : 0;
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

export function parseSpanishDate(dateText: string, timeText?: string): Date | null {
  if (!dateText) return null;
  const raw = String(dateText).trim();
  if (!raw) return null;

  const base = parseSpanishDateToMadrid(raw);
  if (!base) return null;

  // The source declared a real instant (Z or ±hh:mm): keep it untouched.
  if (ISO_WITH_EXPLICIT_ZONE.test(raw)) return base;
  // The clock travelled with the date text: already read as Madrid wall time.
  if (DATE_TEXT_HAS_CLOCK.test(raw)) return base;

  const clock = parseClockText(timeText);
  // No hour anywhere: keep the unknown-hour sentinel rather than fabricate one.
  if (!clock) return base;

  return madridWallTimeToDate(
    base.getUTCFullYear(),
    base.getUTCMonth() + 1,
    base.getUTCDate(),
    clock.hour,
    clock.minute,
  );
}

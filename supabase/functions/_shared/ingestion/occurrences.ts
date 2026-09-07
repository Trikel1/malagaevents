// Occurrence resolution for the legacy cultural ingestion path.
//
// Purpose: never write an event row whose start_at was invented. Before any
// database write the caller resolves the raw occurrences published by the
// source; if none of them is usable the event is skipped and reported.
//
// Rules:
// - the hour comes from the source or stays unknown (UTC midnight sentinel);
// - an end earlier than (or equal to) its start is dropped, not persisted;
// - unparseable / impossible dates are counted as skipped, never repaired.

import { parseSpanishDateToMadrid, madridWallTimeToDate } from "./dates.ts";

export interface RawOccurrence {
  date: string;
  time?: string;
  end_time?: string;
}

export interface ResolvedOccurrence {
  start: Date;
  end: Date | null;
  /** True when the source published a day but no hour. */
  hourUnknown: boolean;
}

export interface OccurrenceResolution {
  valid: ResolvedOccurrence[];
  /** Earliest usable start, or null when nothing is usable. */
  earliest: ResolvedOccurrence | null;
  skipped: number;
  reasons: string[];
}

const ISO_WITH_EXPLICIT_ZONE =
  /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/i;
const DATE_TEXT_HAS_CLOCK = /\d{1,2}\s*[:h]\s*\d{2}/i;

function parseClockText(timeText?: string): { hour: number; minute: number } | null {
  if (!timeText) return null;
  const match = String(timeText).match(/(\d{1,2})(?:[:.](\d{2}))?\s*h?/i);
  if (!match) return null;
  const hour = parseInt(match[1], 10);
  const minute = match[2] ? parseInt(match[2], 10) : 0;
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

/** True when the parsed value is the "day known, hour unknown" sentinel. */
export function isUnknownHour(date: Date): boolean {
  return (
    date.getUTCHours() === 0 &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0
  );
}

/**
 * Combine a source date text with an optional separate time text, applying the
 * strict Europe/Madrid rules. Returns null when nothing trustworthy remains.
 */
export function resolveOccurrenceDate(
  dateText: string,
  timeText?: string,
): Date | null {
  if (!dateText) return null;
  const raw = String(dateText).trim();
  if (!raw) return null;

  const base = parseSpanishDateToMadrid(raw);
  if (!base) return null;

  // Explicit instant published by the source: preserve it exactly.
  if (ISO_WITH_EXPLICIT_ZONE.test(raw)) return base;
  // The clock arrived inside the date text: already Madrid wall time.
  if (DATE_TEXT_HAS_CLOCK.test(raw)) return base;

  const hasTimeText = Boolean(timeText && String(timeText).trim());
  const clock = parseClockText(timeText);
  // No time field at all: the hour is legitimately unknown. A time field that
  // cannot be read (e.g. "25:00") is corrupt data, not an unknown hour.
  if (!clock) return hasTimeText ? null : base;

  return madridWallTimeToDate(
    base.getUTCFullYear(),
    base.getUTCMonth() + 1,
    base.getUTCDate(),
    clock.hour,
    clock.minute,
  );
}

/** Resolve every raw occurrence, reporting what had to be skipped and why. */
export function resolveOccurrences(
  occurrences: RawOccurrence[] | null | undefined,
): OccurrenceResolution {
  const valid: ResolvedOccurrence[] = [];
  const reasons: string[] = [];
  let skipped = 0;

  for (const occ of occurrences ?? []) {
    const start = resolveOccurrenceDate(occ?.date ?? "", occ?.time);
    if (!start) {
      skipped++;
      reasons.push(
        `unusable date "${occ?.date ?? ""}"${occ?.time ? ` ${occ.time}` : ""}`,
      );
      continue;
    }

    let end: Date | null = null;
    if (occ?.end_time) {
      const candidate = resolveOccurrenceDate(occ.date, occ.end_time);
      // An end at or before the start is not a range: drop it rather than
      // persist an impossible interval or guess a next-day rollover.
      if (candidate && candidate.getTime() > start.getTime()) {
        end = candidate;
      } else if (candidate) {
        reasons.push(`end before start for "${occ.date}" — end discarded`);
      }
    }

    valid.push({ start, end, hourUnknown: isUnknownHour(start) });
  }

  valid.sort((a, b) => a.start.getTime() - b.start.getTime());

  return { valid, earliest: valid[0] ?? null, skipped, reasons };
}

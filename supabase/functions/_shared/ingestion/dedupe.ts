// Dedupe helpers. The dedupe key MUST stay consistent with the SQL
// backfill formula:
//   sha256(normalizedTitle | normalizedVenue | normalizedLocality | YYYY-MM-DDTHH:mm)
// where the timestamp is expressed in Europe/Madrid wall-clock time.

import type { CanonicalEvent } from "./types.ts";
import { normalizeTitle, normalizeVenueName, normalizeLocality, stableHash } from "./normalize.ts";
import { formatMadridDedupeMinute, parseSpanishDateToMadrid } from "./dates.ts";

export async function generateEventDedupeKey(
  event: CanonicalEvent,
  canonicalVenueName?: string | null,
): Promise<string> {
  const date = parseSpanishDateToMadrid(event.startAt);
  if (!date) throw new Error("generateEventDedupeKey: invalid startAt");

  const parts = [
    normalizeTitle(event.title),
    normalizeVenueName(canonicalVenueName ?? event.venueName ?? ""),
    normalizeLocality(event.locality),
    formatMadridDedupeMinute(date),
  ].join("|");

  return await stableHash(parts);
}

/**
 * Build a small set of candidate dedupe keys with a ±N minute tolerance.
 * NOT used aggressively in Phase 2A — helper exists for future phases so
 * we can merge near-duplicates from different sources.
 */
export async function buildCandidateDedupeKeysWithTimeTolerance(
  event: CanonicalEvent,
  canonicalVenueName: string | null | undefined,
  toleranceMinutes = 15,
): Promise<string[]> {
  const date = parseSpanishDateToMadrid(event.startAt);
  if (!date) return [];

  const keys: string[] = [];
  const step = 60_000;
  for (let delta = -toleranceMinutes; delta <= toleranceMinutes; delta++) {
    const shifted = new Date(date.getTime() + delta * step);
    const shiftedEvent: CanonicalEvent = { ...event, startAt: shifted.toISOString() };
    keys.push(await generateEventDedupeKey(shiftedEvent, canonicalVenueName));
  }
  return Array.from(new Set(keys));
}

/**
 * Read-only lookup: does an event with any of the candidate dedupe keys
 * already exist in `public.events`? Returns matching rows (id + dedupe_key)
 * or an empty array. Does NOT mutate anything.
 */
export async function findExistingEventCandidates(
  supabase: {
    from: (table: string) => {
      select: (cols: string) => {
        in: (col: string, vals: string[]) => Promise<{ data: unknown; error: unknown }>;
      };
    };
  },
  dedupeKeys: string[],
): Promise<Array<{ id: string; dedupe_key: string }>> {
  if (dedupeKeys.length === 0) return [];
  const { data, error } = await supabase
    .from("events")
    .select("id, dedupe_key")
    .in("dedupe_key", dedupeKeys);
  if (error) return [];
  return (data as Array<{ id: string; dedupe_key: string }>) ?? [];
}

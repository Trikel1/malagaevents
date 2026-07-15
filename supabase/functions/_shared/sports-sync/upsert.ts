// Pure decision function: given a canonical event and the existing DB row (if any),
// return the action to take. Isolated from Supabase so vitest can drive it directly.

import type { CanonicalSportsEvent } from "./types.ts";
import { computeFingerprint, computePayloadHash } from "./fingerprint.ts";

export type ExistingRow = {
  id: string;
  raw_payload_hash: string | null;
  missed_syncs: number | null;
  status: string | null;
} | null;

export type UpsertDecision =
  | { action: "insert"; hash: string; fingerprint: string }
  | { action: "update"; hash: string; fingerprint: string; id: string }
  | { action: "unchanged"; id: string };

export async function decideUpsert(
  ev: CanonicalSportsEvent,
  existing: ExistingRow,
): Promise<UpsertDecision> {
  const hash = await computePayloadHash(ev);
  const fp = computeFingerprint(ev);
  if (!existing) return { action: "insert", hash, fingerprint: fp };
  if (existing.raw_payload_hash === hash && existing.status !== "cancelled_or_unpublished"
      && existing.status !== "missing_from_feed") {
    return { action: "unchanged", id: existing.id };
  }
  return { action: "update", hash, fingerprint: fp, id: existing.id };
}

/**
 * Given the set of external_ids seen in this run and the rows currently
 * attributed to `source_name`, decide which rows should have their
 * missed_syncs bumped and which should be marked as cancelled.
 *
 *   - JSON adapter → threshold 3, target status `cancelled_or_unpublished`
 *   - ICS  adapter → threshold 2, target status `missing_from_feed`
 */
export function decideDeactivations(
  seenKeys: Set<string>,
  candidates: Array<{ id: string; key: string; missed_syncs: number | null; status: string | null }>,
  threshold: number,
  targetStatus: "cancelled_or_unpublished" | "missing_from_feed",
): Array<{ id: string; nextMissed: number; nextStatus: string | null }> {
  const out: Array<{ id: string; nextMissed: number; nextStatus: string | null }> = [];
  for (const row of candidates) {
    if (seenKeys.has(row.key)) continue;
    const nextMissed = (row.missed_syncs ?? 0) + 1;
    const nextStatus = nextMissed >= threshold ? targetStatus : row.status;
    out.push({ id: row.id, nextMissed, nextStatus });
  }
  return out;
}

// Write-authorization gate for scrape-source.
//
// Extracted to a shared module so the exact same code is exercised both by
// the deployed Edge Function AND by vitest. Any drift between the two would
// be an immediate test failure.
//
// The write path REQUIRES all of these to hold simultaneously:
//   - body.writeEnabled === true
//   - body.dryRun === false
//   - source.enabled === true
//   - source.robots_ok === true
//   - source.write_confirmed_at IS NOT NULL
//   - source.adapter_key === adapter.key
//   - body.maxWrites <= MAX_WRITES_PER_RUN
// Otherwise the run is refused with `write_not_authorized` and NOTHING is
// written to public.events. Dry-run is the ONLY safe default.

import type { EventSourceRow } from "../ingestion/types.ts";

/** Hard cap on writes per single run — cannot be exceeded even if body asks for more. */
export const MAX_WRITES_PER_RUN = 50;

export type WriteAuth =
  | { ok: true; maxWrites: number }
  | { ok: false; reason: string };

export function authorizeWrite(
  body: { writeEnabled?: boolean; dryRun?: boolean; maxWrites?: number },
  source: EventSourceRow,
  adapterKey: string,
): WriteAuth {
  if (body.writeEnabled !== true) {
    return { ok: false, reason: "writeEnabled_false" };
  }
  if (body.dryRun !== false) {
    return { ok: false, reason: "dryRun_true" };
  }
  if (!source.enabled) return { ok: false, reason: "source_disabled" };
  if (!source.robots_ok) return { ok: false, reason: "robots_not_confirmed" };
  if (!source.write_confirmed_at) {
    return { ok: false, reason: "write_not_confirmed" };
  }
  if (source.adapter_key !== adapterKey) {
    return { ok: false, reason: "adapter_mismatch" };
  }
  const requested =
    typeof body.maxWrites === "number" && body.maxWrites > 0
      ? Math.floor(body.maxWrites)
      : MAX_WRITES_PER_RUN;
  if (requested > MAX_WRITES_PER_RUN) {
    return { ok: false, reason: "max_writes_exceeded" };
  }
  return { ok: true, maxWrites: requested };
}

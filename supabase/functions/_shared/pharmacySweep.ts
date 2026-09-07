/**
 * Write-safety rules for the pharmacy duty sweep (audit 2026-09-07).
 *
 * The `pharmacies_guard` table holds one province-wide snapshot per day. The
 * only safe destructive write is "replace the whole day after a complete and
 * fully successful sweep". Anything else must fail closed: a partial sweep
 * (single zone or `zonesLimit`) does not know the rest of the province, and a
 * full sweep with failed zones would replace complete data with incomplete
 * data.
 */

export interface SweepRequest {
  dryRun: boolean;
  onlyZoneId?: string;
  zonesLimit?: number;
}

export interface SweepOutcome {
  zonesFailed: number;
  rowCount: number;
}

export type SweepPlan =
  | { action: 'reject'; status: number; reason: string }
  | { action: 'no_write'; reason: string }
  | { action: 'replace_day' };

/** Validate the request shape before any outbound fetch. */
export function validateSweepRequest(req: SweepRequest): { ok: true } | { ok: false; status: number; error: string } {
  const partial = Boolean(req.onlyZoneId) || Boolean(req.zonesLimit);
  if (partial && !req.dryRun) {
    return {
      ok: false,
      status: 400,
      error:
        'Partial sweeps (zone / zonesLimit) are read-only. Re-run with dryRun=1, or run a full sweep to write.',
    };
  }
  if (req.zonesLimit !== undefined && (!Number.isInteger(req.zonesLimit) || req.zonesLimit < 1)) {
    return { ok: false, status: 400, error: 'zonesLimit must be a positive integer' };
  }
  return { ok: true };
}

/** Decide what to do with the collected rows once the sweep has finished. */
export function planSweepWrite(req: SweepRequest, outcome: SweepOutcome): SweepPlan {
  const invalid = validateSweepRequest(req);
  if (invalid.ok === false) return { action: 'reject', status: invalid.status, reason: invalid.error };
  if (req.dryRun) return { action: 'no_write', reason: 'dry_run' };
  if (outcome.rowCount === 0) return { action: 'no_write', reason: 'no_rows' };
  if (outcome.zonesFailed > 0) {
    return { action: 'no_write', reason: 'incomplete_sweep_failed_zones' };
  }
  return { action: 'replace_day' };
}

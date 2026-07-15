/**
 * "Tengo dos horas" — deterministic, explainable ranking.
 *
 * Rules:
 * - Only future events (start_at > now) are considered.
 * - "Fits" requires a real end_at and (end_at - start_at) <= budget.
 *   No estimation, no synthetic durations.
 * - Events without end_at are surfaced under "unconfirmed" (never affirmed as fitting).
 * - Distance is used ONLY as a tiebreaker when both userCoords and event coords exist.
 * - Sort is stable: (start_at asc, distanceKm asc if available, id asc).
 */

export type PickerHorizon = 'now' | 'today';

export interface TwoHoursEvent {
  id: string;
  title: string;
  start_at: string;
  end_at?: string | null;
  venue_name?: string | null;
  lat?: number | null;
  lng?: number | null;
  is_free?: boolean | null;
  is_family_friendly?: boolean | null;
  audience?: string | null;
  source?: string | null;
  source_ref?: string | null;
  updated_at?: string | null;
}

export interface PickerOptions {
  nowMs: number;
  budgetMinutes: 60 | 120 | 180;
  horizon: PickerHorizon;
  onlyFree?: boolean;
  onlyFamily?: boolean;
  userCoords?: { lat: number; lng: number } | null;
  limit?: number;
}

export interface RankedEvent extends TwoHoursEvent {
  startMs: number;
  endMs: number | null;
  durationMinutes: number | null;
  distanceKm: number | null;
  fits: boolean;
}

export interface PickerResult {
  fits: RankedEvent[];
  unconfirmed: RankedEvent[];
  totalConsidered: number;
}

const MS_MIN = 60_000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Haversine, km, deterministic. */
function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

function isFiniteCoord(lat: unknown, lng: unknown): lat is number {
  return typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng);
}

export function pickTwoHoursEvents(
  events: readonly TwoHoursEvent[],
  opts: PickerOptions,
): PickerResult {
  const { nowMs, budgetMinutes, horizon, onlyFree, onlyFamily, userCoords, limit = 3 } = opts;
  const budgetMs = budgetMinutes * MS_MIN;

  // Horizon window: "now" = next `budget`, "today" = end of same civil day (UTC-based here;
  // callers work in Europe/Madrid, but the same offset applies to both bounds, so ordering holds).
  let horizonEnd: number;
  if (horizon === 'now') {
    horizonEnd = nowMs + budgetMs;
  } else {
    const d = new Date(nowMs);
    const endOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();
    horizonEnd = Math.max(endOfDay, nowMs + budgetMs);
  }

  const useUserCoords = userCoords && isFiniteCoord(userCoords.lat, userCoords.lng);

  const ranked: RankedEvent[] = [];
  for (const e of events) {
    const startMs = Date.parse(e.start_at);
    if (!Number.isFinite(startMs)) continue;
    // Must be future — already-started events are excluded, even if within budget.
    if (startMs <= nowMs) continue;
    if (startMs > horizonEnd) continue;

    if (onlyFree && e.is_free !== true) continue;
    if (onlyFamily) {
      const family = e.is_family_friendly === true || e.audience === 'family' || e.audience === 'kids';
      if (!family) continue;
    }

    const endMs = e.end_at ? Date.parse(e.end_at) : NaN;
    const hasEnd = Number.isFinite(endMs);
    const durationMinutes = hasEnd ? Math.max(0, Math.round((endMs - startMs) / MS_MIN)) : null;

    // "Fits" = real end + (end - start) <= budget. Never inferred.
    const fits = hasEnd && endMs - startMs <= budgetMs && endMs > nowMs;

    let distanceKm: number | null = null;
    if (useUserCoords && isFiniteCoord(e.lat, e.lng)) {
      distanceKm = haversineKm(userCoords!, { lat: e.lat as number, lng: e.lng as number });
    }

    ranked.push({
      ...e,
      startMs,
      endMs: hasEnd ? endMs : null,
      durationMinutes,
      distanceKm,
      fits,
    });
  }

  const cmp = (a: RankedEvent, b: RankedEvent) => {
    if (a.startMs !== b.startMs) return a.startMs - b.startMs;
    const ad = a.distanceKm ?? Number.POSITIVE_INFINITY;
    const bd = b.distanceKm ?? Number.POSITIVE_INFINITY;
    if (ad !== bd) return ad - bd;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  };

  const fits = ranked.filter((r) => r.fits).sort(cmp).slice(0, limit);
  const unconfirmed = ranked.filter((r) => !r.fits && r.endMs === null).sort(cmp).slice(0, limit);

  return { fits, unconfirmed, totalConsidered: ranked.length };
}

export const _internal = { haversineKm, DAY_MS };

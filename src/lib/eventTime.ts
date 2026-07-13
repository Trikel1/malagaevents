// Shared helpers for rendering event start/end times.
//
// Problem: 623 legacy rows in `events` were ingested with `start_at` set to
// exactly `YYYY-MM-DD 00:00:00 UTC` (i.e. date only, no explicit time). When
// rendered in Europe/Madrid these appear as 01:00 (winter, UTC+1) or 02:00
// (summer, UTC+2). That is a data-shape issue, not a formatter bug.
//
// Until the legacy backfill is approved separately, we detect the "midnight
// UTC" sentinel and hide the fabricated hour, showing "Hora por confirmar"
// instead. Events with a real explicit time (any non-zero UTC hh/mm) render
// normally.

export function isMidnightUtc(iso: string | Date | null | undefined): boolean {
  if (!iso) return false;
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return false;
  return (
    d.getUTCHours() === 0 &&
    d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0
  );
}

/**
 * Returns whether the event's start time should be displayed to the user.
 * When false, the UI should show a "time to be confirmed" label instead of
 * a numeric HH:mm value.
 */
export function hasExplicitTime(iso: string | Date | null | undefined): boolean {
  return !!iso && !isMidnightUtc(iso);
}

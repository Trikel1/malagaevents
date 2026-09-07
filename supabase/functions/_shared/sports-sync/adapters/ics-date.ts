import type { IcsDateTime } from '../../adapters/lib/ics.ts';

/** Convert calendar wall time using its real zone, never a fixed winter offset. */
export function sportsIcsDateToIso(value: IcsDateTime | null): string | null {
  if (!value?.iso) return null;
  if (value.kind === 'date') {
    // Existing application contract: midnight UTC is a date with unknown hour.
    // Preserve the written calendar day instead of inventing a start time.
    const instant = new Date(`${value.iso}T00:00:00Z`);
    return Number.isFinite(instant.getTime()) && instant.toISOString().slice(0, 10) === value.iso
      ? instant.toISOString() : null;
  }
  if (value.kind === 'date-time-utc') {
    const instant = new Date(value.iso);
    return Number.isFinite(instant.getTime()) && instant.toISOString().slice(0, 19) + 'Z' === value.iso
      ? instant.toISOString() : null;
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(value.iso)) return null;
  const nominal = Date.parse(value.iso + 'Z');
  if (!Number.isFinite(nominal) || new Date(nominal).toISOString().slice(0, 19) !== value.iso) return null;
  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: value.tzid || 'Europe/Madrid', hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    const wallTime = (ms: number) => {
      const parts = Object.fromEntries(formatter.formatToParts(new Date(ms)).map(p => [p.type, p.value]));
      return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
    };
    // Probe both sides of a possible seasonal offset change, then round-trip.
    const offsets = new Set([-86400000, 0, 86400000].map(delta => {
      const sample = nominal + delta;
      return Date.parse(wallTime(sample) + 'Z') - sample;
    }));
    const candidates = [...offsets].map(offset => nominal - offset)
      .filter(instant => wallTime(instant) === value.iso).sort((a, b) => a - b);
    // A missing or ambiguous wall time cannot establish one reliable instant.
    return candidates.length === 1 ? new Date(candidates[0]).toISOString() : null;
  } catch {
    // Unknown TZID: skip instead of silently interpreting it as Madrid or UTC.
    return null;
  }
}

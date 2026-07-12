// Europe/Madrid date helpers for the ingestion engine.
// Rules:
// - never assume UTC; always convert to/from Europe/Madrid.
// - if parsing fails, return null (caller records an ingestion_error and skips).

const MADRID_TZ = "Europe/Madrid" as const;

const MONTHS_ES: Record<string, number> = {
  enero: 1, ene: 1,
  febrero: 2, feb: 2,
  marzo: 3, mar: 3,
  abril: 4, abr: 4,
  mayo: 5, may: 5,
  junio: 6, jun: 6,
  julio: 7, jul: 7,
  agosto: 8, ago: 8,
  septiembre: 9, sep: 9, sept: 9,
  octubre: 10, oct: 10,
  noviembre: 11, nov: 11,
  diciembre: 12, dic: 12,
};

/** Parse "12 de julio de 2026 20:30", "12/07/2026 20:30", ISO, etc. */
export function parseSpanishDateToMadrid(input: string | Date | null | undefined): Date | null {
  if (!input) return null;
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;

  const raw = String(input).trim();
  if (!raw) return null;

  // 1. Try native (ISO 8601 etc.)
  const native = new Date(raw);
  if (!isNaN(native.getTime()) && /\d{4}-\d{2}-\d{2}/.test(raw)) {
    return native;
  }

  // 2. Spanish long form: "12 de julio de 2026 20:30" or "12 julio 2026"
  const longRe = /(\d{1,2})\s+(?:de\s+)?([a-záéíóú]+)\s+(?:de\s+)?(\d{4})(?:[,\s]+(\d{1,2})[:h](\d{2}))?/i;
  const longMatch = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .match(longRe);
  if (longMatch) {
    const day = parseInt(longMatch[1], 10);
    const month = MONTHS_ES[longMatch[2]];
    const year = parseInt(longMatch[3], 10);
    const hour = longMatch[4] ? parseInt(longMatch[4], 10) : 20;
    const minute = longMatch[5] ? parseInt(longMatch[5], 10) : 0;
    if (month) return madridWallTimeToDate(year, month, day, hour, minute);
  }

  // 3. dd/mm/yyyy [hh:mm]
  const slashRe = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:[\s,]+(\d{1,2})[:h](\d{2}))?/;
  const slashMatch = raw.match(slashRe);
  if (slashMatch) {
    const day = parseInt(slashMatch[1], 10);
    const month = parseInt(slashMatch[2], 10);
    let year = parseInt(slashMatch[3], 10);
    if (year < 100) year += 2000;
    const hour = slashMatch[4] ? parseInt(slashMatch[4], 10) : 20;
    const minute = slashMatch[5] ? parseInt(slashMatch[5], 10) : 0;
    return madridWallTimeToDate(year, month, day, hour, minute);
  }

  return null;
}

/** Convert wall-clock time in Europe/Madrid to a UTC Date. */
export function madridWallTimeToDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): Date {
  // Construct as UTC first, then correct by the Madrid offset for that instant.
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const offsetMin = getMadridOffsetMinutes(utcGuess);
  return new Date(utcGuess.getTime() - offsetMin * 60_000);
}

/** Offset (in minutes) of Europe/Madrid vs UTC at the given instant. */
function getMadridOffsetMinutes(date: Date): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: MADRID_TZ,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
  const parts = fmt.formatToParts(date).reduce<Record<string, string>>((acc, p) => {
    if (p.type !== "literal") acc[p.type] = p.value;
    return acc;
  }, {});
  const asUtc = Date.UTC(
    parseInt(parts.year, 10),
    parseInt(parts.month, 10) - 1,
    parseInt(parts.day, 10),
    parseInt(parts.hour === "24" ? "0" : parts.hour, 10),
    parseInt(parts.minute, 10),
    parseInt(parts.second, 10),
  );
  return Math.round((asUtc - date.getTime()) / 60_000);
}

/** ISO string in Europe/Madrid, minute precision — used for dedupe. */
export function formatMadridDedupeMinute(date: Date): string {
  const fmt = new Intl.DateTimeFormat("sv-SE", {
    timeZone: MADRID_TZ,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
  // sv-SE gives "YYYY-MM-DD HH:mm"
  return fmt.format(date).replace(" ", "T");
}

/** Full ISO in UTC, safe to store in timestamptz columns. */
export function toMadridDateTime(input: string | Date): Date | null {
  return parseSpanishDateToMadrid(input);
}

export const MADRID_TIMEZONE = MADRID_TZ;

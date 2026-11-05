// Shared helpers for congress / convention-centre adapters
// (Palacio de Congresos Torremolinos, Marbella Congresos, Eventos UMA).
// Pure functions — unit-tested from vitest.

/** Offset in minutes of Europe/Madrid at a given UTC instant. */
function madridOffsetMinutes(utcMs: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Madrid",
    hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  }).formatToParts(new Date(utcMs));
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"));
  return Math.round((asUtc - utcMs) / 60000);
}

/** Converts a Europe/Madrid wall-clock time to a UTC ISO string (DST-safe). */
export function madridWallTimeToIso(y: number, m: number, d: number, hh = 0, mm = 0): string | null {
  if (![y, m, d, hh, mm].every(Number.isFinite)) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31 || hh > 23 || mm > 59) return null;
  const naive = Date.UTC(y, m - 1, d, hh, mm);
  let off = madridOffsetMinutes(naive - 60 * 60000);
  let utc = naive - off * 60000;
  off = madridOffsetMinutes(utc);
  utc = naive - off * 60000;
  const check = new Date(naive);
  if (check.getUTCDate() !== d) return null; // e.g. 31/02
  return new Date(utc).toISOString();
}

const MONTHS: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7,
  agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7,
  august: 8, september: 9, october: 10, november: 11, december: 12,
};

export type WallDate = { y: number; m: number; d: number; hh: number; mm: number; timeExplicit: boolean };

/** "29 octubre, 2026 09:00" / "29 October, 2026" */
export function parseSpanishLongDate(s: string): WallDate | null {
  const t = s.toLowerCase().replace(/\s+/g, " ").trim();
  const m = t.match(/(\d{1,2})\s+(?:de\s+)?([a-záéíóú]+),?\s+(?:de\s+)?(\d{4})(?:\s*[-,]?\s*(\d{1,2}):(\d{2}))?/);
  if (!m) return null;
  const month = MONTHS[m[2].normalize("NFD").replace(/[\u0300-\u036f]/g, "")];
  if (!month) return null;
  return {
    y: Number(m[3]), m: month, d: Number(m[1]),
    hh: m[4] ? Number(m[4]) : 0, mm: m[5] ? Number(m[5]) : 0,
    timeExplicit: !!m[4],
  };
}

/** "10/2/2027 20:00" or "26/11/2026" (day first). */
export function parseDmyDate(s: string): WallDate | null {
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (!m) return null;
  return {
    d: Number(m[1]), m: Number(m[2]), y: Number(m[3]),
    hh: m[4] ? Number(m[4]) : 0, mm: m[5] ? Number(m[5]) : 0,
    timeExplicit: !!m[4] && !(m[4] === "0" && m[5] === "00"),
  };
}

export function wallToIso(w: WallDate | null): string | null {
  if (!w) return null;
  return madridWallTimeToIso(w.y, w.m, w.d, w.timeExplicit ? w.hh : 0, w.timeExplicit ? w.mm : 0);
}

export function decodeHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/\s+/g, " ").trim();
}

/** Category inference tuned for convention-centre programmes. */
export function inferCongressCategory(text: string, hint?: string | null): string {
  const t = `${hint ?? ""} ${text}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (/(congreso|congress|conference|conferencia|jornada|simposio|symposium|seminario|summit|foro|forum|conf\b|workshop|encuentro profesional|expo ?congreso)/.test(t)) return "conferences";
  if (/(feria|expo\b|exposicion|salon|fair)/.test(t)) return "exhibitions";
  if (/(concierto|sinfonic|symphony|tribute|tributo|musical|orquesta)/.test(t)) return "music";
  if (/(infantil|familia|ninos|frozen|cuento)/.test(t)) return "kids";
  if (/(festival|fest\b)/.test(t)) return "festivals";
  if (/(espectaculo|teatro|danza|dance|circo)/.test(t)) return "theater";
  return "other";
}

export async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "MalagaConnectBot/1.0 (+https://malagaevents.lovable.app)", Accept: "text/html" },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.text();
}

/** True when the event has not finished yet (end or start >= now - 1 day). */
export function isUpcoming(startIso: string, endIso: string | null, now = Date.now()): boolean {
  const ref = Date.parse(endIso ?? startIso);
  return Number.isFinite(ref) && ref >= now - 24 * 3600 * 1000;
}

// Málaga · Datos Abiertos — Cultural Agenda CSV adapter (deterministic).
//
// Source: https://datosabiertos.malaga.eu/recursos/cultura/agenda/2026.csv
// Licence: CC BY 4.0. `robots.txt` allows `/recursos/` with Crawl-Delay: 10.
//
// This adapter is a corrected successor to `ayto-malaga-csv`. Compared to
// that one it:
//   1. Never fabricates a clock time from F_INICIO="… 00:00:00". Instead it
//      falls back to parsing HORARIO (e.g. "17 a 20 horas", "20:30",
//      "de 18 a 21 h"). If no explicit hour can be recovered, it emits
//      `startAt` at UTC midnight of the Madrid calendar date (the shared
//      "hora por confirmar" sentinel that `hasExplicitTime()` already
//      understands) and sets `timeAssumed=true`.
//   2. Extracts an end time from HORARIO when a range is given, and uses
//      F_FIN as endAt only when the source day range is non-trivial
//      (multi-day).
//   3. Emits a stable `externalId` (ID_EVENTO) so the ingestion layer can
//      collapse the multi-row-per-especialidad shape without touching the
//      current dedupe pipeline.
//
// SAFETY:
// - Pure function: returns CanonicalEvent[]. Zero DB access. No AI.
// - Never activates the source. `event_sources.enabled` remains false and
//   `authorizeWrite` still requires robots_ok + write_confirmed_at.

import type {
  AdapterContext,
  CanonicalEvent,
  SourceAdapter,
} from "../ingestion/types.ts";
import { type CsvRow, fetchCsv, parseCsv } from "./lib/csv.ts";
import { madridWallTimeToDate } from "../ingestion/dates.ts";

const DEFAULT_CSV_URL =
  "https://datosabiertos.malaga.eu/recursos/cultura/agenda/2026.csv";

// ── Header helpers ────────────────────────────────────────────────────────

function normHeader(h: string): string {
  return h.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .trim();
}

function pick(row: CsvRow, keys: string[]): string {
  const index = new Map<string, string>();
  for (const raw of Object.keys(row)) index.set(normHeader(raw), raw);
  for (const key of keys) {
    const raw = index.get(key);
    if (raw && row[raw] != null) {
      const v = String(row[raw]).trim();
      if (v) return v;
    }
  }
  return "";
}

// ── Date/time parsing ─────────────────────────────────────────────────────

interface CsvDate {
  y: number;
  m: number;
  d: number;
  hh: number;
  mm: number;
  hasClock: boolean;
}

/** Parse "DD/MM/YYYY[ HH:MM:SS]". `hasClock=false` when HH:MM:SS is 00:00:00 or absent. */
function parseCsvDate(raw: string): CsvDate | null {
  if (!raw) return null;
  const m = raw.trim().match(
    /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:[\sT]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/,
  );
  if (!m) return null;
  const d = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  let y = parseInt(m[3], 10);
  if (y < 100) y += 2000;
  const hh = m[4] ? parseInt(m[4], 10) : 0;
  const mm = m[5] ? parseInt(m[5], 10) : 0;
  const ss = m[6] ? parseInt(m[6], 10) : 0;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  // Treat "00:00:00" as "no clock" — the CSV encodes date-only rows this way.
  const hasClock = !!m[4] && (hh !== 0 || mm !== 0 || ss !== 0);
  return { y, m: mo, d, hh, mm, hasClock };
}

interface HorarioTime {
  startHh: number;
  startMm: number;
  endHh?: number;
  endMm?: number;
}

/**
 * Extract explicit clock times from the free-form HORARIO field.
 * Supported shapes (case/accent-insensitive):
 *   "17 a 20 horas"          → 17:00–20:00
 *   "de 17 a 20 h"           → 17:00–20:00
 *   "de 18:30 a 21:00"       → 18:30–21:00
 *   "20:30 h" / "20.30 h"    → 20:30
 *   "20 h" / "a las 20 h"    → 20:00
 *   "17-20 h"                → 17:00–20:00
 * Returns null when nothing usable is found.
 */
export function parseHorario(input: string): HorarioTime | null {
  if (!input) return null;
  const raw = input.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().trim();
  if (!raw) return null;

  // Ranges "HH[:MM] a HH[:MM]" / "HH[:MM]-HH[:MM]" (with optional "de" prefix)
  const range = raw.match(
    /(?:de\s+)?(\d{1,2})(?:[:.h](\d{2}))?\s*(?:a|-|hasta|–|—)\s*(\d{1,2})(?:[:.h](\d{2}))?/,
  );
  if (range) {
    const sh = parseInt(range[1], 10);
    const sm = range[2] ? parseInt(range[2], 10) : 0;
    const eh = parseInt(range[3], 10);
    const em = range[4] ? parseInt(range[4], 10) : 0;
    if (validClock(sh, sm) && validClock(eh, em)) {
      return { startHh: sh, startMm: sm, endHh: eh, endMm: em };
    }
  }

  // Single "HH:MM" / "HH.MM" / "HH h"
  const single = raw.match(/(?:a\s+las\s+)?(\d{1,2})(?:[:.h](\d{2}))?\s*h?/);
  if (single) {
    const sh = parseInt(single[1], 10);
    const sm = single[2] ? parseInt(single[2], 10) : 0;
    if (validClock(sh, sm)) return { startHh: sh, startMm: sm };
  }
  return null;
}

function validClock(hh: number, mm: number): boolean {
  return hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59;
}

/** UTC midnight of the Madrid calendar date `y-m-d`. Consumers treat this
 *  as the "hora por confirmar" sentinel via `hasExplicitTime()`. */
function madridDateOnlyToUtcMidnightIso(y: number, m: number, d: number): string {
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0)).toISOString();
}

// ── Canonicalisation ──────────────────────────────────────────────────────

export interface CanonicalizeMetrics {
  timeSourceInicio: number;
  timeSourceHorario: number;
  timeAssumed: number;
  rangedEndAt: number;
}

/** Pure. Returns null when required fields are missing. */
export function canonicalizeRow(
  row: CsvRow,
  csvUrl: string,
  metrics?: CanonicalizeMetrics,
): CanonicalEvent | null {
  const title = pick(row, ["nombre", "titulo", "title", "actividad"]);
  if (!title) return null;

  const inicioRaw = pick(row, ["f_inicio", "fecha_inicio", "fecha inicio", "fecha", "inicio"]);
  const finRaw = pick(row, ["f_fin", "fecha_fin", "fecha fin", "final"]);
  const inicio = parseCsvDate(inicioRaw);
  if (!inicio) return null;
  const fin = parseCsvDate(finRaw);

  // Time resolution: F_INICIO clock > HORARIO > assumed
  const horarioRaw = pick(row, ["horario", "hora", "time"]);
  const horario = parseHorario(horarioRaw);

  let startIso: string;
  let endIso: string | null = null;
  let timeAssumed = false;

  if (inicio.hasClock) {
    startIso = madridWallTimeToDate(
      inicio.y, inicio.m, inicio.d, inicio.hh, inicio.mm,
    ).toISOString();
    if (fin?.hasClock) {
      endIso = madridWallTimeToDate(
        fin.y, fin.m, fin.d, fin.hh, fin.mm,
      ).toISOString();
    }
    if (metrics) metrics.timeSourceInicio++;
  } else if (horario) {
    startIso = madridWallTimeToDate(
      inicio.y, inicio.m, inicio.d, horario.startHh, horario.startMm,
    ).toISOString();
    if (horario.endHh != null) {
      // End time on same date; if end < start, roll to next day.
      const endDate = new Date(
        madridWallTimeToDate(
          inicio.y, inicio.m, inicio.d, horario.endHh, horario.endMm ?? 0,
        ),
      );
      const startDate = new Date(startIso);
      if (endDate.getTime() < startDate.getTime()) {
        endDate.setUTCDate(endDate.getUTCDate() + 1);
      }
      endIso = endDate.toISOString();
    }
    if (metrics) metrics.timeSourceHorario++;
  } else {
    // No explicit time. Sentinel = UTC midnight of the Madrid calendar day.
    startIso = madridDateOnlyToUtcMidnightIso(inicio.y, inicio.m, inicio.d);
    timeAssumed = true;
    if (metrics) metrics.timeAssumed++;
  }

  // Multi-day: if fin is a strictly later calendar day, expose it as endAt.
  if (!endIso && fin) {
    const inicioMs = Date.UTC(inicio.y, inicio.m - 1, inicio.d);
    const finMs = Date.UTC(fin.y, fin.m - 1, fin.d);
    if (finMs > inicioMs) {
      // Use end-of-day sentinel in Madrid tz for the fin date.
      endIso = madridDateOnlyToUtcMidnightIso(fin.y, fin.m, fin.d);
    }
  }
  if (endIso && metrics) metrics.rangedEndAt++;

  const description = pick(row, ["descripcion", "description", "resumen"]) || null;

  // Venue: prefer the specific equipamiento; fall back to OTROS_LUGARES only
  // when there is no structured venue at all.
  const venueName =
    pick(row, ["eqp_descripcion", "lugar", "espacio", "venue", "recinto", "sala"]) ||
    pick(row, ["otros_lugares", "ubicacion"]) || null;

  const address =
    pick(row, ["eqp_nombrecalle", "direccion", "address"]) || null;

  // District as a lightweight sub-locality hint (not the locality itself).
  const distrito = pick(row, ["eqp_distrito", "distrito"]) || null;

  // Category: prefer CATEGORIA over ESPECIALIDAD to keep buckets stable.
  const category =
    pick(row, ["categoria", "category", "tipo", "tematica"]) ||
    pick(row, ["especialidad"]) || null;

  const eventUrl = pick(row, ["direccion_web", "url", "enlace", "link", "web"]);
  const sourceUrl = /^https?:\/\//i.test(eventUrl) ? eventUrl : csvUrl;

  // Ticket: same field as event URL only when it clearly points to ticketing.
  const ticketUrl = /entradas|tickets|reservas|inscripcion/i.test(eventUrl)
    ? eventUrl
    : null;

  // Access ("ACCESO_MIN"): "S" = libre, hint of free entry.
  const accesoMin = pick(row, ["acceso_min", "acceso"]).toUpperCase();
  const priceText = accesoMin === "S" ? "Entrada libre" : null;

  const organizer = pick(row, ["organiza", "organizer", "productor"]) || null;
  const externalId = pick(row, ["id_evento", "id_actividad", "id"]) || null;

  return {
    title,
    description,
    startAt: startIso,
    endAt: endIso,
    timezone: "Europe/Madrid",
    venueName,
    venueAddress: address ?? distrito,
    locality: "Málaga",
    category,
    imageUrl: null,
    sourceUrl,
    ticketUrl,
    priceText,
    externalId,
    organizer,
    timeAssumed: timeAssumed || undefined,
    raw: row,
  };
}

/** Parse a raw CSV string into CanonicalEvent[]. Deterministic. */
export function canonicalizeCsv(
  csvText: string,
  csvUrl: string,
  opts: { maxRows?: number; metrics?: CanonicalizeMetrics } = {},
): CanonicalEvent[] {
  const rows = parseCsv(csvText, { maxRows: opts.maxRows });
  const out: CanonicalEvent[] = [];
  for (const row of rows) {
    const c = canonicalizeRow(row, csvUrl, opts.metrics);
    if (c) out.push(c);
  }
  return out;
}

export const malagaOpenDataCsvAdapter: SourceAdapter = {
  key: "malaga-open-data-csv",
  name: "Málaga · Datos Abiertos (Agenda CSV)",
  async fetchEvents(ctx: AdapterContext): Promise<CanonicalEvent[]> {
    const url = ctx.source.base_url?.trim() || DEFAULT_CSV_URL;
    try {
      const { rows } = await fetchCsv(
        url,
        {},
        { timeoutMs: 25000, retries: 2, maxRows: 8000 },
      );
      ctx.logger.info(
        `[malaga-open-data-csv] downloaded ${rows.length} rows`,
        { url },
      );
      const out: CanonicalEvent[] = [];
      for (const row of rows) {
        const c = canonicalizeRow(row, url);
        if (c) out.push(c);
      }
      ctx.logger.info(
        `[malaga-open-data-csv] canonicalised ${out.length} events`,
      );
      return out;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      ctx.logger.error(
        `[malaga-open-data-csv] fetch failed: ${message}`,
        { url },
      );
      return [];
    }
  },
};

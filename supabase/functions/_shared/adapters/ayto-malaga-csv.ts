// Ayuntamiento de Málaga — CSV adapter (P0)
//
// Fetches the official Open Data CSV feed with the annual cultural agenda:
//   https://datosabiertos.malaga.eu/recursos/cultura/agenda/2026.csv
// Licence: CC BY 4.0. `robots.txt` allows `/recursos/` (Crawl-Delay: 10).
//
// Real schema (verified on 2026-07-13):
//   ID_EVENTO, EVENTO, ID_ACTIVIDAD, NOMBRE, DESCRIPCION, ACCESO_MIN,
//   ID_LUGAR, OTROS_LUGARES, HORARIO, TELEFONO, F_INICIO, F_FIN,
//   DESTINATARIOS, DESTINATARIOS_DESCRIPCION, DIRECCION_WEB, E_MAIL,
//   CATEGORIA, ESPECIALIDAD, ORGANIZA, EQP_DESCRIPCION, EQP_NOMBRECALLE,
//   EQP_DISTRITO, EQP_OTROS
//
// A single ID_EVENTO can appear on multiple rows (one per ESPECIALIDAD).
// The ingestion layer collapses them naturally via the shared dedupe key
// (title | venue | locality | Madrid-minute).
//
// SAFETY:
// - Pure function: returns CanonicalEvent[]. Persistence and writes are
//   gated by scrape-source (WRITE_ENABLED + write_confirmed_at + robots_ok).
// - Never falls back to a scraper on failure — returns [] and logs the error
//   so we surface the incident in event_source_runs.

import type {
  SourceAdapter,
  CanonicalEvent,
  AdapterContext,
} from "../ingestion/types.ts";
import { fetchCsv, parseCsv, type CsvRow } from "./lib/csv.ts";
import { parseSpanishDateToMadrid } from "../ingestion/dates.ts";

const DEFAULT_CSV_URL =
  "https://datosabiertos.malaga.eu/recursos/cultura/agenda/2026.csv";

/** Normalise a header name for accent/case-insensitive lookup. */
function normHeader(h: string): string {
  return h
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Case- and accent-insensitive column picker over a CsvRow.
 * Iterates in caller's key priority order so the first listed alias wins,
 * regardless of the physical column order in the source CSV.
 */
function pick(row: CsvRow, keys: string[]): string {
  const index = new Map<string, string>();
  for (const raw of Object.keys(row)) index.set(normHeader(raw), raw);
  for (const key of keys) {
    const raw = index.get(key);
    if (raw && row[raw]) return row[raw];
  }
  return "";
}

/**
 * Every date goes through the strict Europe/Madrid helper.
 *
 * The previous `new Date("2026-09-12T22:00")` shortcut read a timezone-less
 * value as the runtime's local time (UTC on the edge), so an official 22:00
 * Málaga start was stored as 22:00Z — two hours early. The helper reads
 * timezone-less values as Madrid wall time, preserves explicit offsets and Z,
 * keeps date-only values at the unknown-hour sentinel, and rejects impossible
 * dates instead of wrapping them.
 */
function normaliseIso(input: string): string | null {
  if (!input) return null;
  const isoLike = /\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?/
    .exec(input);
  const parsed = parseSpanishDateToMadrid(isoLike ? isoLike[0] : input);
  return parsed ? parsed.toISOString() : null;
}

/**
 * Row → CanonicalEvent. Pure. Returns null when required fields are missing.
 * Exported for direct unit/integration testing against fixtures.
 */
export function canonicalizeRow(
  row: CsvRow,
  sourceUrl: string,
): CanonicalEvent | null {
  const title = pick(row, ["nombre", "titulo", "title", "actividad"]).trim();
  const startRaw = pick(row, [
    "f_inicio",
    "fecha_inicio",
    "fecha inicio",
    "fecha",
    "start",
    "fecha_inicio_iso",
    "inicio",
  ]);
  const startAt = normaliseIso(startRaw);
  if (!title || !startAt) return null;

  const endRaw = pick(row, [
    "f_fin",
    "fecha_fin",
    "fecha fin",
    "end",
    "final",
    "fecha_fin_iso",
  ]);
  const endAtRaw = normaliseIso(endRaw);
  // A range whose end is at or before its start is not a range: drop the end
  // rather than persist an impossible interval.
  const endAt =
    endAtRaw && Date.parse(endAtRaw) > Date.parse(startAt) ? endAtRaw : null;

  const venueName =
    pick(row, [
      "eqp_descripcion",
      "lugar",
      "espacio",
      "venue",
      "recinto",
      "sala",
      "ubicacion",
    ]) || null;

  const address =
    pick(row, [
      "eqp_nombrecalle",
      "direccion",
      "address",
      "otros_lugares",
    ]) || null;

  const description =
    pick(row, ["descripcion", "description", "resumen"]) || null;

  const category =
    pick(row, [
      "categoria",
      "category",
      "tipo",
      "tematica",
      "especialidad",
    ]) || null;

  const imageUrl = pick(row, ["imagen", "image", "foto"]) || null;
  const ticketUrl =
    pick(row, ["url_entradas", "entradas", "ticket_url", "url_tickets"]) || null;
  const priceText = pick(row, ["precio", "price", "coste"]) || null;
  // Auditoría 2026-09-07: el CSV trae `DIRECCION_WEB` vacía o sin esquema en
  // muchas filas, así que sólo se acepta como URL canónica si es http(s)
  // absoluta; en caso contrario se conserva la URL del recurso oficial.
  const rawEventUrl =
    pick(row, ["direccion_web", "url", "enlace", "link", "web"]) || "";
  const eventUrl = /^https?:\/\//i.test(rawEventUrl) ? rawEventUrl : sourceUrl;
  const organizer = pick(row, ["organiza", "organizer", "productor"]) || null;
  const externalId =
    pick(row, ["id_evento", "id_actividad", "id"]) || null;

  return {
    title,
    description,
    startAt,
    endAt,
    timezone: "Europe/Madrid",
    venueName,
    venueAddress: address,
    locality: "Málaga",
    category,
    imageUrl,
    sourceUrl: eventUrl,
    ticketUrl,
    priceText,
    externalId,
    organizer,
    raw: row,
  };
}

/**
 * Parse a raw CSV string into CanonicalEvent[]. Exported for fixture-based
 * tests so we can exercise canonicalization without network I/O.
 */
export function canonicalizeCsv(
  csvText: string,
  sourceUrl: string,
  opts: { maxRows?: number } = {},
): CanonicalEvent[] {
  const rows = parseCsv(csvText, { maxRows: opts.maxRows });
  const out: CanonicalEvent[] = [];
  for (const row of rows) {
    const canonical = canonicalizeRow(row, sourceUrl);
    if (canonical) out.push(canonical);
  }
  return out;
}

export const aytoMalagaCsvAdapter: SourceAdapter = {
  key: "ayto-malaga-csv",
  name: "Ayuntamiento de Málaga (CSV Open Data)",
  async fetchEvents(ctx: AdapterContext): Promise<CanonicalEvent[]> {
    const url = ctx.source.base_url?.trim() || DEFAULT_CSV_URL;
    try {
      const { rows } = await fetchCsv(
        url,
        {},
        { timeoutMs: 25000, retries: 2, maxRows: 5000 },
      );
      ctx.logger.info(`[ayto-malaga-csv] downloaded ${rows.length} rows`, {
        url,
      });
      const out: CanonicalEvent[] = [];
      for (const row of rows) {
        const canonical = canonicalizeRow(row, url);
        if (canonical) out.push(canonical);
      }
      ctx.logger.info(
        `[ayto-malaga-csv] canonicalised ${out.length} events`,
      );
      return out;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      ctx.logger.error(`[ayto-malaga-csv] fetch failed: ${message}`, { url });
      return [];
    }
  },
};

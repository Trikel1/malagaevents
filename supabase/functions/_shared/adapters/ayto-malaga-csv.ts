// Ayuntamiento de Málaga — CSV adapter (P0)
//
// Fetches the official Open Data CSV feed with the annual cultural agenda:
//   https://datosabiertos.malaga.eu/recursos/cultura/agenda/2026.csv
//
// Preferred over the HTML/Firecrawl based `ayto-malaga` adapter because
// the CSV is a licensed structured feed with stable columns.
//
// SAFETY:
// - Pure function: returns CanonicalEvent[]. Persistence and writes are
//   handled by scrape-source and gated by WRITE_ENABLED + write_confirmed_at.
// - Never falls back to a scraper on failure — returns [] and logs the error
//   so we surface the incident in event_source_runs.

import type { SourceAdapter, CanonicalEvent, AdapterContext } from "../ingestion/types.ts";
import { fetchCsv, type CsvRow } from "./lib/csv.ts";
import { parseSpanishDateToMadrid } from "../ingestion/dates.ts";

const DEFAULT_CSV_URL = "https://datosabiertos.malaga.eu/recursos/cultura/agenda/2026.csv";

function pick(row: CsvRow, keys: string[]): string {
  for (const k of keys) {
    // Case- and accent-insensitive match against real header names
    const found = Object.keys(row).find(
      (h) => h.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() === k,
    );
    if (found && row[found]) return row[found];
  }
  return "";
}

function normaliseIso(input: string): string | null {
  if (!input) return null;
  // ISO first
  const iso = /\d{4}-\d{2}-\d{2}([T\s]\d{2}:\d{2})?/.exec(input);
  if (iso) {
    const parsed = new Date(iso[0].replace(" ", "T"));
    if (!isNaN(parsed.getTime())) return parsed.toISOString();
  }
  // Spanish free-form fallback (delegated to ingestion helper)
  const spanish = parseSpanishDateToMadrid(input);
  return spanish ? spanish.toISOString() : null;
}

function toCanonical(row: CsvRow, sourceUrl: string): CanonicalEvent | null {
  const title = pick(row, ["titulo", "title", "nombre", "actividad"]).trim();
  const startRaw = pick(row, ["fecha_inicio", "fecha inicio", "fecha", "start", "fecha_inicio_iso", "inicio"]);
  const startAt = normaliseIso(startRaw);
  if (!title || !startAt) return null;

  const endRaw = pick(row, ["fecha_fin", "fecha fin", "end", "final", "fecha_fin_iso"]);
  const endAt = normaliseIso(endRaw);

  const venueName = pick(row, ["lugar", "espacio", "venue", "recinto", "sala", "ubicacion"]) || null;
  const address = pick(row, ["direccion", "address"]) || null;
  const description = pick(row, ["descripcion", "description", "resumen"]) || null;
  const category = pick(row, ["categoria", "category", "tipo", "temática", "tematica"]) || null;
  const imageUrl = pick(row, ["imagen", "image", "foto"]) || null;
  const ticketUrl = pick(row, ["url_entradas", "entradas", "ticket_url", "url_tickets"]) || null;
  const priceText = pick(row, ["precio", "price", "coste"]) || null;
  const eventUrl = pick(row, ["url", "enlace", "link", "web"]) || sourceUrl;

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
    raw: row,
  };
}

export const aytoMalagaCsvAdapter: SourceAdapter = {
  key: "ayto-malaga-csv",
  name: "Ayuntamiento de Málaga (CSV Open Data)",
  async fetchEvents(ctx: AdapterContext): Promise<CanonicalEvent[]> {
    const url = ctx.source.base_url?.trim() || DEFAULT_CSV_URL;
    try {
      const { rows } = await fetchCsv(url, {}, { timeoutMs: 20000, retries: 2, maxRows: 2000 });
      ctx.logger.info(`[ayto-malaga-csv] downloaded ${rows.length} rows`, { url });
      const out: CanonicalEvent[] = [];
      for (const row of rows) {
        const canonical = toCanonical(row, url);
        if (canonical) out.push(canonical);
      }
      ctx.logger.info(`[ayto-malaga-csv] canonicalised ${out.length} events`);
      return out;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      ctx.logger.error(`[ayto-malaga-csv] fetch failed: ${message}`, { url });
      return [];
    }
  },
};

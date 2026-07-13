// Teatro Cánovas (Málaga) — Junta de Andalucía / AAIICC — dry-run only.
//
// Source (public listing):
//   https://www.juntadeandalucia.es/cultura/aaiicc/teatros/teatro-canovas
//
// SAFETY:
//  - Read-only. Returns CanonicalEvent[]; scrape-source is the sole writer
//    and remains gated (WRITE_ENABLED=false + SYNC_ADMIN_KEY).
//  - Deterministic regex parsing via shared agenda-parser helper.
//  - Uses Firecrawl when FIRECRAWL_API_KEY is set; falls back to plain
//    fetch with a polite User-Agent.
//  - Never invents dates. Time fallback 20:00 marked raw.timeAssumed=true.
//  - Detail follow disabled by default (institutional site layout varies).
//  - If the listing has no parseable candidates, returns [] and logs
//    warning `no_current_events` (blocked_needs_manual_review path).

import type { SourceAdapter, CanonicalEvent } from "../ingestion/types.ts";
import {
  extractAgendaCandidates,
  fetchMarkdown,
  parseAgendaDateLine,
  stripAccents,
} from "./lib/agenda-parser.ts";

const BASE = "https://www.juntadeandalucia.es";
const LISTING_URL =
  "https://www.juntadeandalucia.es/cultura/aaiicc/teatros/teatro-canovas";

function inferCategory(title: string, dateLine?: string): string {
  const t = stripAccents((title + " " + (dateLine ?? "")).toLowerCase());
  if (/\b(concierto|musica|jazz|flamenco|opera|lirica|sinfonic)\b/.test(t)) return "music";
  if (/\b(danza|ballet)\b/.test(t)) return "theater";
  if (/\b(infantil|ninos|familiar|peques|cuento)\b/.test(t)) return "kids";
  if (/\b(exposicion|muestra)\b/.test(t)) return "other";
  if (/\b(taller|conferencia|charla)\b/.test(t)) return "other";
  return "theater";
}

export const teatroCanovasAdapter: SourceAdapter = {
  key: "teatro-canovas",
  name: "Teatro Cánovas (Junta de Andalucía)",
  fetchEvents: async (ctx) => {
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    let markdown = "";
    try {
      markdown = await fetchMarkdown(LISTING_URL, firecrawlKey);
    } catch (e) {
      ctx.logger.error("teatro-canovas: fetch failed", {
        url: LISTING_URL,
        error: (e as Error).message,
      });
      return [];
    }
    if (!markdown) {
      ctx.logger.warn("teatro-canovas: empty response", { url: LISTING_URL });
      return [];
    }

    const candidates = extractAgendaCandidates(markdown, BASE, {
      // Accept event-detail-ish paths under aaiicc/teatros or fichas.
      hrefFilter: /(aaiicc|teatro|espectaculo|actividad|ficha|evento|programa)/i,
      excludeFilter:
        /(login|contacto|accesibilidad|aviso-legal|privacidad|cookies|rss|mapa-web|buscador)/i,
      headingLevels: [2, 3, 4],
    });

    if (candidates.length === 0) {
      ctx.logger.warn("teatro-canovas: no_current_events", {
        url: LISTING_URL,
        note: "listing has no recognisable event structure — needs manual review",
      });
      return [];
    }

    const out: CanonicalEvent[] = [];
    let skippedNoDate = 0;
    let timeAssumedCount = 0;
    let withEndAt = 0;
    let ticketCount = 0;
    const seen = new Set<string>();

    for (const c of candidates) {
      const parsed = c.dateLine ? parseAgendaDateLine(c.dateLine) : null;
      if (!parsed) {
        skippedNoDate++;
        continue;
      }
      const key = c.eventUrl + "|" + stripAccents(c.title.toLowerCase());
      if (seen.has(key)) continue;
      seen.add(key);

      const timeAssumed = !parsed.timeExplicit;
      if (timeAssumed) timeAssumedCount++;
      if (parsed.endDate) withEndAt++;
      if (c.ticketUrl) ticketCount++;

      out.push({
        title: c.title.trim(),
        description: null,
        startAt: parsed.date.toISOString(),
        endAt: parsed.endDate ? parsed.endDate.toISOString() : null,
        timezone: "Europe/Madrid",
        venueName: "Teatro Cánovas",
        venueAddress: null,
        locality: "Málaga",
        category: inferCategory(c.title, c.dateLine),
        imageUrl: c.imageUrl ?? null,
        sourceUrl: c.eventUrl,
        ticketUrl: c.ticketUrl ?? null,
        priceText: null,
        raw: {
          adapter: "teatro-canovas",
          dateLine: c.dateLine ?? null,
          timeAssumed,
          timeSource: parsed.timeExplicit ? "listing" : "fallback",
          ticketSource: c.ticketUrl ? "listing" : null,
          rangeStartRaw: parsed.rangeStartRaw ?? null,
          rangeEndRaw: parsed.rangeEndRaw ?? null,
        },
      });
    }

    ctx.logger.info("teatro-canovas: normalised", {
      candidates: candidates.length,
      returned: out.length,
      skippedNoDate,
      timeAssumedCount,
      withEndAt,
      ticketCount,
      dryRun: ctx.dryRun,
    });

    return out;
  },
};

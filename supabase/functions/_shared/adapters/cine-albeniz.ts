// Cine Albéniz (Málaga) — dry-run only.
// Source: https://cinealbeniz.com/
//
// Note: cinema screenings are dated one-off events (no long ranges).
// If the site is JS-heavy and the plain-fetch fallback returns no
// recognisable structure, the adapter returns [] with `no_current_events`.

import type { SourceAdapter, CanonicalEvent } from "../ingestion/types.ts";
import {
  extractAgendaCandidates,
  fetchMarkdown,
  parseAgendaDateLine,
  stripAccents,
} from "./lib/agenda-parser.ts";

const BASE = "https://cinealbeniz.com";
const LISTING_URLS = [
  "https://cinealbeniz.com/cartelera/",
  "https://cinealbeniz.com/programacion/",
  "https://cinealbeniz.com/agenda/",
  "https://cinealbeniz.com/",
];

function inferCategory(title: string): string {
  const t = stripAccents(title.toLowerCase());
  if (/\b(concierto|musica|opera|jazz)\b/.test(t)) return "music";
  if (/\b(infantil|familiar|ninos|peques)\b/.test(t)) return "kids";
  // Cinema screenings — system has no "cinema" category, use "other".
  return "other";
}

export const cineAlbenizAdapter: SourceAdapter = {
  key: "cine-albeniz",
  name: "Cine Albéniz",
  fetchEvents: async (ctx) => {
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    let markdown = "";
    let usedUrl = "";
    for (const url of LISTING_URLS) {
      try {
        const md = await fetchMarkdown(url, firecrawlKey);
        if (md && md.length > 500) {
          markdown = md;
          usedUrl = url;
          break;
        }
      } catch (e) {
        ctx.logger.warn("cine-albeniz: fetch failed, trying next", {
          url,
          error: (e as Error).message,
        });
      }
    }
    if (!markdown) {
      ctx.logger.error("cine-albeniz: no listing accessible", { tried: LISTING_URLS });
      return [];
    }

    const candidates = extractAgendaCandidates(markdown, BASE, {
      hrefFilter: /(cartelera|pelicula|programacion|agenda|evento|sesion|entrada|ficha)/i,
      excludeFilter:
        /(login|contacto|aviso-legal|privacidad|cookies|rss|carrito|cart|cuenta|feed|category)/i,
      headingLevels: [2, 3, 4],
    });

    if (candidates.length === 0) {
      ctx.logger.warn("cine-albeniz: no_current_events", {
        url: usedUrl,
        note: "listing has no recognisable event structure — needs manual review (JS-heavy site)",
      });
      return [];
    }

    const out: CanonicalEvent[] = [];
    let skippedNoDate = 0;
    let timeAssumedCount = 0;
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
      if (c.ticketUrl) ticketCount++;

      out.push({
        title: c.title.trim(),
        description: null,
        startAt: parsed.date.toISOString(),
        endAt: parsed.endDate ? parsed.endDate.toISOString() : null,
        timezone: "Europe/Madrid",
        venueName: "Cine Albéniz",
        venueAddress: "Calle Alcazabilla, 4, Málaga",
        locality: "Málaga",
        category: inferCategory(c.title),
        imageUrl: c.imageUrl ?? null,
        sourceUrl: c.eventUrl,
        ticketUrl: c.ticketUrl ?? null,
        priceText: null,
        raw: {
          adapter: "cine-albeniz",
          dateLine: c.dateLine ?? null,
          timeAssumed,
          timeSource: parsed.timeExplicit ? "listing" : "fallback",
          ticketSource: c.ticketUrl ? "listing" : null,
          rangeStartRaw: parsed.rangeStartRaw ?? null,
          rangeEndRaw: parsed.rangeEndRaw ?? null,
        },
      });
    }

    ctx.logger.info("cine-albeniz: normalised", {
      listing: usedUrl,
      candidates: candidates.length,
      returned: out.length,
      skippedNoDate,
      timeAssumedCount,
      ticketCount,
      dryRun: ctx.dryRun,
    });

    return out;
  },
};

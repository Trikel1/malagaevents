// Sala París 15 (Málaga) — dry-run only.
// Source: https://www.paris15.es/eventos/

import type { SourceAdapter, CanonicalEvent } from "../ingestion/types.ts";
import {
  extractAgendaCandidates,
  fetchMarkdown,
  parseAgendaDateLine,
  stripAccents,
} from "./lib/agenda-parser.ts";

const BASE = "https://www.paris15.es";
const LISTING_URLS = [
  "https://www.paris15.es/eventos/",
  "https://www.paris15.es/agenda/",
  "https://www.paris15.es/",
];

function inferCategory(title: string): string {
  const t = stripAccents(title.toLowerCase());
  if (/\b(concierto|musica|jazz|flamenco|dj|rock|indie|pop|festival|gira|tour|acustico|directo)\b/.test(t)) return "music";
  if (/\b(monologo|teatro|comedia|stand.?up|cabaret)\b/.test(t)) return "theater";
  if (/\b(infantil|familiar|ninos)\b/.test(t)) return "kids";
  return "music";
}

export const salaParis15Adapter: SourceAdapter = {
  key: "sala-paris-15",
  name: "Sala París 15",
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
        ctx.logger.warn("sala-paris-15: fetch failed, trying next", {
          url,
          error: (e as Error).message,
        });
      }
    }
    if (!markdown) {
      ctx.logger.error("sala-paris-15: no listing accessible", { tried: LISTING_URLS });
      return [];
    }

    const candidates = extractAgendaCandidates(markdown, BASE, {
      hrefFilter: /(evento|agenda|concierto|entrada|producto|shop)/i,
      excludeFilter:
        /(login|contacto|aviso-legal|privacidad|cookies|rss|carrito|cart|cuenta|feed|category)/i,
      headingLevels: [2, 3, 4],
    });

    if (candidates.length === 0) {
      ctx.logger.warn("sala-paris-15: no_current_events", {
        url: usedUrl,
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
        venueName: "Sala París 15",
        venueAddress: null,
        locality: "Málaga",
        category: inferCategory(c.title),
        imageUrl: c.imageUrl ?? null,
        sourceUrl: c.eventUrl,
        ticketUrl: c.ticketUrl ?? null,
        priceText: null,
        raw: {
          adapter: "sala-paris-15",
          dateLine: c.dateLine ?? null,
          timeAssumed,
          timeSource: parsed.timeExplicit ? "listing" : "fallback",
          ticketSource: c.ticketUrl ? "listing" : null,
          rangeStartRaw: parsed.rangeStartRaw ?? null,
          rangeEndRaw: parsed.rangeEndRaw ?? null,
        },
      });
    }

    ctx.logger.info("sala-paris-15: normalised", {
      listing: usedUrl,
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

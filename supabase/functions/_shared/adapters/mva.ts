// MVA — Centro Cultural Provincial María Victoria Atencia (Diputación) — dry-run only.
// Source: https://www.malaga.es/mva/

import type { SourceAdapter, CanonicalEvent } from "../ingestion/types.ts";
import {
  extractAgendaCandidates,
  fetchMarkdown,
  parseAgendaDateLine,
  stripAccents,
} from "./lib/agenda-parser.ts";

const BASE = "https://www.malaga.es";
const LISTING_URLS = [
  "https://www.malaga.es/mva/agenda",
  "https://www.malaga.es/mva/",
];

function inferCategory(title: string): string {
  const t = stripAccents(title.toLowerCase());
  if (/\b(concierto|musica|recital)\b/.test(t)) return "music";
  if (/\b(exposicion|muestra)\b/.test(t)) return "other";
  if (/\b(teatro|monologo|musical)\b/.test(t)) return "theater";
  if (/\b(cine|proyeccion)\b/.test(t)) return "other";
  if (/\b(taller|conferencia|charla|encuentro)\b/.test(t)) return "other";
  return "other";
}

export const mvaAdapter: SourceAdapter = {
  key: "mva",
  name: "MVA — Centro Cultural Provincial María Victoria Atencia",
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
        ctx.logger.warn("mva: fetch failed, trying next", {
          url,
          error: (e as Error).message,
        });
      }
    }
    if (!markdown) {
      ctx.logger.error("mva: no listing accessible", { tried: LISTING_URLS });
      return [];
    }

    const candidates = extractAgendaCandidates(markdown, BASE, {
      hrefFilter: /mva/i,
      excludeFilter:
        /(login|contacto|aviso-legal|privacidad|cookies|rss|mapa-web|buscador|feed)/i,
      headingLevels: [2, 3, 4],
    });

    if (candidates.length === 0) {
      ctx.logger.warn("mva: no_current_events", {
        url: usedUrl,
        note: "listing has no recognisable event structure — needs manual review",
      });
      return [];
    }

    const out: CanonicalEvent[] = [];
    let skippedNoDate = 0;
    let timeAssumedCount = 0;
    let withEndAt = 0;
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

      out.push({
        title: c.title.trim(),
        description: null,
        startAt: parsed.date.toISOString(),
        endAt: parsed.endDate ? parsed.endDate.toISOString() : null,
        timezone: "Europe/Madrid",
        venueName: "Centro Cultural MVA",
        venueAddress: "Calle Ollerías, 34, Málaga",
        locality: "Málaga",
        category: inferCategory(c.title),
        imageUrl: c.imageUrl ?? null,
        sourceUrl: c.eventUrl,
        ticketUrl: c.ticketUrl ?? null,
        priceText: null,
        raw: {
          adapter: "mva",
          dateLine: c.dateLine ?? null,
          timeAssumed,
          timeSource: parsed.timeExplicit ? "listing" : "fallback",
          rangeStartRaw: parsed.rangeStartRaw ?? null,
          rangeEndRaw: parsed.rangeEndRaw ?? null,
        },
      });
    }

    ctx.logger.info("mva: normalised", {
      listing: usedUrl,
      candidates: candidates.length,
      returned: out.length,
      skippedNoDate,
      timeAssumedCount,
      withEndAt,
      dryRun: ctx.dryRun,
    });

    return out;
  },
};

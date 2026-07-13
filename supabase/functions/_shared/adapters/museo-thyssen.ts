// Museo Carmen Thyssen Málaga — dry-run only.
// Source: https://www.carmenthyssenmalaga.org/

import type { SourceAdapter, CanonicalEvent } from "../ingestion/types.ts";
import {
  extractAgendaCandidates,
  fetchMarkdown,
  parseAgendaDateLine,
  stripAccents,
} from "./lib/agenda-parser.ts";

const BASE = "https://www.carmenthyssenmalaga.org";
const LISTING_URLS = [
  "https://www.carmenthyssenmalaga.org/exposiciones",
  "https://www.carmenthyssenmalaga.org/actividades",
  "https://www.carmenthyssenmalaga.org/",
];

function inferCategory(title: string, url: string): string {
  const t = stripAccents((title + " " + url).toLowerCase());
  if (/exposici|muestra/.test(t)) return "other";
  if (/taller|workshop/.test(t)) return "other";
  if (/familiar|infantil|ninos|peques/.test(t)) return "kids";
  if (/conferencia|charla|encuentro|visita/.test(t)) return "other";
  if (/concierto|musica/.test(t)) return "music";
  return "other";
}

function isExhibitionLike(url: string, title: string): boolean {
  return /exposici|muestra/i.test((url + " " + title).toLowerCase());
}

export const museoThyssenAdapter: SourceAdapter = {
  key: "museo-thyssen",
  name: "Museo Carmen Thyssen Málaga",
  fetchEvents: async (ctx) => {
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    const allSources: Array<{ md: string; url: string }> = [];

    for (const url of LISTING_URLS) {
      try {
        const md = await fetchMarkdown(url, firecrawlKey);
        if (md && md.length > 500) allSources.push({ md, url });
      } catch (e) {
        ctx.logger.warn("museo-thyssen: fetch failed", {
          url,
          error: (e as Error).message,
        });
      }
    }
    if (allSources.length === 0) {
      ctx.logger.error("museo-thyssen: no listing accessible", { tried: LISTING_URLS });
      return [];
    }

    const seenUrls = new Set<string>();
    const out: CanonicalEvent[] = [];
    let totalCands = 0;
    let skippedNoDate = 0;
    let timeAssumedCount = 0;
    let withEndAt = 0;
    let exhibitionCount = 0;

    for (const src of allSources) {
      const cands = extractAgendaCandidates(src.md, BASE, {
        hrefFilter: /(exposicion|actividad|taller|programa|agenda|evento|coleccion)/i,
        excludeFilter:
          /(login|contacto|aviso-legal|privacidad|cookies|rss|shop|tienda)/i,
        headingLevels: [2, 3, 4],
      });
      totalCands += cands.length;

      for (const c of cands) {
        if (seenUrls.has(c.eventUrl)) continue;
        seenUrls.add(c.eventUrl);

        const parsed = c.dateLine ? parseAgendaDateLine(c.dateLine) : null;
        if (!parsed) {
          skippedNoDate++;
          continue;
        }

        const isExh = isExhibitionLike(c.eventUrl, c.title);
        if (isExh) exhibitionCount++;
        const timeAssumed = !parsed.timeExplicit;
        if (timeAssumed) timeAssumedCount++;
        if (parsed.endDate) withEndAt++;

        out.push({
          title: c.title.trim(),
          description: isExh ? "Exposición" : null,
          startAt: parsed.date.toISOString(),
          endAt: parsed.endDate ? parsed.endDate.toISOString() : null,
          timezone: "Europe/Madrid",
          venueName: "Museo Carmen Thyssen Málaga",
          venueAddress: "Plaza Carmen Thyssen, C/ Compañía, 10, Málaga",
          locality: "Málaga",
          category: inferCategory(c.title, c.eventUrl),
          imageUrl: c.imageUrl ?? null,
          sourceUrl: c.eventUrl,
          ticketUrl: c.ticketUrl ?? null,
          priceText: null,
          raw: {
            adapter: "museo-thyssen",
            dateLine: c.dateLine ?? null,
            timeAssumed,
            timeSource: parsed.timeExplicit ? "listing" : "fallback",
            isExhibition: isExh,
            rangeStartRaw: parsed.rangeStartRaw ?? null,
            rangeEndRaw: parsed.rangeEndRaw ?? null,
          },
        });
      }
    }

    if (out.length === 0) {
      ctx.logger.warn("museo-thyssen: no_current_events", {
        note: "no parseable items — needs manual review",
      });
    }

    ctx.logger.info("museo-thyssen: normalised", {
      candidates: totalCands,
      returned: out.length,
      skippedNoDate,
      timeAssumedCount,
      withEndAt,
      exhibitionCount,
      dryRun: ctx.dryRun,
    });

    return out;
  },
};

// Re-export helper for tests
export { stripAccents };

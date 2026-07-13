// Museo Picasso Málaga — dry-run only.
// Source: https://www.museopicassomalaga.org/
//
// Museo differs from theatres: many items are long-running exhibitions
// (use startAt/endAt as the full run, do NOT explode day by day) and
// occasional dated activities (workshops, family, talks).

import type { SourceAdapter, CanonicalEvent } from "../ingestion/types.ts";
import {
  extractAgendaCandidates,
  fetchMarkdown,
  parseAgendaDateLine,
  stripAccents,
} from "./lib/agenda-parser.ts";

const BASE = "https://www.museopicassomalaga.org";
const LISTING_URLS = [
  "https://www.museopicassomalaga.org/exposiciones",
  "https://www.museopicassomalaga.org/actividades",
  "https://www.museopicassomalaga.org/",
];

function inferCategory(title: string, url: string): string {
  const t = stripAccents((title + " " + url).toLowerCase());
  if (/exposicion|muestra/.test(t)) return "other"; // exhibition
  if (/taller|workshop/.test(t)) return "other";
  if (/familiar|infantil|ninos|peques/.test(t)) return "kids";
  if (/conferencia|charla|encuentro/.test(t)) return "other";
  if (/concierto|musica/.test(t)) return "music";
  return "other";
}

function isExhibitionLike(url: string, title: string): boolean {
  const s = (url + " " + title).toLowerCase();
  return /exposici|muestra/i.test(s);
}

export const museoPicassoAdapter: SourceAdapter = {
  key: "museo-picasso",
  name: "Museo Picasso Málaga",
  fetchEvents: async (ctx) => {
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    const seenUrls = new Set<string>();
    const allCandidates: Array<{ md: string; url: string; label: string }> = [];

    for (const url of LISTING_URLS) {
      try {
        const md = await fetchMarkdown(url, firecrawlKey);
        if (md && md.length > 500) {
          allCandidates.push({ md, url, label: url });
        }
      } catch (e) {
        ctx.logger.warn("museo-picasso: fetch failed", {
          url,
          error: (e as Error).message,
        });
      }
    }
    if (allCandidates.length === 0) {
      ctx.logger.error("museo-picasso: no listing accessible", { tried: LISTING_URLS });
      return [];
    }

    const out: CanonicalEvent[] = [];
    let totalCands = 0;
    let skippedNoDate = 0;
    let timeAssumedCount = 0;
    let withEndAt = 0;
    let exhibitionCount = 0;

    for (const src of allCandidates) {
      const cands = extractAgendaCandidates(src.md, BASE, {
        hrefFilter: /(exposicion|actividad|taller|programa|agenda|coleccion|evento)/i,
        excludeFilter:
          /(login|contacto|aviso-legal|privacidad|cookies|rss|shop|tienda|entradas-general)/i,
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
          venueName: "Museo Picasso Málaga",
          venueAddress: "Palacio de Buenavista, C/ San Agustín, 8, Málaga",
          locality: "Málaga",
          category: inferCategory(c.title, c.eventUrl),
          imageUrl: c.imageUrl ?? null,
          sourceUrl: c.eventUrl,
          ticketUrl: c.ticketUrl ?? null,
          priceText: null,
          raw: {
            adapter: "museo-picasso",
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
      ctx.logger.warn("museo-picasso: no_current_events", {
        note: "no parseable items — needs manual review",
      });
    }

    ctx.logger.info("museo-picasso: normalised", {
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

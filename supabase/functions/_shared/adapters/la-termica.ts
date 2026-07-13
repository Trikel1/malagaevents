// La Térmica (Diputación de Málaga) — dry-run only.
// Source: https://www.latermicamalaga.com/

import type { SourceAdapter, CanonicalEvent } from "../ingestion/types.ts";
import {
  extractAgendaCandidates,
  fetchMarkdown,
  parseAgendaDateLine,
  stripAccents,
} from "./lib/agenda-parser.ts";

const BASE = "https://www.latermicamalaga.com";
const LISTING_URLS = [
  "https://www.latermicamalaga.com/programacion/",
  "https://www.latermicamalaga.com/agenda/",
  "https://www.latermicamalaga.com/",
];

function inferCategory(title: string): string {
  const t = stripAccents(title.toLowerCase());
  if (/\b(concierto|musica|jazz|flamenco|dj|festival)\b/.test(t)) return "music";
  if (/\b(taller|curso|clase|workshop)\b/.test(t)) return "other";
  if (/\b(cine|proyeccion|documental)\b/.test(t)) return "other";
  if (/\b(exposicion|muestra)\b/.test(t)) return "other";
  if (/\b(conferencia|charla|debate|encuentro)\b/.test(t)) return "other";
  if (/\b(infantil|familiar|ninos)\b/.test(t)) return "kids";
  return "other";
}

export const laTermicaAdapter: SourceAdapter = {
  key: "la-termica",
  name: "La Térmica",
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
        ctx.logger.warn("la-termica: fetch failed, trying next", {
          url,
          error: (e as Error).message,
        });
      }
    }
    if (!markdown) {
      ctx.logger.error("la-termica: no listing accessible", { tried: LISTING_URLS });
      return [];
    }

    const candidates = extractAgendaCandidates(markdown, BASE, {
      hrefFilter: /(programacion|agenda|actividad|curso|taller|evento|cursos|talleres)/i,
      excludeFilter:
        /(login|contacto|aviso-legal|privacidad|cookies|rss|categoria|category|\/tag\/|feed)/i,
      headingLevels: [2, 3, 4],
    });

    if (candidates.length === 0) {
      ctx.logger.warn("la-termica: no_current_events", {
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
        venueName: "La Térmica",
        venueAddress: null,
        locality: "Málaga",
        category: inferCategory(c.title),
        imageUrl: c.imageUrl ?? null,
        sourceUrl: c.eventUrl,
        ticketUrl: c.ticketUrl ?? null,
        priceText: null,
        raw: {
          adapter: "la-termica",
          dateLine: c.dateLine ?? null,
          timeAssumed,
          timeSource: parsed.timeExplicit ? "listing" : "fallback",
          rangeStartRaw: parsed.rangeStartRaw ?? null,
          rangeEndRaw: parsed.rangeEndRaw ?? null,
        },
      });
    }

    ctx.logger.info("la-termica: normalised", {
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

// Visit Costa del Sol (adapter_key: visit-costa-del-sol).
//
// Source: https://www.visitacostadelsol.com/agenda
// Robots.txt: allow-all (no Disallow, only Sitemap). Terms: reuse permitted
// citing the source (aviso legal). Adapter stores `sourceUrl` on every event.
//
// Fetch strategy:
//   1. Fetch the "art" sitemap
//      (https://www.visitacostadelsol.com/base/sitemap/?site=art&idi=es) — a
//      plain XML index of every `/agenda/<slug>-p<n>` detail URL.
//   2. For each URL (bounded to 20/run), Firecrawl the detail page with
//      `waitFor:3000` (required — the site injects the event card via JS)
//      and parse the markdown for title, locality, date range, description
//      and hero image.
//   3. Emit CanonicalEvent[] with externalId = `vcs-<numericId>` (matches the
//      trailing `-p<n>` fragment; stable across renders).
//
// SAFETY: pure adapter, no writes, no @supabase/supabase-js import.

import type {
  SourceAdapter,
  CanonicalEvent,
  AdapterContext,
} from "../ingestion/types.ts";
import { madridWallTimeToDate } from "../ingestion/dates.ts";
import { safeFetch } from "./lib/http.ts";
import {
  firecrawlScrapePage,
  sleep,
  type FirecrawlDeps,
} from "./lib/firecrawl.ts";
import {
  extractVisitSitemapLinks,
  parseVisitDetailMarkdown,
  type VisitDetail,
} from "./lib/junta-visit.ts";

const SITEMAP_URL =
  "https://www.visitacostadelsol.com/base/sitemap/?site=art&idi=es";
const DEFAULT_LIMIT = 20;
const DETAIL_DELAY_MS = 600;

export type XmlGetter = (url: string) => Promise<string>;

export interface VisitBuildDeps {
  firecrawl: FirecrawlDeps;
  sitemapGet?: XmlGetter;
  sitemapUrl?: string;
  limit?: number;
  detailDelayMs?: number;
  logger?: AdapterContext["logger"];
}

export function visitDetailToCanonical(
  detail: VisitDetail,
): CanonicalEvent | null {
  const start = madridWallTimeToDate(
    detail.year,
    detail.month,
    detail.day,
    10,
    0,
  );
  const end = madridWallTimeToDate(
    detail.endYear,
    detail.endMonth,
    detail.endDay,
    22,
    0,
  );
  if (!start) return null;

  return {
    title: detail.title,
    description: detail.descriptionText,
    startAt: start.toISOString(),
    endAt: end ? end.toISOString() : null,
    timezone: "Europe/Madrid",
    venueName: null,
    venueAddress: null,
    locality: detail.locality,
    category: null,
    imageUrl: detail.imageUrl,
    sourceUrl: detail.detailUrl,
    ticketUrl: detail.externalWebsite,
    priceText: null,
    externalId: `vcs-${detail.externalId}`,
    organizer: "Turismo Costa del Sol",
    raw: null,
  };
}

export async function defaultVisitSitemapGet(url: string): Promise<string> {
  const res = await safeFetch(url, {
    accept: "application/xml, text/xml",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; MalagaEventsBot/1.0; +https://malagaevents.lovable.app)",
    },
    timeoutMs: 30_000,
    maxBytes: 5_000_000,
  });
  if (res.status !== 200) {
    throw new Error(`visit_sitemap_http_${res.status}`);
  }
  return res.body;
}

export async function runVisitCostaDelSol(
  deps: VisitBuildDeps,
): Promise<CanonicalEvent[]> {
  const sitemapGet = deps.sitemapGet ?? defaultVisitSitemapGet;
  const sitemapUrl = deps.sitemapUrl ?? SITEMAP_URL;
  const limit = deps.limit ?? DEFAULT_LIMIT;
  const logger = deps.logger;
  const detailDelay = deps.detailDelayMs ?? DETAIL_DELAY_MS;

  const xml = await sitemapGet(sitemapUrl);
  const items = extractVisitSitemapLinks(xml);
  logger?.info("[visit-costa-del-sol] sitemap", {
    sitemapUrl,
    itemsFound: items.length,
  });

  const bounded = items.slice(0, Math.max(0, limit));
  const canonical: CanonicalEvent[] = [];

  for (let i = 0; i < bounded.length; i += 1) {
    const item = bounded[i];
    try {
      const page = await firecrawlScrapePage(item.detailUrl, {
        ...deps.firecrawl,
      });
      const parsed = parseVisitDetailMarkdown(page.markdown, item.detailUrl);
      if (!parsed) {
        logger?.warn("[visit-costa-del-sol] parse failed", {
          detailUrl: item.detailUrl,
          externalId: item.externalId,
        });
        continue;
      }
      const ev = visitDetailToCanonical(parsed);
      if (ev) canonical.push(ev);
    } catch (e) {
      logger?.warn("[visit-costa-del-sol] detail fetch error", {
        detailUrl: item.detailUrl,
        error: (e as Error).message,
      });
    }
    if (i < bounded.length - 1 && detailDelay > 0) await sleep(detailDelay);
  }

  return canonical;
}

export const visitCostaDelSolAdapter: SourceAdapter = {
  key: "visit-costa-del-sol",
  name: "Visit Costa del Sol",
  fetchEvents: async (ctx) => {
    const denoGlobal = (globalThis as unknown as {
      Deno?: { env: { get(k: string): string | undefined } };
    }).Deno;
    const firecrawlKey = denoGlobal?.env.get("FIRECRAWL_API_KEY");
    if (!firecrawlKey) {
      ctx.logger.warn("[visit-costa-del-sol] FIRECRAWL_API_KEY missing, returning []");
      return [];
    }
    try {
      return await runVisitCostaDelSol({
        firecrawl: { apiKey: firecrawlKey, timeoutMs: 90_000 },
        logger: ctx.logger,
      });
    } catch (e) {
      ctx.logger.error("[visit-costa-del-sol] fetch failed", {
        error: (e as Error).message,
      });
      return [];
    }
  },
};

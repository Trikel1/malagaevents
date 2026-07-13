// Diputación de Málaga · Agenda provincial (adapter_key: diputacion-malaga).
//
// Source: https://www.malaga.es/es/laprovincia/3315/agenda
// Fetch strategy:
//   1. Firecrawl the list page → collect stable detail URLs
//      (`.../com1_md3_cd-<n>/<slug>`).
//   2. For each detail URL (bounded to 25/run), Firecrawl the page and parse
//      the embedded `addtocalendar` link — the site's canonical structured
//      data — plus title/locality/category from the page markdown.
//   3. Emit CanonicalEvent[]. NEVER writes to DB — the scrape-source runner
//      handles persistence, still gated by WRITE_ENABLED + write_confirmed_at.
//
// Preflight evidence: docs/agenda-preflight/diputacion-malaga.md.
// Source remains `enabled=false` until legal/tech gate is signed off.

import type {
  SourceAdapter,
  CanonicalEvent,
  AdapterContext,
} from "../ingestion/types.ts";
import { madridWallTimeToDate } from "../ingestion/dates.ts";
import {
  firecrawlScrapePage,
  sleep,
  type FirecrawlDeps,
} from "./lib/firecrawl.ts";
import {
  extractDetailLinks,
  parseDetailPage,
  type MalagaEsDetail,
} from "./lib/malaga-es.ts";

const LIST_URL = "https://www.malaga.es/es/laprovincia/3315/agenda";
const LIST_PATH_PREFIX = "https://www.malaga.es/es/laprovincia/3315";
const DEFAULT_LIMIT = 25;
const DETAIL_DELAY_MS = 500;

export interface DiputacionMalagaBuildDeps {
  firecrawl: FirecrawlDeps;
  limit?: number;
  detailDelayMs?: number;
  listUrl?: string;
  logger?: AdapterContext["logger"];
}

/** Pure helper: given already-fetched pages, build CanonicalEvent[]. */
export function detailToCanonical(
  detail: MalagaEsDetail,
): CanonicalEvent | null {
  // Anchor all-day events to 09:00 Europe/Madrid to keep dedupe keys stable.
  const start = madridWallTimeToDate(
    detail.startYear,
    detail.startMonth,
    detail.startDay,
    9,
    0,
  );
  const end = madridWallTimeToDate(
    detail.endYear,
    detail.endMonth,
    detail.endDay,
    20,
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
    locality: detail.locality ?? "Málaga",
    category: detail.category,
    imageUrl: detail.imageUrl,
    sourceUrl: detail.sourceUrl,
    ticketUrl: null,
    priceText: null,
    externalId: `malagaes-${detail.externalId}`,
    organizer: detail.organizer,
    raw: null,
  };
}

/** Core runner: exported for tests using injected fetch/fixtures. */
export async function runDiputacionMalaga(
  deps: DiputacionMalagaBuildDeps,
): Promise<CanonicalEvent[]> {
  const listUrl = deps.listUrl ?? LIST_URL;
  const limit = deps.limit ?? DEFAULT_LIMIT;
  const logger = deps.logger;

  const listPage = await firecrawlScrapePage(listUrl, deps.firecrawl);
  const items = extractDetailLinks(listPage.links, LIST_PATH_PREFIX);
  logger?.info("[diputacion-malaga] list", {
    listUrl,
    linksTotal: listPage.links.length,
    itemsFound: items.length,
  });

  const bounded = items.slice(0, Math.max(0, limit));
  const canonical: CanonicalEvent[] = [];

  for (let i = 0; i < bounded.length; i += 1) {
    const item = bounded[i];
    try {
      const page = await firecrawlScrapePage(item.detailUrl, deps.firecrawl);
      const parsed = parseDetailPage(page.markdown, item.detailUrl);
      if (!parsed) {
        logger?.warn("[diputacion-malaga] parse failed", {
          detailUrl: item.detailUrl,
          externalId: item.externalId,
        });
        continue;
      }
      const ev = detailToCanonical(parsed);
      if (ev) canonical.push(ev);
    } catch (e) {
      logger?.warn("[diputacion-malaga] detail fetch error", {
        detailUrl: item.detailUrl,
        error: (e as Error).message,
      });
    }
    if (i < bounded.length - 1 && (deps.detailDelayMs ?? DETAIL_DELAY_MS) > 0) {
      await sleep(deps.detailDelayMs ?? DETAIL_DELAY_MS);
    }
  }

  return canonical;
}

export const diputacionMalagaAdapter: SourceAdapter = {
  key: "diputacion-malaga",
  name: "Diputación de Málaga – Agenda provincial",
  fetchEvents: async (ctx) => {
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!firecrawlKey) {
      ctx.logger.warn("[diputacion-malaga] FIRECRAWL_API_KEY missing, returning []");
      return [];
    }
    try {
      return await runDiputacionMalaga({
        firecrawl: { apiKey: firecrawlKey },
        listUrl: ctx.source.base_url ?? LIST_URL,
        logger: ctx.logger,
      });
    } catch (e) {
      ctx.logger.error("[diputacion-malaga] fetch failed", {
        error: (e as Error).message,
      });
      return [];
    }
  },
};

// Culturama · Agenda de la Diputación (adapter_key: culturama).
//
// Source: https://www.malaga.es/culturama/2157/agenda
// Same platform + markup as Diputación provincial, only the base path
// differs. Delegates to the shared malaga-es parser lib. Preflight in
// docs/agenda-preflight/culturama.md.

import type {
  SourceAdapter,
  CanonicalEvent,
  AdapterContext,
} from "../ingestion/types.ts";
import {
  firecrawlScrapePage,
  sleep,
  type FirecrawlDeps,
} from "./lib/firecrawl.ts";
import { extractDetailLinks, parseDetailPage } from "./lib/malaga-es.ts";
import { detailToCanonical } from "./diputacion-malaga.ts";

const LIST_URL = "https://www.malaga.es/culturama/2157/agenda";
const LIST_PATH_PREFIX = "https://www.malaga.es/culturama/2157";
const DEFAULT_LIMIT = 25;
const DETAIL_DELAY_MS = 500;

export interface CulturamaBuildDeps {
  firecrawl: FirecrawlDeps;
  limit?: number;
  detailDelayMs?: number;
  listUrl?: string;
  logger?: AdapterContext["logger"];
}

export async function runCulturama(
  deps: CulturamaBuildDeps,
): Promise<CanonicalEvent[]> {
  const listUrl = deps.listUrl ?? LIST_URL;
  const limit = deps.limit ?? DEFAULT_LIMIT;
  const logger = deps.logger;

  const listPage = await firecrawlScrapePage(listUrl, deps.firecrawl);
  const items = extractDetailLinks(listPage.links, LIST_PATH_PREFIX);
  logger?.info("[culturama] list", {
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
        logger?.warn("[culturama] parse failed", {
          detailUrl: item.detailUrl,
          externalId: item.externalId,
        });
        continue;
      }
      const ev = detailToCanonical(parsed);
      if (ev) {
        // Namespace externalId so Culturama events never collide with
        // Diputación provincial IDs even if the same numeric id shows up.
        canonical.push({ ...ev, externalId: `culturama-${item.externalId}` });
      }
    } catch (e) {
      logger?.warn("[culturama] detail fetch error", {
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

export const culturamaAdapter: SourceAdapter = {
  key: "culturama",
  name: "Culturama – Diputación de Málaga",
  fetchEvents: async (ctx) => {
    const denoGlobal = (globalThis as unknown as {
      Deno?: { env: { get(k: string): string | undefined } };
    }).Deno;
    const firecrawlKey = denoGlobal?.env.get("FIRECRAWL_API_KEY");
    if (!firecrawlKey) {
      ctx.logger.warn("[culturama] FIRECRAWL_API_KEY missing, returning []");
      return [];
    }
    try {
      return await runCulturama({
        firecrawl: { apiKey: firecrawlKey },
        listUrl: ctx.source.base_url ?? LIST_URL,
        logger: ctx.logger,
      });
    } catch (e) {
      ctx.logger.error("[culturama] fetch failed", {
        error: (e as Error).message,
      });
      return [];
    }
  },
};

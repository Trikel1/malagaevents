// Axarquía Costa del Sol · Agenda de eventos (adapter_key: axarquia-costa-del-sol).
//
// Source: https://axarquiacostadelsol.es/eventosaxarquiacostadelsol/
// Robots.txt allows this path (Disallow limited to /index.php, /fichajes.php,
// /login_check.php). Terms: sitio de la Mancomunidad de Municipios de la
// Costa del Sol Axarquía (APTA); no explicit ban on reuse. We store
// `sourceUrl` on every event and cite the mancomunidad in the organizer
// hint when the JSON-LD payload does not declare one.
//
// Fetch strategy:
//   1. safeFetch the listing HTML → extract all /evento/<slug>/ URLs.
//   2. For each (bounded to 20/run), safeFetch the detail page and parse
//      schema.org Event JSON-LD (name, description, image, url, startDate,
//      endDate, location.{name, address}).
//   3. Emit CanonicalEvent[] with externalId = `axarquia-<slug>`.
//   4. Skip any event whose addressRegion is not Málaga (postalCode ^29 also
//      accepted) — this rejects Granada spill-over (e.g. Almuñécar) without
//      inventing locality.
//
// SAFETY: pure adapter, no writes, no @supabase/supabase-js import. Failures
// per-detail are logged and the run continues.

import type {
  SourceAdapter,
  CanonicalEvent,
  AdapterContext,
} from "../ingestion/types.ts";
import { madridWallTimeToDate } from "../ingestion/dates.ts";
import { safeFetch } from "./lib/http.ts";
import {
  extractAxarquiaListLinks,
  parseAxarquiaDetailPage,
  type AxarquiaDetail,
} from "./lib/comarcas.ts";

const LIST_URL = "https://axarquiacostadelsol.es/eventosaxarquiacostadelsol/";
const DEFAULT_LIMIT = 20;
const DETAIL_DELAY_MS = 500;

export type HtmlGetter = (url: string) => Promise<string>;

export interface AxarquiaBuildDeps {
  httpGet?: HtmlGetter;
  limit?: number;
  detailDelayMs?: number;
  listUrl?: string;
  logger?: AdapterContext["logger"];
}

export function axarquiaDetailToCanonical(
  detail: AxarquiaDetail,
): CanonicalEvent | null {
  const start = madridWallTimeToDate(
    detail.year,
    detail.month,
    detail.day,
    detail.hour,
    detail.minute,
  );
  if (!start) return null;
  const end = madridWallTimeToDate(
    detail.endYear,
    detail.endMonth,
    detail.endDay,
    23,
    59,
  );

  return {
    title: detail.title,
    description: detail.description,
    startAt: start.toISOString(),
    endAt: end && end.getTime() > start.getTime() ? end.toISOString() : null,
    timezone: "Europe/Madrid",
    venueName: detail.venueName,
    venueAddress: detail.venueAddress,
    locality: detail.locality,
    category: null,
    imageUrl: detail.imageUrl,
    sourceUrl: detail.detailUrl,
    ticketUrl: null,
    priceText: null,
    externalId: `axarquia-${detail.externalId}`,
    organizer:
      detail.organizer ??
      "Mancomunidad de Municipios de la Costa del Sol Axarquía (APTA)",
    raw: null,
  };
}

export async function defaultAxarquiaHttpGet(url: string): Promise<string> {
  const res = await safeFetch(url, {
    accept: "text/html,application/xhtml+xml",
    headers: {
      "Accept-Language": "es-ES,es;q=0.9",
      "User-Agent":
        "Mozilla/5.0 (compatible; MalagaEventsBot/1.0; +https://malagaevents.lovable.app)",
    },
    timeoutMs: 30_000,
    maxBytes: 3_000_000,
  });
  if (res.status !== 200) throw new Error(`axarquia_http_${res.status}`);
  return res.body;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function runAxarquia(
  deps: AxarquiaBuildDeps,
): Promise<CanonicalEvent[]> {
  const httpGet = deps.httpGet ?? defaultAxarquiaHttpGet;
  const listUrl = deps.listUrl ?? LIST_URL;
  const limit = deps.limit ?? DEFAULT_LIMIT;
  const logger = deps.logger;
  const detailDelay = deps.detailDelayMs ?? DETAIL_DELAY_MS;

  const listHtml = await httpGet(listUrl);
  const items = extractAxarquiaListLinks(listHtml);
  logger?.info("[axarquia-costa-del-sol] list", {
    listUrl,
    linksTotal: items.length,
  });

  const bounded = items.slice(0, Math.max(0, limit));
  const canonical: CanonicalEvent[] = [];

  for (let i = 0; i < bounded.length; i += 1) {
    const item = bounded[i];
    try {
      const html = await httpGet(item.detailUrl);
      const parsed = parseAxarquiaDetailPage(html, item.detailUrl);
      if (!parsed) {
        logger?.warn("[axarquia-costa-del-sol] parse skipped", {
          detailUrl: item.detailUrl,
        });
        continue;
      }
      const ev = axarquiaDetailToCanonical(parsed);
      if (ev) canonical.push(ev);
    } catch (e) {
      logger?.warn("[axarquia-costa-del-sol] detail fetch error", {
        detailUrl: item.detailUrl,
        error: (e as Error).message,
      });
    }
    if (i < bounded.length - 1 && detailDelay > 0) await sleep(detailDelay);
  }

  return canonical;
}

export const axarquiaCostaDelSolAdapter: SourceAdapter = {
  key: "axarquia-costa-del-sol",
  name: "Axarquía Costa del Sol · Agenda de eventos (APTA)",
  fetchEvents: async (ctx) => {
    try {
      return await runAxarquia({
        listUrl: ctx.source.base_url ?? LIST_URL,
        logger: ctx.logger,
      });
    } catch (e) {
      ctx.logger.error("[axarquia-costa-del-sol] fetch failed", {
        error: (e as Error).message,
      });
      return [];
    }
  },
};

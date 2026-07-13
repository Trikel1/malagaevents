// Junta de Andalucía · Agenda Cultural de Málaga (adapter_key: junta-andalucia-cultura).
//
// Source: https://www.juntadeandalucia.es/cultura/agendaculturaldeandalucia/malaga
// Robots.txt allows this path (no Disallow rule matches /cultura/agendaculturaldeandalucia/).
// Terms of use: contenido reutilizable citando la fuente (Aviso Legal Junta de Andalucía,
// avisolegal.pdf). Adapter stores `sourceUrl` on every event.
//
// Fetch strategy:
//   1. safeFetch the Málaga listing HTML → extract all
//      `/cultura/agendaculturaldeandalucia/evento/<slug>` URLs.
//   2. For each (bounded to 20/run), safeFetch the detail page and parse:
//        - schema.org Event JSON-LD (name, @id, url, description, image,
//          location.{name, address.{streetAddress, addressLocality,
//          addressRegion, postalCode, addressCountry}, geo.{latitude,
//          longitude}}).
//        - Wall-clock date+time from the Drupal wingsuit block
//          (fa-calendar + fa-clock icons, both wrapped in `text_base`).
//   3. Emit CanonicalEvent[] with externalId = `junta-<@id-or-slug>`.
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
  extractJuntaListLinks,
  parseJuntaDetailPage,
  type JuntaDetail,
} from "./lib/junta-visit.ts";

const LIST_URL =
  "https://www.juntadeandalucia.es/cultura/agendaculturaldeandalucia/malaga";
const DEFAULT_LIMIT = 20;
const DETAIL_DELAY_MS = 400;

export type HtmlGetter = (url: string) => Promise<string>;

export interface JuntaBuildDeps {
  /** Injected fetcher — production uses safeFetch, tests use fixtures. */
  httpGet?: HtmlGetter;
  limit?: number;
  detailDelayMs?: number;
  listUrl?: string;
  logger?: AdapterContext["logger"];
}

export function juntaDetailToCanonical(detail: JuntaDetail): CanonicalEvent | null {
  const start = madridWallTimeToDate(
    detail.year,
    detail.month,
    detail.day,
    detail.hour,
    detail.minute,
  );
  if (!start) return null;

  return {
    title: detail.title,
    description: detail.description,
    startAt: start.toISOString(),
    endAt: null,
    timezone: "Europe/Madrid",
    venueName: detail.venueName,
    venueAddress: detail.venueAddress,
    locality: detail.locality,
    category: null,
    imageUrl: detail.imageUrl,
    sourceUrl: detail.detailUrl,
    ticketUrl: null,
    priceText: null,
    externalId: `junta-${detail.externalId}`,
    organizer: "Junta de Andalucía",
    raw: null,
  };
}

/** Default HTML getter using safeFetch (used in production). */
export async function defaultJuntaHttpGet(url: string): Promise<string> {
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
  if (res.status !== 200) {
    throw new Error(`junta_http_${res.status}`);
  }
  return res.body;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function runJuntaAndalucia(
  deps: JuntaBuildDeps,
): Promise<CanonicalEvent[]> {
  const httpGet = deps.httpGet ?? defaultJuntaHttpGet;
  const listUrl = deps.listUrl ?? LIST_URL;
  const limit = deps.limit ?? DEFAULT_LIMIT;
  const logger = deps.logger;
  const detailDelay = deps.detailDelayMs ?? DETAIL_DELAY_MS;

  const listHtml = await httpGet(listUrl);
  const items = extractJuntaListLinks(listHtml);
  logger?.info("[junta-andalucia-cultura] list", {
    listUrl,
    linksTotal: items.length,
  });

  const bounded = items.slice(0, Math.max(0, limit));
  const canonical: CanonicalEvent[] = [];

  for (let i = 0; i < bounded.length; i += 1) {
    const item = bounded[i];
    try {
      const html = await httpGet(item.detailUrl);
      const parsed = parseJuntaDetailPage(html, item.detailUrl);
      if (!parsed) {
        logger?.warn("[junta-andalucia-cultura] parse failed", {
          detailUrl: item.detailUrl,
        });
        continue;
      }
      const ev = juntaDetailToCanonical(parsed);
      if (ev) canonical.push(ev);
    } catch (e) {
      logger?.warn("[junta-andalucia-cultura] detail fetch error", {
        detailUrl: item.detailUrl,
        error: (e as Error).message,
      });
    }
    if (i < bounded.length - 1 && detailDelay > 0) await sleep(detailDelay);
  }

  return canonical;
}

export const juntaAndaluciaCulturaAdapter: SourceAdapter = {
  key: "junta-andalucia-cultura",
  name: "Junta de Andalucía · Agenda Cultural de Málaga",
  fetchEvents: async (ctx) => {
    try {
      return await runJuntaAndalucia({
        listUrl: ctx.source.base_url ?? LIST_URL,
        logger: ctx.logger,
      });
    } catch (e) {
      ctx.logger.error("[junta-andalucia-cultura] fetch failed", {
        error: (e as Error).message,
      });
      return [];
    }
  },
};

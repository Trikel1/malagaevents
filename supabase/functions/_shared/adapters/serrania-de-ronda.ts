// Serranía de Ronda · Agenda de eventos (adapter_key: serrania-de-ronda).
//
// Source: https://www.serraniaderonda.com/portal/es/eventos.php
// Robots.txt is empty (no restrictions). Terms: Servicios de Internet
// Arundanet S.L. site advertising Serranía municipalities; content
// reproducible with attribution. We store `sourceUrl` on every event.
//
// Fetch strategy:
//   1. safeFetch the listing HTML (single-page — bounded 20 items).
//   2. Parse hCalendar microformat: <a class="vevent"> with abbr.dtstart /
//      abbr.dtend title=YYYY-MM-DD and strong.location.
//   3. Emit CanonicalEvent[] with externalId = `serrania-<slug>` and default
//      time 20:00 Europe/Madrid (source carries no time).
//
// SAFETY: pure adapter, no writes, no @supabase/supabase-js import.

import type {
  SourceAdapter,
  CanonicalEvent,
  AdapterContext,
} from "../ingestion/types.ts";
import { madridWallTimeToDate } from "../ingestion/dates.ts";
import { safeFetch } from "./lib/http.ts";
import { parseSerraniaListing, type SerraniaEvent } from "./lib/comarcas.ts";

const LIST_URL = "https://www.serraniaderonda.com/portal/es/eventos.php";
const DEFAULT_LIMIT = 20;

export type HtmlGetter = (url: string) => Promise<string>;

export interface SerraniaBuildDeps {
  httpGet?: HtmlGetter;
  limit?: number;
  listUrl?: string;
  logger?: AdapterContext["logger"];
}

export function serraniaDetailToCanonical(
  ev: SerraniaEvent,
): CanonicalEvent | null {
  const start = madridWallTimeToDate(ev.year, ev.month, ev.day, 20, 0);
  if (!start) return null;
  const end = madridWallTimeToDate(ev.endYear, ev.endMonth, ev.endDay, 23, 59);

  return {
    title: ev.title,
    description: ev.description,
    startAt: start.toISOString(),
    endAt: end && end.getTime() > start.getTime() ? end.toISOString() : null,
    timezone: "Europe/Madrid",
    venueName: ev.venueName,
    venueAddress: null,
    locality: ev.locality,
    category: null,
    imageUrl: ev.imageUrl,
    sourceUrl: ev.detailUrl,
    ticketUrl: null,
    priceText: null,
    externalId: `serrania-${ev.externalId}`,
    organizer: "Serranía de Ronda Turismo",
    raw: null,
  };
}

export async function defaultSerraniaHttpGet(url: string): Promise<string> {
  const res = await safeFetch(url, {
    accept: "text/html,application/xhtml+xml",
    headers: {
      "Accept-Language": "es-ES,es;q=0.9",
      "User-Agent":
        "Mozilla/5.0 (compatible; MalagaEventsBot/1.0; +https://malagaevents.lovable.app)",
    },
    timeoutMs: 30_000,
    maxBytes: 2_000_000,
  });
  if (res.status !== 200) throw new Error(`serrania_http_${res.status}`);
  return res.body;
}

export async function runSerrania(
  deps: SerraniaBuildDeps,
): Promise<CanonicalEvent[]> {
  const httpGet = deps.httpGet ?? defaultSerraniaHttpGet;
  const listUrl = deps.listUrl ?? LIST_URL;
  const limit = deps.limit ?? DEFAULT_LIMIT;
  const logger = deps.logger;

  const listHtml = await httpGet(listUrl);
  const items = parseSerraniaListing(listHtml);
  logger?.info("[serrania-de-ronda] list", {
    listUrl,
    linksTotal: items.length,
  });

  const bounded = items.slice(0, Math.max(0, limit));
  const canonical: CanonicalEvent[] = [];
  for (const it of bounded) {
    const ev = serraniaDetailToCanonical(it);
    if (ev) canonical.push(ev);
  }
  return canonical;
}

export const serraniaDeRondaAdapter: SourceAdapter = {
  key: "serrania-de-ronda",
  name: "Serranía de Ronda · Agenda de eventos",
  fetchEvents: async (ctx) => {
    try {
      return await runSerrania({
        listUrl: ctx.source.base_url ?? LIST_URL,
        logger: ctx.logger,
      });
    } catch (e) {
      ctx.logger.error("[serrania-de-ronda] fetch failed", {
        error: (e as Error).message,
      });
      return [];
    }
  },
};

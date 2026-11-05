// Palacio de Congresos y Exposiciones de la Costa del Sol (Torremolinos).
// Source: https://palacio-congresos.es — event pages under /evento/<slug>/.
// robots.txt only disallows /wp-admin/.

import type { CanonicalEvent, SourceAdapter } from "../ingestion/types.ts";
import {
  decodeHtml, fetchHtml, inferCongressCategory, isUpcoming, parseSpanishLongDate, wallToIso,
} from "./lib/congress-common.ts";

const LISTINGS = [
  "https://palacio-congresos.es/es/home/",
  "https://palacio-congresos.es/es/eventos/",
  "https://palacio-congresos.es/en/eventos-2/",
];
export const TORREMOLINOS_VENUE = "Palacio de Congresos de Torremolinos";

export function extractTorremolinosLinks(html: string): string[] {
  const set = new Set<string>();
  for (const m of html.matchAll(/href="(https:\/\/palacio-congresos\.es\/evento\/[a-z0-9-]+\/)"/g)) set.add(m[1]);
  return [...set];
}

export function parseTorremolinosDetail(html: string, url: string, now = Date.now()): CanonicalEvent | null {
  const title = decodeHtml(html.match(/<h1 class="product_title[^"]*">([\s\S]*?)<\/h1>/)?.[1] ?? "");
  if (!title) return null;
  const grab = (cls: string) =>
    decodeHtml(html.match(new RegExp(`${cls}[\\s\\S]*?media-heading">([\\s\\S]*?)</div>`))?.[1] ?? "");
  const startW = parseSpanishLongDate(grab("event-startdate"));
  const startAt = wallToIso(startW);
  if (!startAt) return null;
  const endW = parseSpanishLongDate(grab("event-enddate"));
  let endAt = endW ? wallToIso(endW.timeExplicit ? endW : { ...endW, hh: 23, mm: 59, timeExplicit: true }) : null;
  if (endAt && Date.parse(endAt) < Date.parse(startAt)) endAt = null;
  if (!isUpcoming(startAt, endAt, now)) return null;
  const img = html.match(/og:image" content="([^"]+)"/)?.[1] ?? null;
  const descRaw = html.match(/og:description" content="([^"]*)"/)?.[1] ?? "";
  const description = decodeHtml(descRaw) || null;
  const crumb = decodeHtml(html.match(/"position":"2","item":\{"name":"([^"]+)"/)?.[1] ?? "");
  const price = description?.match(/Entradas?:\s*([^.]{3,80})/i)?.[1] ?? null;
  const slug = url.match(/\/evento\/([^/]+)\//)?.[1] ?? url;
  return {
    title,
    description,
    startAt,
    endAt,
    timezone: "Europe/Madrid",
    venueName: TORREMOLINOS_VENUE,
    venueAddress: "C/ México 3, 29620 Torremolinos",
    locality: "Torremolinos",
    category: inferCongressCategory(`${title} ${description ?? ""}`, crumb),
    imageUrl: img,
    sourceUrl: url,
    priceText: price,
    externalId: slug,
    timeAssumed: !startW?.timeExplicit,
    raw: { adapter: "palacio-congresos-torremolinos", crumb },
  };
}

export const palacioCongresosTorremolinosAdapter: SourceAdapter = {
  key: "palacio-congresos-torremolinos",
  name: "Palacio de Congresos de Torremolinos",
  fetchEvents: async (ctx) => {
    const links = new Set<string>();
    for (const u of LISTINGS) {
      try {
        extractTorremolinosLinks(await fetchHtml(u)).forEach((l) => links.add(l));
      } catch (e) {
        ctx.logger.warn("torremolinos: listing failed", { url: u, error: (e as Error).message });
      }
    }
    const out: CanonicalEvent[] = [];
    for (const l of [...links].slice(0, 40)) {
      try {
        const ev = parseTorremolinosDetail(await fetchHtml(l), l);
        if (ev) out.push(ev);
      } catch (e) {
        ctx.logger.warn("torremolinos: detail failed", { url: l, error: (e as Error).message });
      }
    }
    ctx.logger.info("torremolinos: normalised", { links: links.size, returned: out.length });
    return out;
  },
};

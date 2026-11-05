// Palacio de Ferias y Congresos de Marbella (Adolfo Suárez).
// Source: https://www.marbellacongresos.com/eventos (Webflow CMS list, robots allows all).

import type { CanonicalEvent, SourceAdapter } from "../ingestion/types.ts";
import {
  decodeHtml, fetchHtml, inferCongressCategory, isUpcoming, parseDmyDate, wallToIso,
} from "./lib/congress-common.ts";

const BASE = "https://www.marbellacongresos.com";
export const MARBELLA_VENUE = "Palacio de Ferias y Congresos de Marbella";

export function parseMarbellaListing(html: string, now = Date.now()): CanonicalEvent[] {
  const out: CanonicalEvent[] = [];
  const items = html.split('role="listitem"').slice(1);
  const seen = new Set<string>();
  for (const it of items) {
    const title = decodeHtml(it.match(/<h2[^>]*>([\s\S]*?)<\/h2>/)?.[1] ?? "");
    const href = it.match(/href="(\/eventos\/[^"]+)"/)?.[1];
    if (!title || !href || seen.has(href)) continue;
    const blocks = [...it.matchAll(/class="text-block-14">([^<]*)</g)].map((m) => m[1].trim()).filter((s) => /\d/.test(s));
    const startW = parseDmyDate(blocks[0] ?? "") ?? parseDmyDate(decodeHtml(it.match(/class="text-block-11">([^<]*)</)?.[1] ?? ""));
    const startAt = wallToIso(startW);
    if (!startAt) continue;
    const endW = parseDmyDate(blocks[1] ?? "");
    let endAt = endW && endW.timeExplicit ? wallToIso(endW) : null;
    if (endAt && Date.parse(endAt) < Date.parse(startAt)) endAt = null;
    if (!isUpcoming(startAt, endAt, now)) continue;
    seen.add(href);
    const desc = decodeHtml(it.match(/class="paragraph-4">([\s\S]*?)<\/p>/)?.[1] ?? "") || null;
    const img = it.match(/<img[^>]+src="(https:\/\/[^"]+)"/)?.[1] ?? null;
    out.push({
      title,
      description: desc,
      startAt,
      endAt,
      timezone: "Europe/Madrid",
      venueName: MARBELLA_VENUE,
      venueAddress: "Calle José Meliá, 2, 29602 Marbella",
      locality: "Marbella",
      category: inferCongressCategory(`${title} ${desc ?? ""}`),
      imageUrl: img,
      sourceUrl: BASE + href,
      externalId: href.replace(/^\/eventos\//, ""),
      timeAssumed: !startW?.timeExplicit,
      raw: { adapter: "marbella-congresos" },
    });
  }
  return out;
}

export const marbellaCongresosAdapter: SourceAdapter = {
  key: "marbella-congresos",
  name: "Marbella Congresos",
  fetchEvents: async (ctx) => {
    const html = await fetchHtml(`${BASE}/eventos`);
    const events = parseMarbellaListing(html);
    ctx.logger.info("marbella-congresos: normalised", { returned: events.length });
    return events;
  },
};

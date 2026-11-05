// Eventos UMA — congresos, jornadas y conferencias de la Universidad de Málaga.
// Source: https://eventos.uma.es/ (robots allows /).

import type { CanonicalEvent, SourceAdapter } from "../ingestion/types.ts";
import {
  decodeHtml, fetchHtml, inferCongressCategory, isUpcoming, parseDmyDate, wallToIso,
} from "./lib/congress-common.ts";

const BASE = "https://eventos.uma.es";

function localityFromPlace(place: string): string {
  const p = place.toLowerCase();
  for (const town of ["Marbella", "Ronda", "Antequera", "Vélez-Málaga", "Torremolinos", "Fuengirola", "Benalmádena"]) {
    if (p.includes(town.toLowerCase())) return town;
  }
  return "Málaga";
}

export function parseUmaListing(html: string, now = Date.now()): CanonicalEvent[] {
  const out: CanonicalEvent[] = [];
  const seen = new Set<string>();
  const cards = html.split('class="o_event_container"').slice(1);
  for (const c of cards) {
    const m = c.match(/href="(https:\/\/eventos\.uma\.es\/event_detail\/(\d+)\/detail\/[^"]+)"/);
    if (!m || seen.has(m[2])) continue;
    const title = decodeHtml(c.match(/<strong>([\s\S]*?)<\/strong>/)?.[1] ?? "").replace(/\.$/, "");
    if (!title) continue;
    const place = decodeHtml(c.match(/other_data--place">([\s\S]*?)<\/p>/)?.[1] ?? "");
    const dates = decodeHtml(c.match(/<p class="other_data">([\s\S]*?)<\/p>/)?.[1] ?? "");
    const [a, b] = dates.split(/\s+-\s+/);
    const startAt = wallToIso(parseDmyDate(a ?? ""));
    if (!startAt) continue;
    const endW = b ? parseDmyDate(b) : null;
    const endAt = endW ? wallToIso({ ...endW, hh: 23, mm: 59, timeExplicit: true }) : null;
    if (!isUpcoming(startAt, endAt, now)) continue;
    seen.add(m[2]);
    const img = c.match(/<img[^>]+src="([^"]+)"/)?.[1];
    const tickets = c.match(/href="(\/event_detail\/\d+\/tickets\.html)"/)?.[1];
    out.push({
      title,
      description: null,
      startAt,
      endAt,
      timezone: "Europe/Madrid",
      venueName: place.split(",")[0] || "Universidad de Málaga",
      venueAddress: place || null,
      locality: localityFromPlace(place),
      category: inferCongressCategory(title, "congreso"),
      imageUrl: img ? (img.startsWith("http") ? img : BASE + img) : null,
      sourceUrl: m[1],
      ticketUrl: tickets ? BASE + tickets : null,
      externalId: m[2],
      organizer: "Universidad de Málaga",
      timeAssumed: true,
      raw: { adapter: "eventos-uma" },
    });
  }
  return out;
}

export const eventosUmaAdapter: SourceAdapter = {
  key: "eventos-uma",
  name: "Eventos UMA",
  fetchEvents: async (ctx) => {
    const html = await fetchHtml(`${BASE}/`);
    const events = parseUmaListing(html);
    ctx.logger.info("eventos-uma: normalised", { returned: events.length });
    return events;
  },
};

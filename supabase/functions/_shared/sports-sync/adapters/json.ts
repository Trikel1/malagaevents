// JSON normalized-feed adapter. Downloads a URL that MUST return an array
// matching CanonicalSportsEvent shape (see docs in the migration description).

import type { AdapterResult, CanonicalSportsEvent } from "../types.ts";

const ALLOWED_STATUS = new Set([
  "confirmed", "cancelled", "postponed",
  "cancelled_or_unpublished", "missing_from_feed",
]);

function coerce(raw: unknown, sourceName: string): CanonicalSportsEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const title = typeof r.title === "string" ? r.title.trim() : "";
  const starts_at = typeof r.starts_at === "string" ? r.starts_at : "";
  const municipality = typeof r.municipality === "string" ? r.municipality.trim() : "";
  const venue_name = typeof r.venue_name === "string" ? r.venue_name.trim() : "";
  const sport_category = typeof r.sport_category === "string" ? r.sport_category.trim() : "";
  if (!title || !starts_at || !municipality || !venue_name || !sport_category) return null;
  if (Number.isNaN(new Date(starts_at).getTime())) return null;

  const statusRaw = typeof r.status === "string" ? r.status : "confirmed";
  const status = (ALLOWED_STATUS.has(statusRaw) ? statusRaw : "confirmed") as CanonicalSportsEvent["status"];

  return {
    source_name: typeof r.source_name === "string" && r.source_name.trim() ? r.source_name.trim() : sourceName,
    source_url: typeof r.source_url === "string" ? r.source_url : "",
    external_id: typeof r.external_id === "string" && r.external_id.trim() ? r.external_id.trim() : null,
    canonical_url: typeof r.canonical_url === "string" ? r.canonical_url : null,
    title,
    description: typeof r.description === "string" ? r.description : null,
    sport_category,
    sport_subcategory: typeof r.sport_subcategory === "string" ? r.sport_subcategory : null,
    starts_at,
    ends_at: typeof r.ends_at === "string" ? r.ends_at : null,
    timezone: typeof r.timezone === "string" ? r.timezone : "Europe/Madrid",
    municipality,
    province: typeof r.province === "string" ? r.province : "Málaga",
    venue_name,
    address: typeof r.address === "string" ? r.address : null,
    lat: typeof r.lat === "number" ? r.lat : null,
    lng: typeof r.lng === "number" ? r.lng : null,
    price_amount: typeof r.price_amount === "number" ? r.price_amount : null,
    price_currency: typeof r.price_currency === "string" ? r.price_currency : null,
    registration_url: typeof r.registration_url === "string" ? r.registration_url : null,
    organizer_name: typeof r.organizer_name === "string" ? r.organizer_name : null,
    organizer_phone: typeof r.organizer_phone === "string" ? r.organizer_phone : null,
    organizer_email: typeof r.organizer_email === "string" ? r.organizer_email : null,
    status,
    image_url: typeof r.image_url === "string" ? r.image_url : null,
    last_seen_at: typeof r.last_seen_at === "string" ? r.last_seen_at : null,
  };
}

export function parseJsonFeed(payload: unknown, sourceName: string): CanonicalSportsEvent[] {
  if (!Array.isArray(payload)) return [];
  const out: CanonicalSportsEvent[] = [];
  for (const item of payload) {
    const ev = coerce(item, sourceName);
    if (ev) out.push(ev);
  }
  return out;
}

export async function fetchJsonFeed(url: string, sourceName: string): Promise<AdapterResult> {
  const res = await fetch(url, {
    headers: { "accept": "application/json", "user-agent": "MalagaEventsBot/1.0 (+lovable)" },
  });
  if (!res.ok) throw new Error(`json feed HTTP ${res.status}`);
  const json = await res.json();
  return { source_name: sourceName, events: parseJsonFeed(json, sourceName) };
}

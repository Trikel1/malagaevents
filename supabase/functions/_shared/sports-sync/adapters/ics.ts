// ICS → CanonicalSportsEvent adapter. Wraps the shared iCalendar parser.
//
// Notes:
// - Uses the shared cultural ICS parser (RFC 5545 compliant) — do not fork.
// - Applies a bounded future window (today-30d..today+180d).
// - Preserves the original UID as external_id for stable dedupe across runs.
// - Naive local DTSTART without TZID is assumed Europe/Madrid.

import type { CanonicalSportsEvent } from "../types.ts";
import { parseIcs, type IcsDateTime, type IcsEvent } from "../../adapters/lib/ics.ts";

export interface IcsAdapterOptions {
  sourceName: string;
  sourceUrl: string;
  defaultMunicipality: string;
  defaultCategory: string;
  /** Optional filter to drop irrelevant events (e.g. training-only). */
  keep?: (ev: CanonicalSportsEvent) => boolean;
}

function icsDateToIso(dt: IcsDateTime | null): string | null {
  if (!dt) return null;
  if (dt.iso) {
    // date-only "YYYY-MM-DD" → 00:00 Europe/Madrid
    if (dt.kind === "date" && /^\d{4}-\d{2}-\d{2}$/.test(dt.iso)) {
      return `${dt.iso}T00:00:00+01:00`;
    }
    if (dt.kind === "date-time-local") {
      // Naive local → assume Europe/Madrid (+01:00 canonical)
      if (/T\d{2}:\d{2}:\d{2}$/.test(dt.iso)) return `${dt.iso}+01:00`;
    }
    return dt.iso;
  }
  return null;
}

function mapStatus(raw: string): CanonicalSportsEvent["status"] {
  const s = raw.toUpperCase();
  if (s === "CANCELLED") return "cancelled";
  if (s === "TENTATIVE") return "postponed";
  return "confirmed";
}

function toCanonical(e: IcsEvent, opts: IcsAdapterOptions): CanonicalSportsEvent | null {
  const title = e.summary?.trim();
  const starts = icsDateToIso(e.dtstart);
  if (!title || !starts) return null;

  const ends = icsDateToIso(e.dtend);
  const uid = e.uid?.trim();
  const url = e.url?.trim() || null;
  const external_id = uid && uid.length > 0
    ? uid
    : `${title}|${starts}`.toLowerCase().replace(/[^\w:/.\-]+/g, "-");

  const ev: CanonicalSportsEvent = {
    source_name: opts.sourceName,
    source_url: opts.sourceUrl,
    external_id,
    canonical_url: url,
    title,
    description: e.description || null,
    sport_category: opts.defaultCategory,
    sport_subcategory: null,
    starts_at: starts,
    ends_at: ends,
    timezone: "Europe/Madrid",
    municipality: opts.defaultMunicipality,
    province: "Málaga",
    venue_name: e.location?.trim() || opts.defaultMunicipality,
    address: e.location?.trim() || null,
    lat: e.geo?.lat ?? null,
    lng: e.geo?.lng ?? null,
    price_amount: null,
    price_currency: null,
    registration_url: url,
    organizer_name: null,
    organizer_phone: null,
    organizer_email: null,
    status: mapStatus(e.status),
    image_url: null,
    last_seen_at: null,
  };

  return ev;
}

export function parseSportsIcs(
  icsText: string,
  opts: IcsAdapterOptions,
): CanonicalSportsEvent[] {
  const cal = parseIcs(icsText);
  const now = Date.now();
  const minStart = now - 30 * 86400_000;
  const maxStart = now + 180 * 86400_000;

  const out: CanonicalSportsEvent[] = [];
  const seen = new Set<string>();
  for (const e of cal.events) {
    const c = toCanonical(e, opts);
    if (!c) continue;
    const ms = Date.parse(c.starts_at);
    if (Number.isNaN(ms) || ms < minStart || ms > maxStart) continue;
    if (opts.keep && !opts.keep(c)) continue;
    const key = c.external_id ?? `${c.title}|${c.starts_at}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

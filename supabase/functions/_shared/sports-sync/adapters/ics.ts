// ICS → CanonicalSportsEvent adapter. Wraps the shared iCalendar parser.
//
// Notes:
// - Uses the shared cultural ICS parser (RFC 5545 compliant) — do not fork.
// - Applies a bounded future window (today-30d..today+180d).
// - Preserves the original UID as external_id for stable dedupe across runs.
// - Naive local DTSTART without TZID is assumed Europe/Madrid.

import type { CanonicalSportsEvent } from "../types.ts";
import { parseIcs, type IcsEvent } from "../../adapters/lib/ics.ts";
import { sportsIcsDateToIso } from './ics-date.ts';
import { resolvePlacement } from "../placement.ts";

export interface IcsAdapterOptions {
  sourceName: string;
  sourceUrl: string;
  defaultMunicipality: string;
  defaultCategory: string;
  /** Optional filter to drop irrelevant events (e.g. training-only). */
  keep?: (ev: CanonicalSportsEvent) => boolean;
}

function mapStatus(raw: string): CanonicalSportsEvent["status"] {
  const s = raw.toUpperCase();
  if (s === "CANCELLED") return "cancelled";
  if (s === "TENTATIVE") return "postponed";
  return "confirmed";
}

function toCanonical(e: IcsEvent, opts: IcsAdapterOptions): CanonicalSportsEvent | null {
  const title = e.summary?.trim();
  const starts = sportsIcsDateToIso(e.dtstart);
  if (!title || !starts) return null;

  const ends = sportsIcsDateToIso(e.dtend);
  if (ends && Date.parse(ends) < Date.parse(starts)) return null;
  const uid = e.uid?.trim();
  const url = e.url?.trim() || null;
  const external_id = uid && uid.length > 0
    ? uid
    : `${title}|${starts}`.toLowerCase().replace(/[^\w:/.\-]+/g, "-");

  const placement = resolvePlacement({
    venueName: e.location?.trim() || null,
    address: e.location?.trim() || null,
    defaultMunicipality: opts.defaultMunicipality,
  });

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
    // A calendar that names no place does not put the event in a town: the
    // source's default municipality is a hint, not evidence.
    municipality: placement.municipality ?? "",
    province: placement.inMalagaProvince ? "Málaga" : "",
    // A calendar without LOCATION does not tell us where the match is played.
    // Leave it empty (downstream eligibility treats it as unknown) instead of
    // fabricating the source's default municipality as a venue.
    venue_name: placement.venueName ?? "",

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

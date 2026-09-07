// Generic HTML adapter for sports sources.
//
// Strategy — most modern municipal / official sports pages emit
// schema.org JSON-LD `<script type="application/ld+json">` with @type: Event
// or SportsEvent. We rely on that as the primary source because it is
// stable, machine-readable and copied nearly verbatim across CMSs.
//
// If no JSON-LD Event is found, we fall back to a very small microdata /
// heuristic scan (article tags with a datetime attribute). If neither yields
// events, we return []. The caller MUST treat an empty result as "no data
// this run" rather than "everything is cancelled" — deactivation is only
// safe when the parse succeeds AND yields events, which the sync engine
// enforces separately.
//
// Pure module — safe to unit test from vitest.

import type { CanonicalSportsEvent } from "../types.ts";
import { classifyDiscipline, resolvePlacement } from "../placement.ts";

export interface HtmlAdapterOptions {
  sourceName: string;
  sourceUrl: string;
  /** Default municipality if the JSON-LD does not provide one. */
  defaultMunicipality: string;
  /** Default sport category label. */
  defaultCategory: string;
  /** Optional additional filter (e.g. reject non-municipality entries). */
  keep?: (ev: CanonicalSportsEvent) => boolean;
  /** Optional canonical URL rewriter (relative → absolute). */
  baseUrl?: string;
}

/**
 * Extracts every `<script type="application/ld+json">` payload from an HTML
 * string. Robust against attribute ordering and CRLF folding.
 */
export function extractJsonLdBlocks(html: string): unknown[] {
  const out: unknown[] = [];
  const re = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const raw = m[1].trim();
    if (!raw) continue;
    try {
      out.push(JSON.parse(raw));
    } catch {
      // Some CMSs concatenate multiple JSON objects; try splitting on }\s*{ once.
      try {
        const stitched = "[" + raw.replace(/}\s*{/g, "},{") + "]";
        out.push(JSON.parse(stitched));
      } catch { /* skip */ }
    }
  }
  return out;
}

function flattenGraph(node: unknown, acc: Record<string, unknown>[]) {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const item of node) flattenGraph(item, acc);
    return;
  }
  if (typeof node !== "object") return;
  const obj = node as Record<string, unknown>;
  if (Array.isArray(obj["@graph"])) flattenGraph(obj["@graph"], acc);
  acc.push(obj);
}

function normType(t: unknown): string[] {
  if (Array.isArray(t)) return t.map(String).map((x) => x.toLowerCase());
  if (typeof t === "string") return [t.toLowerCase()];
  return [];
}

function isEventNode(obj: Record<string, unknown>): boolean {
  const types = normType(obj["@type"]);
  return types.some((t) =>
    t === "event" || t === "sportsevent" || t.endsWith("event")
  );
}

function toIsoMadrid(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw) return null;
  // Date-only "2026-04-15" → treat as all-day 00:00 Europe/Madrid, which in
  // summer is +02:00 and winter +01:00. For DST-neutral canonicalization we
  // emit a naive local ISO with +01:00; downstream store keeps it stable.
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return `${raw}T00:00:00+01:00`;
  }
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function pickString(...vals: unknown[]): string | null {
  for (const v of vals) if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}

interface PickedLocation {
  name: string | null;
  address: string | null;
  /** addressLocality as published — the town the source actually declares. */
  locality: string | null;
}

function pickLocation(obj: unknown): PickedLocation {
  const empty: PickedLocation = { name: null, address: null, locality: null };
  if (!obj) return empty;
  if (typeof obj === "string") return { ...empty, name: obj.trim() };
  if (Array.isArray(obj)) return pickLocation(obj[0]);
  if (typeof obj !== "object") return empty;
  const r = obj as Record<string, unknown>;
  const name = pickString(r.name);
  let address: string | null = null;
  let locality: string | null = null;
  if (typeof r.address === "string") address = r.address;
  else if (r.address && typeof r.address === "object") {
    const a = r.address as Record<string, unknown>;
    locality = pickString(a.addressLocality);
    address = [a.streetAddress, a.addressLocality, a.postalCode]
      .filter((x): x is string => typeof x === "string" && !!x.trim())
      .join(", ") || null;
  }
  return { name, address, locality };
}

function pickOfferPrice(obj: unknown): { amount: number | null; currency: string | null } {
  if (!obj) return { amount: null, currency: null };
  const first = Array.isArray(obj) ? obj[0] : obj;
  if (!first || typeof first !== "object") return { amount: null, currency: null };
  const r = first as Record<string, unknown>;
  const priceRaw = r.price;
  const cur = typeof r.priceCurrency === "string" ? r.priceCurrency : null;
  let amount: number | null = null;
  if (typeof priceRaw === "number") amount = priceRaw;
  else if (typeof priceRaw === "string" && priceRaw.trim() !== "") {
    const n = Number(priceRaw.replace(",", "."));
    if (!Number.isNaN(n)) amount = n;
  }
  return { amount, currency: cur };
}

function pickImage(obj: unknown): string | null {
  if (!obj) return null;
  if (typeof obj === "string") return obj;
  if (Array.isArray(obj)) return pickImage(obj[0]);
  if (typeof obj === "object" && obj !== null) {
    const r = obj as Record<string, unknown>;
    return pickString(r.url);
  }
  return null;
}

function pickOrganizer(obj: unknown): { name: string | null; phone: string | null; email: string | null } {
  const first = Array.isArray(obj) ? obj[0] : obj;
  if (!first || typeof first !== "object") return { name: null, phone: null, email: null };
  const r = first as Record<string, unknown>;
  return {
    name: pickString(r.name),
    phone: pickString(r.telephone),
    email: pickString(r.email),
  };
}

function absolutize(url: string | null, base: string | undefined): string | null {
  if (!url) return null;
  try { return new URL(url, base).toString(); } catch { return url; }
}

/**
 * Given an already-fetched HTML string, extract sports events.
 * Fetching is done by the caller so tests can supply fixtures directly.
 */
export function parseSportsHtml(
  html: string,
  opts: HtmlAdapterOptions,
): CanonicalSportsEvent[] {
  const results: CanonicalSportsEvent[] = [];
  const now = Date.now();
  const minStart = now - 30 * 86400_000; // 30 days back window for recent
  const maxStart = now + 180 * 86400_000; // 180 days forward window

  const blocks = extractJsonLdBlocks(html);
  const flat: Record<string, unknown>[] = [];
  for (const b of blocks) flattenGraph(b, flat);

  for (const obj of flat) {
    if (!isEventNode(obj)) continue;

    const title = pickString(obj.name, obj.headline);
    const starts = toIsoMadrid(obj.startDate);
    if (!title || !starts) continue;

    const startMs = Date.parse(starts);
    if (Number.isNaN(startMs)) continue;
    if (startMs < minStart || startMs > maxStart) continue;

    const ends = toIsoMadrid(obj.endDate);
    const loc = pickLocation(obj.location);
    const url = absolutize(
      pickString(obj.url, obj["@id"]),
      opts.baseUrl ?? opts.sourceUrl,
    );
    const desc = pickString(obj.description);

    const placement = resolvePlacement({
      venueName: loc.name,
      address: loc.address,
      declaredLocality: loc.locality,
      defaultMunicipality: opts.defaultMunicipality,
    });

    // Explicit non-sport content (processions, concerts, exhibitions) must not
    // leak into the sports agenda through a generic source.
    const classified = classifyDiscipline(title, desc, loc.name);
    if (classified.isNonSport) continue;

    const offer = pickOfferPrice(obj.offers);
    const image = absolutize(pickImage(obj.image), opts.baseUrl ?? opts.sourceUrl);
    const org = pickOrganizer(obj.organizer);

    const statusRaw = pickString(obj.eventStatus) ?? "";
    const status: CanonicalSportsEvent["status"] =
      /cancelled/i.test(statusRaw) ? "cancelled" :
      /postponed/i.test(statusRaw) ? "postponed" :
      "confirmed";

    // Stable external id: prefer @id/url, fall back to slug of title+start.
    const idBasis = pickString(obj["@id"], obj.identifier) ?? url ?? `${title}|${starts}`;
    const external_id = idBasis
      .toLowerCase()
      .replace(/[^\w:/.\-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 200);

    const ev: CanonicalSportsEvent = {
      source_name: opts.sourceName,
      source_url: opts.sourceUrl,
      external_id,
      canonical_url: url,
      title,
      description: desc,
      sport_category: classified.discipline ?? opts.defaultCategory,
      sport_subcategory: null,
      starts_at: starts,
      ends_at: ends,
      timezone: "Europe/Madrid",
      // Placement comes from what the page published, never from the
      // source's default: a missing venue must not become "Málaga".
      municipality: placement.municipality ?? "",
      province: placement.inMalagaProvince ? "Málaga" : "",
      venue_name: placement.venueName ?? "",
      address: loc.address,
      lat: null,
      lng: null,
      price_amount: offer.amount,
      price_currency: offer.currency,
      registration_url: url,
      organizer_name: org.name,
      organizer_phone: org.phone,
      organizer_email: org.email,
      status,
      image_url: image,
      last_seen_at: null,
    };

    if (opts.keep && !opts.keep(ev)) continue;
    results.push(ev);
  }

  return dedupeByExternalId(results);
}

function dedupeByExternalId(events: CanonicalSportsEvent[]): CanonicalSportsEvent[] {
  const seen = new Map<string, CanonicalSportsEvent>();
  for (const e of events) {
    const key = e.external_id ?? `${e.title}|${e.starts_at}`;
    if (!seen.has(key)) seen.set(key, e);
  }
  return [...seen.values()];
}

/**
 * Discover ICS export URLs in an HTML page by looking for hrefs ending in
 * `.ics`, `/ics`, an explicit calendar MIME type or common export tokens.
 */
export function discoverIcsUrls(html: string, baseUrl: string): string[] {
  const out = new Set<string>();
  const re = /<(?:a|link)\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const tag = m[0];
    const href = tag.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1]?.replace(/&amp;/gi, '&');
    if (!href) continue;
    const calendarMime = /\btype\s*=\s*["']text\/calendar(?:;[^"']*)?["']/i.test(tag);
    if (!calendarMime && !/(?:\.ics|\/ics\/?)(?:\?|#|$)/i.test(href) && !/format=ical|export.*ical/i.test(href)) continue;
    try {
      const url = new URL(href, baseUrl);
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) continue;
      url.hash = '';
      out.add(url.toString());
    } catch { /* skip malformed links */ }
  }
  return [...out];
}

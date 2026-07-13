// JSON-LD extractor for HTML pages that expose schema.org Event data.
//
// Contract:
// - Scans <script type="application/ld+json"> blocks from an HTML string.
// - Skips blocks that fail JSON parse (does not throw).
// - Flattens `@graph` arrays and top-level arrays.
// - `extractEvents()` returns only nodes whose `@type` is `Event` or one of
//   its schema.org subtypes, normalized into a shape that ingestion adapters
//   can map directly to `CanonicalEvent`.
// - Never throws on malformed dates; leaves them as `null`.

import { safeFetch, type SafeFetchOptions } from "./http.ts";

const EVENT_TYPES = new Set([
  "Event",
  "MusicEvent",
  "TheaterEvent",
  "DanceEvent",
  "ComedyEvent",
  "ExhibitionEvent",
  "Festival",
  "SocialEvent",
  "EducationEvent",
  "ChildrensEvent",
  "SportsEvent",
  "ScreeningEvent",
  "LiteraryEvent",
  "VisualArtsEvent",
  "BusinessEvent",
]);

export interface JsonLdOffer {
  price: string | null;
  priceCurrency: string | null;
  url: string | null;
  availability: string | null;
  validFrom: string | null;
}

export interface JsonLdLocation {
  name: string | null;
  address: string | null;
  locality: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  url: string | null;
}

export interface JsonLdEvent {
  id: string | null;
  name: string;
  description: string;
  url: string | null;
  image: string | null;
  startDate: string | null;
  endDate: string | null;
  doorTime: string | null;
  eventStatus: string | null;
  eventAttendanceMode: string | null;
  location: JsonLdLocation | null;
  organizer: string | null;
  performer: string | null;
  offers: JsonLdOffer[];
  types: string[];
  /** Verbatim node, useful for logging when normalization fails. */
  raw: Record<string, unknown>;
}

// --- helpers ------------------------------------------------------------------

function asString(v: unknown): string | null {
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return null;
}

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function coerceTypes(t: unknown): string[] {
  if (!t) return [];
  if (typeof t === "string") return [t];
  if (Array.isArray(t))
    return t.filter((x): x is string => typeof x === "string");
  return [];
}

function first<T>(v: T | T[] | undefined | null): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

// --- HTML scan ----------------------------------------------------------------

/**
 * Extracts *all* JSON-LD blocks from an HTML document. Silently drops blocks
 * that fail to parse — real-world pages ship malformed JSON-LD too often to
 * make that fatal.
 */
export function extractJsonLdBlocks(html: string): unknown[] {
  const out: unknown[] = [];
  const re =
    /<script\b[^>]*type=("application\/ld\+json"|'application\/ld\+json')[^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const raw = m[2].trim();
    if (!raw) continue;
    try {
      out.push(JSON.parse(raw));
    } catch {
      // Try one common recovery: strip HTML comments that wrap the block.
      const cleaned = raw.replace(/^<!--/, "").replace(/-->$/, "").trim();
      try {
        out.push(JSON.parse(cleaned));
      } catch {
        /* skip malformed block */
      }
    }
  }
  return out;
}

/**
 * Walks arbitrary JSON-LD trees (arrays, `@graph`, nested nodes) and yields
 * every object node. Prevents runaway recursion via depth cap.
 */
function* walk(node: unknown, depth = 0): Generator<Record<string, unknown>> {
  if (depth > 8 || node == null) return;
  if (Array.isArray(node)) {
    for (const n of node) yield* walk(n, depth + 1);
    return;
  }
  if (typeof node !== "object") return;
  const rec = node as Record<string, unknown>;
  yield rec;
  const graph = rec["@graph"];
  if (graph) yield* walk(graph, depth + 1);
}

function normalizeLocation(loc: unknown): JsonLdLocation | null {
  if (!loc || typeof loc !== "object") return null;
  const rec = loc as Record<string, unknown>;
  const address = rec.address;
  const addressRec =
    address && typeof address === "object"
      ? (address as Record<string, unknown>)
      : {};
  const geo = rec.geo;
  const geoRec =
    geo && typeof geo === "object" ? (geo as Record<string, unknown>) : {};

  const addressLine =
    asString(addressRec.streetAddress) ??
    (typeof address === "string" ? address : null);

  return {
    name: asString(rec.name),
    address: addressLine,
    locality: asString(addressRec.addressLocality),
    region: asString(addressRec.addressRegion),
    postalCode: asString(addressRec.postalCode),
    country: asString(addressRec.addressCountry),
    latitude: asNumber(geoRec.latitude),
    longitude: asNumber(geoRec.longitude),
    url: asString(rec.url),
  };
}

function normalizeOffers(offers: unknown): JsonLdOffer[] {
  if (!offers) return [];
  const arr = Array.isArray(offers) ? offers : [offers];
  const out: JsonLdOffer[] = [];
  for (const o of arr) {
    if (!o || typeof o !== "object") continue;
    const r = o as Record<string, unknown>;
    out.push({
      price: asString(r.price),
      priceCurrency: asString(r.priceCurrency),
      url: asString(r.url),
      availability: asString(r.availability),
      validFrom: asString(r.validFrom),
    });
  }
  return out;
}

function normalizeAgent(agent: unknown): string | null {
  const one = first(agent);
  if (!one) return null;
  if (typeof one === "string") return one;
  if (typeof one === "object")
    return asString((one as Record<string, unknown>).name);
  return null;
}

function normalizeEvent(node: Record<string, unknown>): JsonLdEvent {
  return {
    id: asString(node["@id"]),
    name: asString(node.name) ?? "",
    description: asString(node.description) ?? "",
    url: asString(node.url),
    image: (() => {
      const img = first(node.image);
      if (typeof img === "string") return img;
      if (img && typeof img === "object")
        return asString((img as Record<string, unknown>).url);
      return null;
    })(),
    startDate: asString(node.startDate),
    endDate: asString(node.endDate),
    doorTime: asString(node.doorTime),
    eventStatus: asString(node.eventStatus),
    eventAttendanceMode: asString(node.eventAttendanceMode),
    location: normalizeLocation(first(node.location)),
    organizer: normalizeAgent(node.organizer),
    performer: normalizeAgent(node.performer),
    offers: normalizeOffers(node.offers),
    types: coerceTypes(node["@type"]),
    raw: node,
  };
}

/**
 * Given an HTML document, returns every schema.org Event (or subtype) found
 * inside JSON-LD blocks, normalized.
 */
export function extractEvents(html: string): JsonLdEvent[] {
  const blocks = extractJsonLdBlocks(html);
  const out: JsonLdEvent[] = [];
  for (const block of blocks) {
    for (const node of walk(block)) {
      const types = coerceTypes(node["@type"]);
      if (types.some((t) => EVENT_TYPES.has(t))) {
        out.push(normalizeEvent(node));
      }
    }
  }
  return out;
}

export async function fetchEvents(
  url: string,
  opts: SafeFetchOptions = {},
): Promise<JsonLdEvent[]> {
  const res = await safeFetch(url, {
    accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
    ...opts,
  });
  return extractEvents(res.body);
}

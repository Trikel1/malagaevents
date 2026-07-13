// Pure parsers for Bloque 5 comarca sources (Axarquía Costa del Sol +
// Serranía de Ronda). No network, no Deno globals — trivially unit-testable
// from vitest. Never throw; return null when essential fields are missing.
//
// ---------------------------------------------------------------------------
// AXARQUÍA (axarquiacostadelsol.es)
// ---------------------------------------------------------------------------
//   • WordPress + The Events Calendar plugin.
//   • Listing exposes canonical detail URLs like /evento/<slug>/.
//   • Detail pages carry a schema.org Event JSON-LD with location.address
//     (streetAddress, addressLocality, addressRegion, postalCode). We ONLY
//     accept events whose region matches "Málaga" (or postal code starts
//     with 29) — this filters out neighbouring Granada events (e.g.
//     Almuñécar) that the mancomunidad also advertises.
//
// ---------------------------------------------------------------------------
// SERRANÍA DE RONDA (serraniaderonda.com)
// ---------------------------------------------------------------------------
//   • Static PHP site emitting proper hCalendar microformat (class="vevent"
//     with abbr.dtstart/dtend title=YYYY-MM-DD and strong.location).
//   • No time information — default 20:00 Europe/Madrid.
//   • Multi-town locations ("Montejaque, Ronda, Cortes de la Frontera") are
//     split on commas and the first token is used as `locality`.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AxarquiaListItem {
  externalId: string; // slug of /evento/<slug>/
  detailUrl: string;
}

export interface AxarquiaDetail {
  externalId: string;
  slug: string;
  title: string;
  description: string | null;
  detailUrl: string;
  imageUrl: string | null;
  venueName: string | null;
  venueAddress: string | null;
  locality: string; // canonical addressLocality (Málaga municipality)
  region: string | null;
  postalCode: string | null;
  organizer: string | null;
  /** Wall-clock components in Europe/Madrid — no time in source, defaults to 20:00. */
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  hasExplicitTime: boolean;
  /** end date components (single-day events set end == start). */
  endYear: number;
  endMonth: number;
  endDay: number;
}

export interface SerraniaEvent {
  externalId: string; // slug
  title: string;
  description: string | null;
  detailUrl: string;
  imageUrl: string | null;
  locality: string;
  venueName: string | null;
  year: number;
  month: number;
  day: number;
  endYear: number;
  endMonth: number;
  endDay: number;
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&#x27;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&iexcl;/g, "¡")
    .replace(/&iquest;/g, "¿")
    .replace(/&aacute;/g, "á")
    .replace(/&eacute;/g, "é")
    .replace(/&iacute;/g, "í")
    .replace(/&oacute;/g, "ó")
    .replace(/&uacute;/g, "ú")
    .replace(/&ntilde;/g, "ñ")
    .replace(/&Aacute;/g, "Á")
    .replace(/&Eacute;/g, "É")
    .replace(/&Iacute;/g, "Í")
    .replace(/&Oacute;/g, "Ó")
    .replace(/&Uacute;/g, "Ú")
    .replace(/&Ntilde;/g, "Ñ")
    .replace(/&hellip;/g, "…");
}

function stripTags(s: string): string {
  return decodeHtmlEntities(s.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
}

function slugFromUrl(url: string, prefix: string): string | null {
  const m = url.match(new RegExp(prefix + "([a-z0-9][a-z0-9\\-]*)/?$"));
  return m ? m[1] : null;
}

// ---------------------------------------------------------------------------
// Axarquía
// ---------------------------------------------------------------------------

const AX_DETAIL_RE = /https:\/\/axarquiacostadelsol\.es\/evento\/([a-z0-9][a-z0-9\-]*)\/?/g;

/** Extract unique detail URLs from the Axarquía listing HTML. */
export function extractAxarquiaListLinks(html: string): AxarquiaListItem[] {
  const seen = new Set<string>();
  const out: AxarquiaListItem[] = [];
  for (const m of html.matchAll(AX_DETAIL_RE)) {
    const slug = m[1];
    if (seen.has(slug)) continue;
    seen.add(slug);
    out.push({
      externalId: slug,
      detailUrl: `https://axarquiacostadelsol.es/evento/${slug}/`,
    });
  }
  return out;
}

function findJsonLdEvents(html: string): unknown[] {
  const out: unknown[] = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const m of html.matchAll(re)) {
    const raw = m[1].trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of arr) {
        if (item && typeof item === "object") {
          const t = (item as { "@type"?: string | string[] })["@type"];
          if (t === "Event" || (Array.isArray(t) && t.includes("Event"))) {
            out.push(item);
          }
        }
      }
    } catch {
      // ignore malformed blocks
    }
  }
  return out;
}

interface AxarquiaJsonLd {
  name?: string;
  description?: string;
  image?: string | string[];
  url?: string;
  startDate?: string;
  endDate?: string;
  location?: {
    name?: string;
    address?: {
      streetAddress?: string;
      addressLocality?: string;
      addressRegion?: string;
      postalCode?: string;
      addressCountry?: string;
    };
  };
  organizer?: { name?: string } | string;
}

/**
 * Parse an Axarquía Costa del Sol detail page. Requires the JSON-LD Event to
 * include an addressLocality inside Málaga (region "Málaga" OR postal code
 * starting with 29). Returns null otherwise — we never invent locality.
 */
export function parseAxarquiaDetailPage(
  html: string,
  detailUrl: string,
): AxarquiaDetail | null {
  const events = findJsonLdEvents(html);
  if (events.length === 0) return null;
  const ev = events[0] as AxarquiaJsonLd;
  if (!ev.name || !ev.startDate) return null;

  const address = ev.location?.address ?? {};
  const region = (address.addressRegion ?? "").trim() || null;
  const postalCode = (address.postalCode ?? "").trim() || null;
  const locality = (address.addressLocality ?? "").trim();
  const inMalaga =
    region?.toLowerCase() === "málaga" ||
    region?.toLowerCase() === "malaga" ||
    (postalCode ?? "").startsWith("29");
  if (!locality || !inMalaga) return null;

  const start = parseAxarquiaIsoDate(ev.startDate);
  if (!start) return null;
  const end = ev.endDate ? parseAxarquiaIsoDate(ev.endDate) : start;

  const image = Array.isArray(ev.image) ? ev.image[0] : ev.image;
  const description = ev.description ? stripTags(ev.description) : null;
  const organizer =
    typeof ev.organizer === "string"
      ? ev.organizer
      : ev.organizer?.name?.trim() || null;

  const slug =
    slugFromUrl(detailUrl, "https://axarquiacostadelsol.es/evento/") ??
    slugFromUrl(ev.url ?? detailUrl, "https://axarquiacostadelsol.es/evento/") ??
    "unknown";

  return {
    externalId: slug,
    slug,
    title: stripTags(ev.name),
    description,
    detailUrl,
    imageUrl: image ?? null,
    venueName: ev.location?.name?.trim() || null,
    venueAddress: address.streetAddress?.trim() || null,
    locality,
    region,
    postalCode,
    organizer,
    year: start.y,
    month: start.m,
    day: start.d,
    hour: 20,
    minute: 0,
    hasExplicitTime: false,
    endYear: end?.y ?? start.y,
    endMonth: end?.m ?? start.m,
    endDay: end?.d ?? start.d,
  };
}

/** Parse a "YYYY-MM-DDTHH:mm:ss[±zz]" string into date parts. */
function parseAxarquiaIsoDate(s: string): { y: number; m: number; d: number } | null {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return { y: parseInt(m[1], 10), m: parseInt(m[2], 10), d: parseInt(m[3], 10) };
}

// ---------------------------------------------------------------------------
// Serranía de Ronda
// ---------------------------------------------------------------------------

const SERRANIA_BASE = "https://www.serraniaderonda.com/portal/es/";

/**
 * Extract every vevent block from the Serranía de Ronda listing.
 * Uses simple substring boundaries — the site emits an anchor per event with
 * a well-defined class="vevent".
 */
export function parseSerraniaListing(html: string): SerraniaEvent[] {
  const events: SerraniaEvent[] = [];
  // Split on <a class='vevent' href='...'> boundaries (single-quoted attrs).
  const anchorRe =
    /<a[^>]+class=['"]vevent['"][^>]+href=['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/a>/g;
  const seen = new Set<string>();
  for (const m of html.matchAll(anchorRe)) {
    const href = m[1];
    const inner = m[2];
    const slug = href.replace(/^.*\/eventos\//, "").replace(/\/$/, "").trim();
    if (!slug || seen.has(slug)) continue;

    const dtstart = inner.match(
      /class=['"][^'"]*dtstart[^'"]*['"][^>]*title=['"](\d{4})-(\d{2})-(\d{2})['"]/,
    );
    if (!dtstart) continue;
    const dtend = inner.match(
      /class=['"][^'"]*dtend[^'"]*['"][^>]*title=['"](\d{4})-(\d{2})-(\d{2})['"]/,
    );

    const summaryM = inner.match(/class=['"]summary['"][^>]*>([^<]+)</);
    if (!summaryM) continue;

    const locM = inner.match(/class=['"]location['"][^>]*>([^<]+)</);
    const descM = inner.match(/class=['"]description['"][^>]*>([\s\S]*?)<\/span>/);
    const imgM = inner.match(/<img[^>]+src=['"]([^'"]+)['"]/);

    const rawLocation = locM ? stripTags(locM[1]).replace(/,\s*$/, "").trim() : "";
    if (!rawLocation) continue;
    const locality = rawLocation.split(",")[0].trim();
    if (!locality) continue;

    seen.add(slug);
    const detailUrl = new URL(href.replace(/^\.\.\//, ""), SERRANIA_BASE).toString();
    let imageUrl: string | null = null;
    if (imgM) {
      try {
        imageUrl = imgM[1].startsWith("http")
          ? imgM[1]
          : new URL(imgM[1].replace(/^\.\.\//, ""), SERRANIA_BASE).toString();
      } catch {
        imageUrl = null;
      }
    }

    events.push({
      externalId: slug,
      title: decodeHtmlEntities(summaryM[1].trim()),
      description: descM ? stripTags(descM[1]) : null,
      detailUrl,
      imageUrl,
      locality,
      venueName: null,
      year: parseInt(dtstart[1], 10),
      month: parseInt(dtstart[2], 10),
      day: parseInt(dtstart[3], 10),
      endYear: dtend ? parseInt(dtend[1], 10) : parseInt(dtstart[1], 10),
      endMonth: dtend ? parseInt(dtend[2], 10) : parseInt(dtstart[2], 10),
      endDay: dtend ? parseInt(dtend[3], 10) : parseInt(dtstart[3], 10),
    });
  }
  return events;
}

// FYCMA adapter — Fase 5a (dry-run only).
//
// Source: https://fycma.com/wp-json/tribe/events/v1/events
// (The Events Calendar REST API v1, official WordPress plugin used by FYCMA)
//
// Rationale for using the JSON API instead of scraping HTML:
// - It is the site's own public API, robots-permitted, cache-friendly.
// - It exposes structured `start_date`, `end_date`, `timezone`,
//   `venue`, `organizer`, `image`, `categories`, `url`, `website`, so
//   multi-day fairs and congresses are preserved without heuristics.
// - No JS wall, no rendering required, deterministic output.
//
// SAFETY:
// - Read-only. Returns CanonicalEvent[]; scrape-source is the only writer
//   and is still gated by WRITE_ENABLED=false + SYNC_ADMIN_KEY server-side.
// - Never fabricates dates. Events without start_date OR title are skipped.
// - Timeout, identifying UA, structured error handling.
// - Bounded pagination (max 10 pages of per_page=50 => 500 events cap).

import type { SourceAdapter, CanonicalEvent } from "../ingestion/types.ts";

const DEFAULT_API_BASE = "https://fycma.com/wp-json/tribe/events/v1/events";
const FETCH_TIMEOUT_MS = 20_000;
const MAX_PAGES = 10;
const PER_PAGE = 50;
const USER_AGENT =
  "MalagaEventsBot/1.0 (+https://malagaevents.lovable.app; contacto: soporte)";

// Canonical venue name used everywhere in the platform.
export const FYCMA_CANONICAL_VENUE =
  "FYCMA — Palacio de Ferias y Congresos de Málaga";
export const FYCMA_LOCALITY_SLUG = "malaga";

/** Loose Tribe payload types — we only touch fields we understand. */
type TribeVenue = {
  venue?: string;
  address?: string;
  city?: string;
  province?: string;
};
type TribeOrganizer = { organizer?: string; website?: string };
type TribeCategory = { name?: string; slug?: string };
type TribeImage = { url?: string; sizes?: Record<string, { url?: string }> };
type TribeEvent = {
  id?: number | string;
  url?: string;
  slug?: string;
  title?: string;
  description?: string;
  excerpt?: string;
  start_date?: string;   // "YYYY-MM-DD HH:mm:ss" wall time
  end_date?: string;
  utc_start_date?: string;
  timezone?: string;
  all_day?: boolean;
  image?: TribeImage | null;
  venue?: TribeVenue | TribeVenue[] | null;
  organizer?: TribeOrganizer[] | TribeOrganizer | null;
  categories?: TribeCategory[];
  website?: string;      // ticket / registration URL
  cost?: string;
  status?: string;
};

// ---------------- fetch ---------------------------------------------------

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetchWithTimeout(
    url,
    {
      method: "GET",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
      },
      redirect: "follow",
    },
    FETCH_TIMEOUT_MS,
  );
  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`fycma_http_${res.status}: ${raw.slice(0, 200)}`);
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`fycma_bad_json: ${raw.slice(0, 200)}`);
  }
}

// ---------------- normalization -------------------------------------------

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function slugify(s: string): string {
  return stripAccents(s.toLowerCase()).replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/**
 * Convert Tribe "YYYY-MM-DD HH:mm:ss" (Europe/Madrid wall time) to an ISO
 * string with the correct offset. We compute the offset by locating the
 * same instant twice and comparing UTC vs. Madrid components.
 */
function madridWallToIso(wall: string): string | null {
  const m = wall.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/,
  );
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3], hh = +m[4], mm = +m[5], ss = +(m[6] ?? "0");
  // Start from UTC and iteratively correct the offset.
  const utcGuess = Date.UTC(y, mo - 1, d, hh, mm, ss);
  const asMadrid = new Date(utcGuess).toLocaleString("en-US", {
    timeZone: "Europe/Madrid",
    hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const parts = asMadrid.match(/(\d+)/g);
  if (!parts || parts.length < 6) return new Date(utcGuess).toISOString();
  // month/day/year hh:mm:ss on the "en-US" format
  const [mo2, d2, y2, hh2, mm2, ss2] = parts.map(Number);
  const madridUtc = Date.UTC(y2, mo2 - 1, d2, hh2, mm2, ss2);
  const offsetMs = madridUtc - utcGuess; // wall - real UTC
  const real = new Date(utcGuess - offsetMs);
  return real.toISOString();
}

function firstImageUrl(img: TribeImage | null | undefined): string | null {
  if (!img) return null;
  if (img.url) return img.url;
  const sizes = img.sizes ?? {};
  for (const k of ["portfolio-full", "medium", "blog-large", "fusion-400", "thumbnail"]) {
    const s = sizes[k];
    if (s?.url) return s.url;
  }
  const anySize = Object.values(sizes).find((s) => s?.url);
  return anySize?.url ?? null;
}

function firstOrganizer(org: TribeEvent["organizer"]): string | null {
  if (!org) return null;
  const list = Array.isArray(org) ? org : [org];
  for (const o of list) {
    if (o?.organizer && typeof o.organizer === "string") return o.organizer.trim();
  }
  return null;
}

function firstVenueName(v: TribeEvent["venue"]): string | null {
  if (!v) return null;
  const list = Array.isArray(v) ? v : [v];
  for (const it of list) {
    if (it?.venue && typeof it.venue === "string") return it.venue.trim();
  }
  return null;
}

function firstVenueAddress(v: TribeEvent["venue"]): string | null {
  if (!v) return null;
  const list = Array.isArray(v) ? v : [v];
  for (const it of list) {
    const parts = [it?.address, it?.city, it?.province].filter(
      (p): p is string => typeof p === "string" && p.trim().length > 0,
    );
    if (parts.length) return parts.join(", ");
  }
  return null;
}

function mapCategory(cats: TribeCategory[] | undefined): string {
  const names = (cats ?? [])
    .map((c) => (c?.name ? stripAccents(c.name.toLowerCase()) : ""))
    .filter(Boolean);
  const has = (needle: string) => names.some((n) => n.includes(needle));
  if (has("concierto") || has("musica")) return "music";
  if (has("teatro") || has("danza")) return "theater";
  if (has("infantil") || has("familiar") || has("ninos")) return "kids";
  if (has("festival")) return "festivals";
  if (has("deporte")) return "sports";
  if (has("gastronom") || has("feria")) return "other";
  if (has("congreso") || has("salon")) return "other";
  return "other";
}

/** Strip HTML tags for a plain-text description. Keeps line breaks. */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p\s*>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&aacute;/gi, "á")
    .replace(/&eacute;/gi, "é")
    .replace(/&iacute;/gi, "í")
    .replace(/&oacute;/gi, "ó")
    .replace(/&uacute;/gi, "ú")
    .replace(/&ntilde;/gi, "ñ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ---------------- adapter -------------------------------------------------

export type FycmaNormalized = CanonicalEvent & {
  /** Multi-day/congress hint: true when end_date is on a different day. */
  isMultiDay: boolean;
  /** Deterministic dedupe key for the FYCMA source. */
  fycmaDedupeKey: string;
};

export function normalizeFycmaEvent(ev: TribeEvent): {
  ok: boolean;
  reason?: string;
  normalized?: FycmaNormalized;
  fieldsPresent: string[];
} {
  const fieldsPresent: string[] = [];
  if (!ev || typeof ev !== "object") return { ok: false, reason: "not_object", fieldsPresent };

  const title = typeof ev.title === "string" ? ev.title.trim() : "";
  if (title) fieldsPresent.push("title");
  const rawStart = ev.start_date;
  if (rawStart) fieldsPresent.push("start_date");
  if (!title) return { ok: false, reason: "missing_title", fieldsPresent };
  if (!rawStart) return { ok: false, reason: "missing_start_date", fieldsPresent };

  const startIso = madridWallToIso(rawStart);
  if (!startIso) return { ok: false, reason: "bad_start_date", fieldsPresent };
  const endIsoRaw = ev.end_date ? madridWallToIso(ev.end_date) : null;
  const endIso = endIsoRaw && endIsoRaw !== startIso ? endIsoRaw : null;
  if (endIso) fieldsPresent.push("end_date");

  const startDay = rawStart.slice(0, 10);
  const endDay = (ev.end_date ?? rawStart).slice(0, 10);
  const isMultiDay = startDay !== endDay;

  const description = ev.description
    ? stripHtml(ev.description).slice(0, 4000)
    : ev.excerpt
      ? stripHtml(ev.excerpt).slice(0, 2000)
      : null;
  if (description) fieldsPresent.push("description");

  const imageUrl = firstImageUrl(ev.image);
  if (imageUrl) fieldsPresent.push("image");

  const sourceUrl = typeof ev.url === "string" ? ev.url : "";
  if (!sourceUrl) return { ok: false, reason: "missing_url", fieldsPresent };
  fieldsPresent.push("url");

  const ticketUrl = typeof ev.website === "string" && ev.website.length > 0
    ? ev.website
    : null;
  if (ticketUrl) fieldsPresent.push("ticket_url");

  const organizer = firstOrganizer(ev.organizer);
  if (organizer) fieldsPresent.push("organizer");

  const rawVenueName = firstVenueName(ev.venue);
  const venueAddress = firstVenueAddress(ev.venue);
  if (rawVenueName) fieldsPresent.push("venue");
  if (venueAddress) fieldsPresent.push("venue_address");

  const category = mapCategory(ev.categories);
  if (category) fieldsPresent.push("category");

  const priceText = typeof ev.cost === "string" && ev.cost.trim().length > 0
    ? ev.cost.trim()
    : null;

  // Dedupe key: canonical URL is the strongest signal; fall back to
  // normalized title + start day + end day.
  const dedupeKey = sourceUrl
    ? `fycma:url:${sourceUrl.toLowerCase().replace(/\/$/, "")}`
    : `fycma:title:${slugify(title)}:${startDay}:${endDay}`;

  const normalized: FycmaNormalized = {
    title,
    description,
    startAt: startIso,
    endAt: endIso,
    timezone: "Europe/Madrid",
    venueName: FYCMA_CANONICAL_VENUE,
    venueAddress: venueAddress ?? "Av. de José Ortega y Gasset, 201, Málaga",
    locality: FYCMA_LOCALITY_SLUG,
    category,
    imageUrl,
    sourceUrl,
    ticketUrl,
    priceText,
    externalId: ev.id != null ? String(ev.id) : null,
    organizer,
    timeAssumed: ev.all_day === true,
    raw: {
      tribeId: ev.id,
      slug: ev.slug,
      startWall: rawStart,
      endWall: ev.end_date ?? null,
      timezone: ev.timezone ?? "Europe/Madrid",
      allDay: ev.all_day === true,
      isMultiDay,
      categoriesRaw: (ev.categories ?? []).map((c) => c?.name).filter(Boolean),
      rawVenueName,
      status: ev.status,
    },
    isMultiDay,
    fycmaDedupeKey: dedupeKey,
  };

  return { ok: true, normalized, fieldsPresent };
}

async function fetchAllPages(apiBase: string): Promise<{
  events: TribeEvent[];
  pagesFetched: number;
  total: number | null;
  lastStatus: number;
}> {
  const all: TribeEvent[] = [];
  let page = 1;
  let total: number | null = null;
  let lastStatus = 0;
  const nowIso = new Date().toISOString().slice(0, 10);

  while (page <= MAX_PAGES) {
    const url = new URL(apiBase);
    url.searchParams.set("per_page", String(PER_PAGE));
    url.searchParams.set("page", String(page));
    // Include ongoing multi-day events by anchoring at today.
    url.searchParams.set("start_date", nowIso);

    let payload: unknown;
    try {
      payload = await fetchJson(url.toString());
      lastStatus = 200;
    } catch (e) {
      // Tribe returns 400 when page > total_pages; treat as "end of stream".
      const msg = String(e);
      const codeMatch = msg.match(/fycma_http_(\d+)/);
      lastStatus = codeMatch ? +codeMatch[1] : 0;
      if (lastStatus === 400 || lastStatus === 404) break;
      throw e;
    }
    const body = payload as { events?: TribeEvent[]; total?: number };
    if (Array.isArray(body?.events)) all.push(...body.events);
    if (typeof body?.total === "number") total = body.total;
    if (!body?.events || body.events.length < PER_PAGE) break;
    page += 1;
  }

  return { events: all, pagesFetched: page, total, lastStatus };
}

export const fycmaAdapter: SourceAdapter = {
  key: "fycma",
  name: "FYCMA — Palacio de Ferias y Congresos de Málaga",
  fetchEvents: async (ctx) => {
    // Allow the DB source row to override the API base if needed for
    // future migrations, but default to the canonical Tribe endpoint.
    const base = (ctx.source.base_url ?? "").trim();
    const apiBase =
      base && /wp-json\/tribe\/events\/v1\/events/.test(base)
        ? base
        : DEFAULT_API_BASE;

    ctx.logger.info("fycma_fetch_start", { apiBase });
    const { events, pagesFetched, total } = await fetchAllPages(apiBase);
    ctx.logger.info("fycma_fetch_done", {
      pages: pagesFetched,
      raw_events: events.length,
      total,
    });

    const out: CanonicalEvent[] = [];
    let rejected = 0;
    for (const ev of events) {
      const r = normalizeFycmaEvent(ev);
      if (r.ok && r.normalized) {
        out.push(r.normalized);
      } else {
        rejected += 1;
        ctx.logger.warn("fycma_reject", { reason: r.reason, id: ev?.id });
      }
    }
    ctx.logger.info("fycma_normalize_done", { accepted: out.length, rejected });
    return out;
  },
};

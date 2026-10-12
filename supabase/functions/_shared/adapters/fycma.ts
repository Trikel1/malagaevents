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
  utc_end_date?: string;
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

type WallParts = { y: number; mo: number; d: number; hh: number; mm: number; ss: number };

/** Strict "YYYY-MM-DD HH:mm(:ss)" parse with real calendar/clock check. Never throws. */
function parseWall(s: unknown): WallParts | null {
  if (typeof s !== "string") return null;
  const m = s.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const p = { y: +m[1], mo: +m[2], d: +m[3], hh: +m[4], mm: +m[5], ss: +(m[6] ?? "0") };
  if (p.hh > 23 || p.mm > 59 || p.ss > 59 || p.mo < 1 || p.mo > 12 || p.d < 1) return null;
  const t = new Date(Date.UTC(p.y, p.mo - 1, p.d));
  if (t.getUTCFullYear() !== p.y || t.getUTCMonth() !== p.mo - 1 || t.getUTCDate() !== p.d) return null;
  return p;
}

/** Strict UTC string → ISO; null when malformed or impossible. */
export function fycmaUtcToIso(u: unknown): string | null {
  const p = parseWall(u);
  if (!p) return null;
  const ms = Date.UTC(p.y, p.mo - 1, p.d, p.hh, p.mm, p.ss);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

/**
 * Convert Tribe "YYYY-MM-DD HH:mm:ss" (Europe/Madrid wall time) to a UTC ISO
 * string (DST-safe via Intl offset lookup). Null when invalid; never throws.
 */
function madridWallToIso(wall: unknown): string | null {
  const p = parseWall(wall);
  if (!p) return null;
  const utcGuess = Date.UTC(p.y, p.mo - 1, p.d, p.hh, p.mm, p.ss);
  const offsetAt = (ms: number): number | null => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Madrid", hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(new Date(ms));
    const g = (t: string) => Number(parts.find((x) => x.type === t)?.value);
    const asUtc = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second"));
    return Number.isFinite(asUtc) ? asUtc - ms : null;
  };
  const o1 = offsetAt(utcGuess);
  if (o1 == null) return null;
  const o2 = offsetAt(utcGuess - o1) ?? o1;
  return new Date(utcGuess - o2).toISOString();
}

/** Day-only sentinel used across the app: 00:00 UTC of the Madrid calendar day. */
function daySentinel(wall: unknown): string | null {
  const p = parseWall(wall);
  return p ? new Date(Date.UTC(p.y, p.mo - 1, p.d)).toISOString() : null;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " ",
  ndash: "–", mdash: "—", hellip: "…", laquo: "«", raquo: "»",
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", iexcl: "¡", iquest: "¿",
  aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú", ntilde: "ñ",
  Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú", Ntilde: "Ñ",
  uuml: "ü", Uuml: "Ü", ccedil: "ç", euro: "€",
};

/** Decode HTML entities to plain text (output is text, never inserted as HTML). */
export function decodeFycmaText(s: string): string {
  return s
    .replace(/&#(\d+);/g, (all, n) => {
      const c = Number(n);
      return c > 0 && c <= 0x10ffff ? String.fromCodePoint(c) : all;
    })
    .replace(/&#x([0-9a-f]+);/gi, (all, h) => {
      const c = parseInt(h, 16);
      return c > 0 && c <= 0x10ffff ? String.fromCodePoint(c) : all;
    })
    .replace(/&([a-zA-Z]+);/g, (all, name) => NAMED_ENTITIES[name] ?? all)
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
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

const AUXILIARY_CATEGORY = /entrada|inscripcion/;

export function mapCategory(cats: TribeCategory[] | undefined): string {
  const names = (cats ?? [])
    .map((c) => (c?.name ? stripAccents(decodeFycmaText(c.name).toLowerCase()) : ""))
    .filter((n) => n && !AUXILIARY_CATEGORY.test(n));
  const has = (needle: string) => names.some((n) => n.includes(needle));
  if (has("concierto") || has("musica")) return "music";
  if (has("congreso") || has("jornada")) return "conferences";
  if (has("feria") || has("salon")) return "exhibitions";
  if (has("teatro") || has("danza")) return "theater";
  if (has("infantil") || has("familiar") || has("ninos")) return "kids";
  if (has("festival")) return "festival";
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

  const title = typeof ev.title === "string" ? decodeFycmaText(ev.title) : "";
  if (title) fieldsPresent.push("title");
  const rawStart = typeof ev.start_date === "string" ? ev.start_date.trim() : "";
  if (rawStart) fieldsPresent.push("start_date");
  if (!title) return { ok: false, reason: "missing_title", fieldsPresent };
  if (!rawStart) return { ok: false, reason: "missing_start_date", fieldsPresent };
  if (!parseWall(rawStart)) return { ok: false, reason: "bad_start_date", fieldsPresent };
  const rawEnd = typeof ev.end_date === "string" && parseWall(ev.end_date) ? ev.end_date.trim() : null;
  const allDay = ev.all_day === true;

  // Decision: timed events prefer the API's strict UTC instant; a malformed or
  // impossible UTC value falls back to the valid Madrid wall time (recorded in
  // raw.utcFallback). All-day events use the day-only sentinel (00:00 UTC) and
  // the last day inclusive. Nothing here throws.
  const utcFallback: string[] = [];
  let startIso: string | null;
  let endIsoRaw: string | null;
  if (allDay) {
    startIso = daySentinel(rawStart);
    endIsoRaw = rawEnd ? daySentinel(rawEnd) : null;
  } else {
    const us = fycmaUtcToIso(ev.utc_start_date);
    if (ev.utc_start_date != null && !us) utcFallback.push("start");
    startIso = us ?? madridWallToIso(rawStart);
    const ue = fycmaUtcToIso(ev.utc_end_date);
    if (ev.utc_end_date != null && !ue) utcFallback.push("end");
    endIsoRaw = ue ?? (rawEnd ? madridWallToIso(rawEnd) : null);
  }
  if (!startIso) return { ok: false, reason: "bad_start_date", fieldsPresent };
  const endIso = endIsoRaw && endIsoRaw > startIso ? endIsoRaw : null;
  if (endIso) fieldsPresent.push("end_date");

  const startDay = rawStart.slice(0, 10);
  const endDay = endIso ? (rawEnd ?? rawStart).slice(0, 10) : startDay;
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
    timeAssumed: allDay,
    raw: {
      tribeId: ev.id,
      slug: ev.slug,
      startWall: rawStart,
      endWall: ev.end_date ?? null,
      timezone: ev.timezone ?? "Europe/Madrid",
      allDay,
      utcFallback,
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

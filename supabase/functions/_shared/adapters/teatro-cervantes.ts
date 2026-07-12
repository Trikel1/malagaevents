// Teatro Cervantes / Echegaray adapter — Phase 3D-1 (dry-run only).
//
// Source: https://www.teatrocervantes.com/es/programacion/
//
// Covers Teatro Cervantes, Teatro Echegaray, Bodegueros 38, Factoría Echegaray.
//
// SAFETY:
// - Read-only. Returns CanonicalEvent[]; scrape-source is the only writer
//   and is still gated by WRITE_ENABLED=false + SYNC_ADMIN_KEY.
// - Uses Firecrawl if FIRECRAWL_API_KEY is set; otherwise a polite plain
//   fetch fallback with a bot User-Agent.
// - Optional detail-page follow-ups are capped at MAX_DETAIL_FOLLOWS=80,
//   with concurrency <= DETAIL_CONCURRENCY=3, restricted to internal
//   teatrocervantes.com URLs. Never follows ticket/social/image URLs.
// - No AI call. Regex-based, deterministic, cheap.
// - Never invents dates. Events without a parseable date are skipped
//   and logged as warnings.
// - Time fallback of 20:00 Europe/Madrid is applied ONLY when the date
//   line has an explicit day/month but no explicit time. Recorded in
//   `raw.timeAssumed` for traceability.

import type { SourceAdapter, CanonicalEvent } from "../ingestion/types.ts";
import { madridWallTimeToDate } from "../ingestion/dates.ts";

const LISTING_PATH = "/es/programacion/";
const DEFAULT_BASE = "https://www.teatrocervantes.com";
const MAX_DETAIL_FOLLOWS = 80;
const DETAIL_CONCURRENCY = 3;
const USER_AGENT =
  "MalagaEventsBot/1.0 (+https://malagaevents.lovable.app; contacto via web)";

const MONTHS_ES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8,
  sep: 9, sept: 9, oct: 10, nov: 11, dic: 12,
};

// --- Fetch helpers -------------------------------------------------------

async function fetchViaFirecrawl(url: string, apiKey: string): Promise<string> {
  const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      formats: ["markdown"],
      onlyMainContent: true,
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`firecrawl_${res.status}: ${txt.slice(0, 200)}`);
  }
  const data = await res.json();
  return (data?.markdown ?? data?.data?.markdown ?? "") as string;
}

async function fetchPlain(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "es-ES,es;q=0.9",
    },
  });
  if (!res.ok) throw new Error(`fetch_${res.status}`);
  return await res.text();
}

async function fetchPage(url: string, firecrawlKey: string | undefined): Promise<string> {
  if (firecrawlKey) return await fetchViaFirecrawl(url, firecrawlKey);
  return await fetchPlain(url);
}

// --- Text normalisation --------------------------------------------------

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function absolutize(href: string): string {
  if (!href) return "";
  if (/^https?:\/\//i.test(href)) return href;
  if (href.startsWith("/")) return DEFAULT_BASE + href;
  return DEFAULT_BASE + "/" + href;
}

function isInternalCervantesUrl(u: string): boolean {
  try {
    const url = new URL(u);
    return /(^|\.)teatrocervantes\.com$/i.test(url.hostname);
  } catch {
    return false;
  }
}

// --- Date parsing --------------------------------------------------------

type ParsedDate = {
  date: Date;
  timeExplicit: boolean;
  rangeStartRaw?: string;
  rangeEndRaw?: string;
  rangeWasActiveWhenParsed?: boolean;
};

function madridYMD(now: Date): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Madrid",
    year: "numeric", month: "numeric", day: "numeric",
  }).formatToParts(now);
  return {
    y: parseInt(parts.find((p) => p.type === "year")?.value ?? "2026", 10),
    m: parseInt(parts.find((p) => p.type === "month")?.value ?? "1", 10),
    d: parseInt(parts.find((p) => p.type === "day")?.value ?? "1", 10),
  };
}

function parseListingDateLine(rawLine: string, now: Date): ParsedDate | null {
  if (!rawLine) return null;
  const line = stripAccents(rawLine).toLowerCase();

  // Range: "del [wd] **D** <month> [de <Y>] al [wd] **D** <month2> [de <Y2>]"
  const rangeRe =
    /del\s+(?:\S+\s+)?\*{0,2}(\d{1,2})\*{0,2}\s+(?:de\s+)?([a-z]+)(?:\s+de\s+(\d{4}))?\s+al\s+(?:\S+\s+)?\*{0,2}(\d{1,2})\*{0,2}(?:\s+(?:de\s+)?([a-z]+))?(?:\s+de\s+(\d{4}))?/;
  // "12 y 13 de julio de 2026 20:30"  — take first day
  const listRe =
    /\*{0,2}(\d{1,2})\*{0,2}\s+y\s+\*{0,2}(\d{1,2})\*{0,2}\s+(?:de\s+)?([a-z]+)(?:\s+de\s+(\d{4}))?(?:[^0-9]{0,20}?(\d{1,2})[.:h](\d{2}))?/;
  // Single: "<weekday>? **D** <month> [de <YYYY>] [HH[.:h]MM h?]"
  const singleRe =
    /(?:^|\s)\*{0,2}(\d{1,2})\*{0,2}\s+(?:de\s+)?([a-z]+)(?:\s+(?:de\s+)?(\d{4}))?(?:[^0-9]{0,20}?(\d{1,2})[.:h](\d{2}))?/;

  const cur = madridYMD(now);

  // 1) Range
  const rm = line.match(rangeRe);
  if (rm) {
    const startDay = parseInt(rm[1], 10);
    const startMonth = MONTHS_ES[rm[2]] ?? 0;
    let startYear = rm[3] ? parseInt(rm[3], 10) : NaN;
    const endDay = parseInt(rm[4], 10);
    const endMonth = rm[5] ? (MONTHS_ES[rm[5]] ?? startMonth) : startMonth;
    let endYear = rm[6] ? parseInt(rm[6], 10) : NaN;
    if (!startDay || !startMonth) return null;

    if (!Number.isFinite(startYear)) {
      // Default to current year; adjust below.
      startYear = cur.y;
    }
    if (!Number.isFinite(endYear)) {
      endYear = endMonth < startMonth ? startYear + 1 : startYear;
    }

    // "Active" check: is now between start and end (Madrid wall time)?
    const startTs = madridWallTimeToDate(startYear, startMonth, startDay, 0, 0).getTime();
    const endTs = madridWallTimeToDate(endYear, endMonth, endDay, 23, 59).getTime();
    const nowTs = now.getTime();
    let active = nowTs >= startTs && nowTs <= endTs;

    // If the whole range is in the past (end < today) roll forward one year.
    if (!rm[3] && !rm[6] && endTs < nowTs) {
      startYear += 1;
      endYear += 1;
      active = false;
    }

    return {
      date: madridWallTimeToDate(startYear, startMonth, startDay, 20, 0),
      timeExplicit: false,
      rangeStartRaw: `${startDay}/${startMonth}/${startYear}`,
      rangeEndRaw: `${endDay}/${endMonth}/${endYear}`,
      rangeWasActiveWhenParsed: active,
    };
  }

  // 2) List "D y D <month>"
  const lm = line.match(listRe);
  if (lm) {
    const day = parseInt(lm[1], 10);
    const month = MONTHS_ES[lm[3]] ?? 0;
    let year = lm[4] ? parseInt(lm[4], 10) : NaN;
    const hour = lm[5] ? parseInt(lm[5], 10) : -1;
    const minute = lm[6] ? parseInt(lm[6], 10) : 0;
    if (!day || !month) return null;
    if (!Number.isFinite(year)) {
      year = (month < cur.m || (month === cur.m && day < cur.d)) ? cur.y + 1 : cur.y;
    }
    const timeExplicit = hour >= 0;
    return {
      date: madridWallTimeToDate(year, month, day, timeExplicit ? hour : 20, timeExplicit ? minute : 0),
      timeExplicit,
    };
  }

  // 3) Single date
  const sm = line.match(singleRe);
  if (!sm) return null;
  const day = parseInt(sm[1], 10);
  const month = MONTHS_ES[sm[2]] ?? 0;
  let year = sm[3] ? parseInt(sm[3], 10) : NaN;
  const hour = sm[4] ? parseInt(sm[4], 10) : -1;
  const minute = sm[5] ? parseInt(sm[5], 10) : 0;
  if (!day || !month) return null;
  if (!Number.isFinite(year)) {
    year = (month < cur.m || (month === cur.m && day < cur.d)) ? cur.y + 1 : cur.y;
  }
  const timeExplicit = hour >= 0;
  return {
    date: madridWallTimeToDate(year, month, day, timeExplicit ? hour : 20, timeExplicit ? minute : 0),
    timeExplicit,
  };
}

// --- Category / venue inference -----------------------------------------

function inferCategoryFromUrl(url: string, title: string): string | null {
  const u = url.toLowerCase();
  const t = stripAccents(title).toLowerCase();
  if (u.includes("/teatro-infantil/")) return "kids";
  if (u.includes("/lirica/") || /\b(opera|lirica|orquesta|filarmonic)/.test(t))
    return "music";
  if (u.includes("/musica/") || /\b(concierto|jazz|flamenco|gospel)/.test(t))
    return "music";
  if (u.includes("/danza/") || /\b(danza|ballet)/.test(t)) return "theater";
  if (u.includes("/teatro/") || /\b(teatro|musical|comedia)/.test(t))
    return "theater";
  if (/\b(festival|mosma|terral|singulares)/.test(t)) return "festivals";
  if (/\b(infantil|nino|peques|cuento|titeres|cantajuego)/.test(t))
    return "kids";
  return null;
}

function inferVenueFromText(text: string | null | undefined): string | null {
  if (!text) return null;
  const c = stripAccents(text).toLowerCase();
  // Priority order per Phase 3D-1.
  if (c.includes("factoria echegaray") || (c.includes("echegaray") && c.includes("factoria")))
    return "Factoría Echegaray";
  if (c.includes("factoria")) return "Factoría Echegaray";
  if (c.includes("bodegueros 38") || c.includes("bodegueros")) return "Bodegueros 38";
  if (c.includes("teatro echegaray") || c.includes("echegaray")) return "Teatro Echegaray";
  if (c.includes("teatro cervantes") || c.includes("cervantes")) return "Teatro Cervantes";
  return null;
}

function inferVenue(cycleText: string | null, title?: string | null): string {
  return (
    inferVenueFromText(cycleText) ||
    inferVenueFromText(title) ||
    "Teatro Cervantes"
  );
}

/**
 * Inspect the detail-page markdown for a venue hint.
 * Falls back to cycleText / title when no clean signal.
 */
function inferVenueFromDetail(
  markdown: string,
  fallbackCycleText: string | null | undefined,
  fallbackTitle: string | null | undefined,
): string {
  if (markdown) {
    // Look at the first ~40 lines: headings, breadcrumbs, top-of-fiche block.
    const head = markdown.split("\n").slice(0, 60).join("\n");
    const fromHead = inferVenueFromText(head);
    if (fromHead) return fromHead;
    // Look near any "lugar" / "sala" / "recinto" line anywhere.
    const nearRe =
      /(?:lugar|sala|recinto|espacio|donde|ubicaci[oó]n)[^\n]{0,120}/gi;
    const hits = markdown.match(nearRe) ?? [];
    for (const h of hits) {
      const v = inferVenueFromText(h);
      if (v) return v;
    }
    const fromBody = inferVenueFromText(markdown);
    if (fromBody) return fromBody;
  }
  return inferVenue(fallbackCycleText ?? null, fallbackTitle ?? null);
}

/** Try to extract a more precise date/time from the detail markdown. */
function extractDateFromDetail(
  markdown: string,
  now: Date,
): { parsed: ParsedDate; dateRaw: string } | null {
  if (!markdown) return null;
  const lines = markdown.split("\n").map((l) => l.trim()).filter(Boolean);
  const timeHint = /\b\d{1,2}[.:h]\d{2}\b/;
  const dayHint = /\b\d{1,2}\s+(?:de\s+)?(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|ene|feb|mar|abr|may|jun|jul|ago|sep|sept|oct|nov|dic)\b/i;
  for (const l of lines) {
    if (!dayHint.test(stripAccents(l).toLowerCase())) continue;
    if (!timeHint.test(l)) continue;
    const parsed = parseListingDateLine(l, now);
    if (parsed && parsed.timeExplicit) {
      return { parsed, dateRaw: l.slice(0, 200) };
    }
  }
  return null;
}

// --- Listing markdown parser --------------------------------------------

type Candidate = {
  dateLine: string;
  eventUrl: string;
  ticketUrl?: string;
  imageUrl?: string;
  title?: string;
  cycleText?: string;
};

function parseListingMarkdown(md: string): Candidate[] {
  const lines = md.split("\n").map((l) => l.trim());
  const out: Candidate[] = [];

  const verMasRe =
    /\[Ver m[aá]s\]\((https?:[^\s)]+)\s*(?:"[^"]*")?\)(?:\s*\[Comprar entradas\]\((https?:[^\s)]+)\s*(?:"[^"]*")?\))?/i;
  const titleLinkRe = /^\[([^\]]{2,200})\]\((https?:[^\s)]+)\s*(?:"[^"]*")?\)\s*$/;
  const imgLinkRe =
    /^\[\!\[[^\]]*\]\((https?:[^\s)]+)\)\]\((https?:[^\s)]+)\)/;
  const dateLineHint =
    /(\*\*\s*\d{1,2}\s*\*\*|\bde\s+\d{4}\b|del\s+\S+\s+\*\*\s*\d{1,2})/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(verMasRe);
    if (!m) continue;
    const eventUrl = absolutize(m[1]);
    if (!/teatrocervantes\.com\/es\/(genero|espectaculo|evento)\//i.test(eventUrl))
      continue;

    const cand: Candidate = {
      dateLine: "",
      eventUrl,
      ticketUrl: m[2] ? absolutize(m[2]) : undefined,
    };

    for (let j = i - 1, k = 0; j >= 0 && k < 5; j--) {
      const prev = lines[j];
      if (!prev) continue;
      k++;
      if (dateLineHint.test(prev)) {
        cand.dateLine = prev;
        break;
      }
    }

    const titles: string[] = [];
    for (let j = i + 1, k = 0; j < lines.length && k < 8; j++) {
      const next = lines[j];
      if (!next) continue;
      k++;
      if (next.match(verMasRe)) break;
      const im = next.match(imgLinkRe);
      if (im && im[2] === m[1]) {
        cand.imageUrl = im[1];
        continue;
      }
      const tm = next.match(titleLinkRe);
      if (tm && tm[2] === m[1]) titles.push(tm[1].trim());
    }
    if (titles.length > 0) {
      cand.title = titles[0];
      if (titles.length > 1) cand.cycleText = titles[titles.length - 1];
    }

    if (cand.title && cand.dateLine) out.push(cand);
  }

  return out;
}

// --- Concurrency pool ----------------------------------------------------

async function runPool<T, R>(
  items: T[],
  worker: (item: T, idx: number) => Promise<R>,
  concurrency: number,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const runners: Promise<void>[] = [];
  const n = Math.min(concurrency, items.length);
  for (let w = 0; w < n; w++) {
    runners.push((async () => {
      while (true) {
        const i = cursor++;
        if (i >= items.length) return;
        try {
          results[i] = await worker(items[i], i);
        } catch (_e) {
          // errors are handled inside worker; keep pool alive
        }
      }
    })());
  }
  await Promise.all(runners);
  return results;
}

// --- Adapter -------------------------------------------------------------

export const teatroCervantesAdapter: SourceAdapter = {
  key: "teatro-cervantes",
  name: "Teatro Cervantes / Echegaray",
  fetchEvents: async (ctx) => {
    const baseUrl = (ctx.source.base_url?.replace(/\/+$/, "") || DEFAULT_BASE);
    const url = baseUrl.endsWith(LISTING_PATH)
      ? baseUrl
      : baseUrl.replace(/\/es(\/programacion)?\/?$/i, "") + LISTING_PATH;

    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    // Detail follow is ON by default; opt out via env for cheap harness runs.
    const detailFollowEnabled =
      (Deno.env.get("CERVANTES_DETAIL_FOLLOW") ?? "1") !== "0";

    let markdown = "";
    try {
      markdown = await fetchPage(url, firecrawlKey);
    } catch (e) {
      ctx.logger.error("teatro-cervantes: fetch failed", {
        url,
        error: (e as Error).message,
      });
      return [];
    }
    if (!markdown) {
      ctx.logger.warn("teatro-cervantes: empty response", { url });
      return [];
    }

    const candidates = parseListingMarkdown(markdown);
    ctx.logger.info("teatro-cervantes: candidates parsed", {
      count: candidates.length,
      detailFollowEnabled,
    });

    const now = new Date();
    const seen = new Set<string>();
    const out: CanonicalEvent[] = [];
    let skippedNoDate = 0;
    let skippedDupe = 0;
    let timeAssumedCount = 0;

    // First pass: parse dates and dedupe. Collect for optional detail follow.
    type Prepared = {
      cand: Candidate;
      parsed: ParsedDate;
      category: string | null;
      venueName: string;
      detail?: {
        fetched: boolean;
        failed: boolean;
        venueRaw?: string | null;
        dateRaw?: string | null;
        url: string;
        venueImproved: boolean;
        dateImproved: boolean;
      };
    };
    const prepared: Prepared[] = [];

    for (const cand of candidates) {
      const parsed = parseListingDateLine(cand.dateLine, now);
      if (!parsed) {
        skippedNoDate++;
        ctx.logger.warn("teatro-cervantes: unparseable date, skipping", {
          dateLine: cand.dateLine.slice(0, 120),
          eventUrl: cand.eventUrl,
        });
        continue;
      }
      const dedupeKey =
        cand.eventUrl + "|" + stripAccents(cand.title ?? "").toLowerCase();
      if (seen.has(dedupeKey)) {
        skippedDupe++;
        continue;
      }
      seen.add(dedupeKey);

      prepared.push({
        cand,
        parsed,
        category: inferCategoryFromUrl(cand.eventUrl, cand.title ?? ""),
        venueName: inferVenue(cand.cycleText ?? null, cand.title ?? null),
      });
    }

    // Optional detail follow -- controlled & capped.
    let detailFetched = 0;
    let detailFailed = 0;
    let venueImproved = 0;
    let dateImproved = 0;
    if (detailFollowEnabled) {
      const toFollow = prepared
        .filter((p) => isInternalCervantesUrl(p.cand.eventUrl))
        .slice(0, MAX_DETAIL_FOLLOWS);
      await runPool(toFollow, async (p) => {
        const detailUrl = p.cand.eventUrl;
        try {
          const md = await fetchPage(detailUrl, firecrawlKey);
          detailFetched++;
          const newVenue = inferVenueFromDetail(md, p.cand.cycleText ?? null, p.cand.title ?? null);
          const newDate = extractDateFromDetail(md, now);
          const improvedVenue = newVenue !== p.venueName;
          if (improvedVenue) {
            p.venueName = newVenue;
            venueImproved++;
          }
          const improvedDate = !!newDate && !p.parsed.timeExplicit;
          if (improvedDate && newDate) {
            p.parsed = { ...p.parsed, date: newDate.parsed.date, timeExplicit: true };
            dateImproved++;
          }
          p.detail = {
            fetched: true,
            failed: false,
            venueRaw: newVenue,
            dateRaw: newDate?.dateRaw ?? null,
            url: detailUrl,
            venueImproved: improvedVenue,
            dateImproved: improvedDate,
          };
        } catch (e) {
          detailFailed++;
          p.detail = {
            fetched: false,
            failed: true,
            url: detailUrl,
            venueImproved: false,
            dateImproved: false,
          };
          ctx.logger.warn("teatro-cervantes: detail fetch failed", {
            detailUrl,
            error: (e as Error).message.slice(0, 160),
          });
        }
      }, DETAIL_CONCURRENCY);
    }

    for (const p of prepared) {
      if (!p.parsed.timeExplicit) timeAssumedCount++;
      out.push({
        title: (p.cand.title ?? "").trim(),
        description: p.cand.cycleText ? `Ciclo: ${p.cand.cycleText}` : null,
        startAt: p.parsed.date.toISOString(),
        endAt: null,
        timezone: "Europe/Madrid",
        venueName: p.venueName,
        venueAddress: null,
        locality: "Málaga",
        category: p.category,
        imageUrl: p.cand.imageUrl ?? null,
        sourceUrl: p.cand.eventUrl,
        ticketUrl: p.cand.ticketUrl ?? null,
        priceText: null,
        raw: {
          dateLine: p.cand.dateLine,
          cycleText: p.cand.cycleText ?? null,
          timeAssumed: !p.parsed.timeExplicit,
          rangeStartRaw: p.parsed.rangeStartRaw ?? null,
          rangeEndRaw: p.parsed.rangeEndRaw ?? null,
          rangeWasActiveWhenParsed: p.parsed.rangeWasActiveWhenParsed ?? null,
          detailFetched: p.detail?.fetched ?? false,
          detailFailed: p.detail?.failed ?? false,
          detailUrl: p.detail?.url ?? null,
          detailVenueRaw: p.detail?.venueRaw ?? null,
          detailDateRaw: p.detail?.dateRaw ?? null,
          adapter: "teatro-cervantes",
        },
      });
    }

    ctx.logger.info("teatro-cervantes: normalised", {
      candidates: candidates.length,
      returned: out.length,
      skippedNoDate,
      skippedDupe,
      timeAssumedCount,
      detailFollowEnabled,
      detailFollowCap: MAX_DETAIL_FOLLOWS,
      detailFetched,
      detailFailed,
      venueImproved,
      dateImproved,
      dryRun: ctx.dryRun,
    });

    return out;
  },
};

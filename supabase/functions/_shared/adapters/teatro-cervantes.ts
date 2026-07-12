// Teatro Cervantes / Echegaray adapter — Phase 3C-1 (dry-run only).
//
// Source (public listings, robots-friendly):
//   https://www.teatrocervantes.com/es/programacion/
//
// Covers programming for:
//   - Teatro Cervantes
//   - Teatro Echegaray
//   - Bodegueros 38
//   - Factoría Echegaray
//   - Music, Theatre, Kids theatre, Dance, Opera/Lírica, Cycles/Festivals
//
// SAFETY:
// - Read-only. Returns CanonicalEvent[]; scrape-source is the only writer
//   and is still gated by WRITE_ENABLED=false + SYNC_ADMIN_KEY.
// - Uses Firecrawl (already the project's public web-fetch layer) so we
//   respect its robots handling and rate limits. Falls back to a plain
//   `fetch()` with a polite User-Agent if FIRECRAWL_API_KEY is missing.
// - No AI call. The listing markdown is structured enough to parse with
//   regex, which keeps dry-run deterministic and cheap.
// - Detail-page follow-ups are disabled in this phase; if it's ever
//   enabled it must cap at MAX_DETAIL_FOLLOWS=80 requests per run.
// - Never invents dates. Events without a parseable date are skipped
//   and logged as warnings.
// - Time fallback of 20:00 Europe/Madrid is applied ONLY when the date
//   line has an explicit day/month but no explicit time. This is recorded
//   in the `raw.timeAssumed` field for traceability.

import type { SourceAdapter, CanonicalEvent } from "../ingestion/types.ts";
import { madridWallTimeToDate } from "../ingestion/dates.ts";

const LISTING_PATH = "/es/programacion/";
const DEFAULT_BASE = "https://www.teatrocervantes.com";
const MAX_DETAIL_FOLLOWS = 80; // reserved for future phases, not used here
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

// --- Date parsing --------------------------------------------------------

type ParsedDate = { date: Date; timeExplicit: boolean };

/**
 * Parses date lines from Teatro Cervantes listings, e.g.:
 *   "jueves **10** septiembre 20.00 h"
 *   "domingo **13** septiembre 11.00 h y 13.00 h"
 *   "viernes **25** septiembre 20.00 h"
 *   "del v **3** julio al d **9** agosto"       (range → first date)
 *   "12 y 13 de julio de 2026 20:30"            (list → first date)
 * Year is optional; if missing, we infer using current Madrid year and
 * roll forward if the month has already passed.
 */
function parseListingDateLine(rawLine: string, now: Date): ParsedDate | null {
  if (!rawLine) return null;
  const line = stripAccents(rawLine).toLowerCase();

  // Range: "del <weekday> **D** <month> al <weekday> **D** <month>"
  const rangeRe = /del\s+\S+\s+\*{0,2}(\d{1,2})\*{0,2}\s+([a-z]+)(?:\s+de\s+(\d{4}))?/;
  // Single: "<weekday>? **D** <month> [de <YYYY>] [HH[.:h]MM h?]"
  const singleRe = /(?:^|\s)\*{0,2}(\d{1,2})\*{0,2}\s+(?:de\s+)?([a-z]+)(?:\s+(?:de\s+)?(\d{4}))?(?:[^0-9]{0,20}?(\d{1,2})[.:h](\d{2}))?/;

  let day = 0, month = 0, year: number | undefined, hour = -1, minute = 0;

  const rm = line.match(rangeRe);
  if (rm) {
    day = parseInt(rm[1], 10);
    month = MONTHS_ES[rm[2]] ?? 0;
    year = rm[3] ? parseInt(rm[3], 10) : undefined;
  } else {
    const sm = line.match(singleRe);
    if (!sm) return null;
    day = parseInt(sm[1], 10);
    month = MONTHS_ES[sm[2]] ?? 0;
    year = sm[3] ? parseInt(sm[3], 10) : undefined;
    if (sm[4]) {
      hour = parseInt(sm[4], 10);
      minute = parseInt(sm[5] ?? "0", 10);
    }
  }

  if (!day || !month) return null;

  // Year inference vs current Madrid month/year
  const nowFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Madrid",
    year: "numeric", month: "numeric", day: "numeric",
  }).formatToParts(now);
  const currentYear = parseInt(
    nowFmt.find((p) => p.type === "year")?.value ?? "2026", 10);
  const currentMonth = parseInt(
    nowFmt.find((p) => p.type === "month")?.value ?? "1", 10);
  const currentDay = parseInt(
    nowFmt.find((p) => p.type === "day")?.value ?? "1", 10);

  if (year === undefined) {
    if (month < currentMonth || (month === currentMonth && day < currentDay)) {
      year = currentYear + 1;
    } else {
      year = currentYear;
    }
  }

  const timeExplicit = hour >= 0;
  if (!timeExplicit) {
    hour = 20; // fallback for this source only
    minute = 0;
  }

  return {
    date: madridWallTimeToDate(year, month, day, hour, minute),
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

function inferVenue(cycleText: string | null): string {
  const c = cycleText ? stripAccents(cycleText).toLowerCase() : "";
  if (c.includes("echegaray") && c.includes("factoria"))
    return "Factoría Echegaray";
  if (c.includes("factoria")) return "Factoría Echegaray";
  if (c.includes("bodegueros")) return "Bodegueros 38";
  if (c.includes("echegaray")) return "Teatro Echegaray";
  return "Teatro Cervantes";
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

/**
 * Walks the Firecrawl markdown for the programación listing and groups
 * lines into per-event candidates. See sample structure at top of file.
 */
function parseListingMarkdown(md: string): Candidate[] {
  const lines = md.split("\n").map((l) => l.trim());
  const out: Candidate[] = [];

  // Regex helpers used per line.
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
    // Only take Teatro Cervantes/Echegaray event pages (avoid nav/newsletter).
    if (!/teatrocervantes\.com\/es\/(genero|espectaculo|evento)\//i.test(eventUrl))
      continue;

    const cand: Candidate = {
      dateLine: "",
      eventUrl,
      ticketUrl: m[2] ? absolutize(m[2]) : undefined,
    };

    // Look back up to 4 non-empty lines for a date hint.
    for (let j = i - 1, k = 0; j >= 0 && k < 5; j--) {
      const prev = lines[j];
      if (!prev) continue;
      k++;
      if (dateLineHint.test(prev)) {
        cand.dateLine = prev;
        break;
      }
    }

    // Look forward up to 6 lines for image + title + cycle referencing eventUrl.
    const titles: string[] = [];
    for (let j = i + 1, k = 0; j < lines.length && k < 8; j++) {
      const next = lines[j];
      if (!next) continue;
      k++;
      if (next.match(verMasRe)) break; // reached next block
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
    let markdown = "";
    try {
      if (firecrawlKey) {
        markdown = await fetchViaFirecrawl(url, firecrawlKey);
      } else {
        ctx.logger.warn(
          "teatro-cervantes: FIRECRAWL_API_KEY missing, using plain fetch",
        );
        markdown = await fetchPlain(url);
      }
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
    });

    const now = new Date();
    const seen = new Set<string>();
    const out: CanonicalEvent[] = [];
    let skippedNoDate = 0;
    let skippedDupe = 0;
    let timeAssumedCount = 0;

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

      // Dedupe key = sourceUrl + normalised title
      const dedupeKey =
        cand.eventUrl + "|" + stripAccents(cand.title ?? "").toLowerCase();
      if (seen.has(dedupeKey)) {
        skippedDupe++;
        continue;
      }
      seen.add(dedupeKey);

      const category = inferCategoryFromUrl(cand.eventUrl, cand.title ?? "");
      const venueName = inferVenue(cand.cycleText ?? null);
      if (!parsed.timeExplicit) timeAssumedCount++;

      out.push({
        title: (cand.title ?? "").trim(),
        description: cand.cycleText ? `Ciclo: ${cand.cycleText}` : null,
        startAt: parsed.date.toISOString(),
        endAt: null,
        timezone: "Europe/Madrid",
        venueName,
        venueAddress: null,
        locality: "Málaga",
        category,
        imageUrl: cand.imageUrl ?? null,
        sourceUrl: cand.eventUrl,
        ticketUrl: cand.ticketUrl ?? null,
        priceText: null,
        raw: {
          dateLine: cand.dateLine,
          cycleText: cand.cycleText ?? null,
          timeAssumed: !parsed.timeExplicit,
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
      dryRun: ctx.dryRun,
      detailFollowCap: MAX_DETAIL_FOLLOWS,
    });

    return out;
  },
};

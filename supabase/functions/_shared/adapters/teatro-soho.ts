// Teatro del Soho CaixaBank adapter — Phase 3C-3 (dry-run only).
//
// Source (public listings, robots-friendly):
//   https://teatrodelsoho.com/programacion/?temporada=temporada-YYYY-YYYY
//
// SAFETY:
// - Read-only. Returns CanonicalEvent[]; scrape-source is the sole writer
//   and remains gated by WRITE_ENABLED=false + SYNC_ADMIN_KEY.
// - Uses Firecrawl when FIRECRAWL_API_KEY is available (respects its
//   robots handling and rate limits); falls back to plain fetch with a
//   polite User-Agent.
// - No AI call. Listing markdown parses with regex, deterministic + cheap.
// - No detail-page follows this phase. If ever enabled, cap at
//   MAX_DETAIL_FOLLOWS=50 requests per run.
// - Never invents dates: events with unparseable date lines are skipped
//   and logged as warnings.
// - 20:00 Europe/Madrid time fallback is used ONLY when the date line
//   has an explicit day/month but no explicit time. Recorded as
//   raw.timeAssumed = true.

import type { SourceAdapter, CanonicalEvent } from "../ingestion/types.ts";
import { madridWallTimeToDate } from "../ingestion/dates.ts";

const DEFAULT_BASE = "https://teatrodelsoho.com";
const MAX_DETAIL_FOLLOWS = 50; // reserved; not used this phase
const USER_AGENT =
  "MalagaEventsBot/1.0 (+https://malagaevents.lovable.app; contacto via web)";

const MONTHS_ES: Record<string, number> = {
  enero: 1, ene: 1,
  febrero: 2, feb: 2,
  marzo: 3, mar: 3,
  abril: 4, abr: 4,
  mayo: 5, may: 5,
  junio: 6, jun: 6,
  julio: 7, jul: 7,
  agosto: 8, ago: 8,
  septiembre: 9, sep: 9, sept: 9,
  octubre: 10, oct: 10,
  noviembre: 11, nov: 11,
  diciembre: 12, dic: 12,
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

// --- Utilities -----------------------------------------------------------

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function absolutize(href: string): string {
  if (!href) return "";
  if (/^https?:\/\//i.test(href)) return href;
  if (href.startsWith("//")) return "https:" + href;
  if (href.startsWith("/")) return DEFAULT_BASE + href;
  return DEFAULT_BASE + "/" + href;
}

// --- Season → year window ------------------------------------------------

/**
 * A season "temporada-2025-2026" runs Sep 2025 – Aug 2026. We map each
 * month (1..12) to the year within that window it belongs to.
 */
function yearForMonthInSeason(month: number, startYear: number, endYear: number): number {
  // Sep..Dec belong to startYear, Jan..Aug belong to endYear.
  return month >= 9 ? startYear : endYear;
}

/** Pick the current + next season based on today's date in Madrid. */
function currentSeasons(now: Date): Array<{ slug: string; start: number; end: number }> {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "numeric",
  }).formatToParts(now);
  const y = parseInt(parts.find((p) => p.type === "year")?.value ?? "2026", 10);
  const m = parseInt(parts.find((p) => p.type === "month")?.value ?? "1", 10);
  // If we're in Sep..Dec the current season starts this year; else last year.
  const seasonStart = m >= 9 ? y : y - 1;
  return [
    { slug: `temporada-${seasonStart}-${seasonStart + 1}`, start: seasonStart, end: seasonStart + 1 },
    { slug: `temporada-${seasonStart + 1}-${seasonStart + 2}`, start: seasonStart + 1, end: seasonStart + 2 },
  ];
}

// --- Date-line parsing ---------------------------------------------------

type ParsedDate = { date: Date; timeExplicit: boolean };

/**
 * Parses Teatro Soho date lines, e.g.:
 *   "10 - 12 Jul"           (day range, same month)
 *   "28 Sep"                (single day)
 *   "4 Ene"                 (single day, year rolls over)
 *   "30 Oct - 11 Ene"       (day range, cross-month, cross-year)
 *   "12 - 14 Feb"           (day range)
 * Year is inferred from the season window (start..end).
 * Time is never explicit at listing level → 20:00 fallback.
 */
function parseSohoDateLine(
  rawLine: string,
  seasonStart: number,
  seasonEnd: number,
): ParsedDate | null {
  if (!rawLine) return null;
  const line = stripAccents(rawLine).toLowerCase().replace(/\s+/g, " ").trim();

  // Cross-month range: "30 oct - 11 ene"
  const crossRange = line.match(
    /^(\d{1,2})\s+([a-z]+)\s*[-–]\s*(\d{1,2})\s+([a-z]+)\b/,
  );
  if (crossRange) {
    const day = parseInt(crossRange[1], 10);
    const month = MONTHS_ES[crossRange[2]] ?? 0;
    if (!month) return null;
    const year = yearForMonthInSeason(month, seasonStart, seasonEnd);
    return {
      date: madridWallTimeToDate(year, month, day, 20, 0),
      timeExplicit: false,
    };
  }

  // Same-month range: "10 - 12 jul"
  const sameMonthRange = line.match(/^(\d{1,2})\s*[-–]\s*\d{1,2}\s+([a-z]+)\b/);
  if (sameMonthRange) {
    const day = parseInt(sameMonthRange[1], 10);
    const month = MONTHS_ES[sameMonthRange[2]] ?? 0;
    if (!month) return null;
    const year = yearForMonthInSeason(month, seasonStart, seasonEnd);
    return {
      date: madridWallTimeToDate(year, month, day, 20, 0),
      timeExplicit: false,
    };
  }

  // Single: "28 sep" or "4 ene"
  const single = line.match(/^(\d{1,2})\s+([a-z]+)\b/);
  if (single) {
    const day = parseInt(single[1], 10);
    const month = MONTHS_ES[single[2]] ?? 0;
    if (!month) return null;
    const year = yearForMonthInSeason(month, seasonStart, seasonEnd);
    return {
      date: madridWallTimeToDate(year, month, day, 20, 0),
      timeExplicit: false,
    };
  }

  return null;
}

// --- Category inference --------------------------------------------------

function inferCategory(rawCategory: string | null, title: string): string | null {
  const raw = stripAccents((rawCategory ?? "").toLowerCase());
  const t = stripAccents(title.toLowerCase());

  if (/\b(musica|concierto|jazz|flamenco|opera|lirica)\b/.test(raw)) return "music";
  if (/\b(danza|ballet)\b/.test(raw)) return "theater"; // dance normalizes to theater
  if (/\b(teatro|monologo|musical|circo|documental)\b/.test(raw)) return "theater";
  if (/\b(joven|infantil|nino|peques|familiar)\b/.test(raw)) return "kids";
  if (/\b(conferencia|charla)\b/.test(raw)) return "other";
  if (/\b(magia)\b/.test(raw)) return "other";
  if (/\b(festival)\b/.test(raw)) return "festivals";

  if (/\b(concierto|musica|flamenco|jazz|opera)\b/.test(t)) return "music";
  if (/\b(infantil|ninos|familiar|peques|cuento)\b/.test(t)) return "kids";
  return "theater"; // Soho default
}

// --- Listing parser ------------------------------------------------------

type Candidate = {
  imageUrl?: string;
  categoryRaw?: string;
  dateLine?: string;
  title?: string;
  eventUrl: string;
  ticketUrl?: string;
};

const IMG_RE = /^!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/i;
const TITLE_RE = /^##\s+(.{2,300})\s*$/;
const SABER_RE = /^\[Saber m[aá]s\]\((https?:\/\/[^\s)]+)\)/i;
const COMPRAR_RE = /^\[(?:comprar|COMPRAR|Comprar)\]\((https?:\/\/[^\s)]+)\)/i;
// A single-line category label is 1..4 words of letters, no punctuation,
// no digits, no markdown.
const CATEGORY_LINE_RE = /^([A-Za-zÁÉÍÓÚáéíóúÑñ]+(?:\s+[A-Za-zÁÉÍÓÚáéíóúÑñ]+){0,3})$/;
// Date line: starts with digits and contains a spanish month abbreviation.
const DATE_HINT_RE =
  /^\d{1,2}\b[\s\S]{0,40}?\b(ene|feb|mar|abr|may|jun|jul|ago|sep|sept|oct|nov|dic)\b/i;
const NON_EVENT_URL = /\/(programacion|noticias|regala-teatro|discografia|soho-joven|larios-pop|teatro-del-soho-television|soho-sounds-records)\b/i;

function parseListingMarkdown(md: string): Candidate[] {
  const lines = md.split("\n").map((l) => l.trim());
  const out: Candidate[] = [];
  const seenUrls = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const tm = line.match(TITLE_RE);
    if (!tm) continue;
    const title = tm[1].replace(/\s+/g, " ").trim();
    if (!title || title.length < 2) continue;

    // Look forward up to 6 lines for "Saber más" URL (event URL is the anchor).
    let eventUrl: string | undefined;
    let ticketUrl: string | undefined;
    for (let j = i + 1, k = 0; j < lines.length && k < 8; j++) {
      const next = lines[j];
      if (!next) continue;
      k++;
      if (next.match(TITLE_RE)) break;
      const sm = next.match(SABER_RE);
      if (sm && !eventUrl) eventUrl = absolutize(sm[1]);
      const cm = next.match(COMPRAR_RE);
      if (cm && !ticketUrl) ticketUrl = absolutize(cm[1]);
      if (eventUrl && ticketUrl) break;
    }
    if (!eventUrl) continue;
    if (!/\/evento\//.test(eventUrl)) continue;
    if (NON_EVENT_URL.test(eventUrl)) continue;
    if (seenUrls.has(eventUrl)) continue;
    seenUrls.add(eventUrl);

    // Look back up to 8 non-empty lines for image + category + date.
    let imageUrl: string | undefined;
    let categoryRaw: string | undefined;
    let dateLine: string | undefined;
    for (let j = i - 1, k = 0; j >= 0 && k < 12; j--) {
      const prev = lines[j];
      if (!prev) continue;
      if (prev.match(TITLE_RE)) break; // previous block boundary
      k++;
      if (!dateLine && DATE_HINT_RE.test(prev)) {
        dateLine = prev;
        continue;
      }
      if (!categoryRaw && CATEGORY_LINE_RE.test(prev) && prev.length <= 40) {
        // Guard: don't confuse category with UI text
        if (!/^(saber|comprar|todas|filtrar|programacion|temporada)$/i.test(prev)) {
          categoryRaw = prev;
        }
        continue;
      }
      if (!imageUrl) {
        const im = prev.match(IMG_RE);
        if (im) {
          imageUrl = im[1];
          continue;
        }
      }
    }

    out.push({
      imageUrl,
      categoryRaw,
      dateLine,
      title,
      eventUrl,
      ticketUrl,
    });
  }

  return out;
}

// --- Adapter -------------------------------------------------------------

export const teatroSohoAdapter: SourceAdapter = {
  key: "teatro-soho",
  name: "Teatro del Soho CaixaBank",
  fetchEvents: async (ctx) => {
    const now = new Date();
    const seasons = currentSeasons(now);
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");

    const allCandidates: Array<Candidate & { seasonStart: number; seasonEnd: number }> = [];

    for (const season of seasons) {
      const url = `${DEFAULT_BASE}/programacion/?temporada=${season.slug}`;
      let markdown = "";
      try {
        if (firecrawlKey) {
          markdown = await fetchViaFirecrawl(url, firecrawlKey);
        } else {
          ctx.logger.warn(
            "teatro-soho: FIRECRAWL_API_KEY missing, using plain fetch",
          );
          markdown = await fetchPlain(url);
        }
      } catch (e) {
        ctx.logger.error("teatro-soho: fetch failed", {
          url,
          error: (e as Error).message,
        });
        continue;
      }
      if (!markdown) {
        ctx.logger.warn("teatro-soho: empty response", { url });
        continue;
      }

      const cands = parseListingMarkdown(markdown);
      ctx.logger.info("teatro-soho: candidates parsed", {
        season: season.slug,
        count: cands.length,
      });
      for (const c of cands) {
        allCandidates.push({ ...c, seasonStart: season.start, seasonEnd: season.end });
      }
    }

    const seen = new Set<string>();
    const out: CanonicalEvent[] = [];
    let skippedNoDate = 0;
    let skippedDupe = 0;
    let timeAssumedCount = 0;

    for (const cand of allCandidates) {
      const parsed = cand.dateLine
        ? parseSohoDateLine(cand.dateLine, cand.seasonStart, cand.seasonEnd)
        : null;
      if (!parsed) {
        skippedNoDate++;
        ctx.logger.warn("teatro-soho: unparseable date, skipping", {
          dateLine: (cand.dateLine ?? "").slice(0, 120),
          eventUrl: cand.eventUrl,
        });
        continue;
      }

      // Dedupe across seasons: same eventUrl+title collapses to one row.
      const dedupeKey =
        cand.eventUrl + "|" + stripAccents((cand.title ?? "").toLowerCase());
      if (seen.has(dedupeKey)) {
        skippedDupe++;
        continue;
      }
      seen.add(dedupeKey);

      if (!parsed.timeExplicit) timeAssumedCount++;

      out.push({
        title: (cand.title ?? "").trim(),
        description: cand.categoryRaw
          ? `Categoría: ${cand.categoryRaw}`
          : null,
        startAt: parsed.date.toISOString(),
        endAt: null,
        timezone: "Europe/Madrid",
        venueName: "Teatro del Soho CaixaBank",
        venueAddress: null,
        locality: "Málaga",
        category: inferCategory(cand.categoryRaw ?? null, cand.title ?? ""),
        imageUrl: cand.imageUrl ?? null,
        sourceUrl: cand.eventUrl,
        ticketUrl: cand.ticketUrl ?? null,
        priceText: null,
        raw: {
          dateLine: cand.dateLine ?? null,
          categoryRaw: cand.categoryRaw ?? null,
          timeAssumed: !parsed.timeExplicit,
          adapter: "teatro-soho",
        },
      });
    }

    ctx.logger.info("teatro-soho: normalised", {
      candidates: allCandidates.length,
      returned: out.length,
      skippedNoDate,
      skippedDupe,
      timeAssumedCount,
      dryRun: ctx.dryRun,
      detailFollowCap: MAX_DETAIL_FOLLOWS,
      seasons: seasons.map((s) => s.slug),
    });

    return out;
  },
};

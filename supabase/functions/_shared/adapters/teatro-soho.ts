// Teatro del Soho CaixaBank adapter — Sprint B (dry-run only).
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
// - No AI call. Deterministic regex parsing.
// - Sprint B: detail-page enrichment enabled with strict caps:
//     MAX_DETAIL_FOLLOWS = 50, DETAIL_CONCURRENCY = 3.
//   Detail failures never fail the whole adapter.
// - Never invents dates: events with unparseable date lines are skipped
//   and logged as warnings.
// - 20:00 Europe/Madrid time fallback is used ONLY when neither the
//   listing nor the detail page expose an explicit time. Recorded as
//   raw.timeAssumed = true and raw.timeSource = 'fallback'.

import type { SourceAdapter, CanonicalEvent } from "../ingestion/types.ts";
import { madridWallTimeToDate } from "../ingestion/dates.ts";

const DEFAULT_BASE = "https://teatrodelsoho.com";
const MAX_DETAIL_FOLLOWS = 50;
const DETAIL_CONCURRENCY = 3;
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

async function fetchMarkdown(url: string, firecrawlKey: string | undefined): Promise<string> {
  if (firecrawlKey) return await fetchViaFirecrawl(url, firecrawlKey);
  return await fetchPlain(url);
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

function yearForMonthInSeason(month: number, startYear: number, endYear: number): number {
  return month >= 9 ? startYear : endYear;
}

function currentSeasons(now: Date): Array<{ slug: string; start: number; end: number }> {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "numeric",
  }).formatToParts(now);
  const y = parseInt(parts.find((p) => p.type === "year")?.value ?? "2026", 10);
  const m = parseInt(parts.find((p) => p.type === "month")?.value ?? "1", 10);
  const seasonStart = m >= 9 ? y : y - 1;
  return [
    { slug: `temporada-${seasonStart}-${seasonStart + 1}`, start: seasonStart, end: seasonStart + 1 },
    { slug: `temporada-${seasonStart + 1}-${seasonStart + 2}`, start: seasonStart + 1, end: seasonStart + 2 },
  ];
}

// --- Date-line parsing (listing) -----------------------------------------

type ParsedDate = {
  date: Date;
  endDate: Date | null;
  timeExplicit: boolean;
  rangeStartRaw?: string;
  rangeEndRaw?: string;
};

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
    const day1 = parseInt(crossRange[1], 10);
    const m1 = MONTHS_ES[crossRange[2]] ?? 0;
    const day2 = parseInt(crossRange[3], 10);
    const m2 = MONTHS_ES[crossRange[4]] ?? 0;
    if (!m1 || !m2) return null;
    const y1 = yearForMonthInSeason(m1, seasonStart, seasonEnd);
    const y2 = yearForMonthInSeason(m2, seasonStart, seasonEnd);
    return {
      date: madridWallTimeToDate(y1, m1, day1, 20, 0),
      endDate: madridWallTimeToDate(y2, m2, day2, 22, 0),
      timeExplicit: false,
      rangeStartRaw: `${day1} ${crossRange[2]}`,
      rangeEndRaw: `${day2} ${crossRange[4]}`,
    };
  }

  // Same-month range: "10 - 12 jul"
  const sameMonthRange = line.match(/^(\d{1,2})\s*[-–]\s*(\d{1,2})\s+([a-z]+)\b/);
  if (sameMonthRange) {
    const day1 = parseInt(sameMonthRange[1], 10);
    const day2 = parseInt(sameMonthRange[2], 10);
    const month = MONTHS_ES[sameMonthRange[3]] ?? 0;
    if (!month) return null;
    const year = yearForMonthInSeason(month, seasonStart, seasonEnd);
    return {
      date: madridWallTimeToDate(year, month, day1, 20, 0),
      endDate: madridWallTimeToDate(year, month, day2, 22, 0),
      timeExplicit: false,
      rangeStartRaw: `${day1} ${sameMonthRange[3]}`,
      rangeEndRaw: `${day2} ${sameMonthRange[3]}`,
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
      endDate: null,
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
  if (/\b(danza|ballet)\b/.test(raw)) return "theater";
  if (/\b(teatro|monologo|musical|circo|documental)\b/.test(raw)) return "theater";
  if (/\b(joven|infantil|nino|peques|familiar)\b/.test(raw)) return "kids";
  if (/\b(conferencia|charla)\b/.test(raw)) return "other";
  if (/\b(magia)\b/.test(raw)) return "other";
  if (/\b(festival)\b/.test(raw)) return "festivals";

  if (/\b(concierto|musica|flamenco|jazz|opera)\b/.test(t)) return "music";
  if (/\b(infantil|ninos|familiar|peques|cuento)\b/.test(t)) return "kids";
  return "theater";
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
const CATEGORY_LINE_RE = /^([A-Za-zÁÉÍÓÚáéíóúÑñ]+(?:\s+[A-Za-zÁÉÍÓÚáéíóúÑñ]+){0,3})$/;
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

    let imageUrl: string | undefined;
    let categoryRaw: string | undefined;
    let dateLine: string | undefined;
    for (let j = i - 1, k = 0; j >= 0 && k < 12; j--) {
      const prev = lines[j];
      if (!prev) continue;
      if (prev.match(TITLE_RE)) break;
      k++;
      if (!dateLine && DATE_HINT_RE.test(prev)) {
        dateLine = prev;
        continue;
      }
      if (!categoryRaw && CATEGORY_LINE_RE.test(prev) && prev.length <= 40) {
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

// --- Detail-page parser --------------------------------------------------

type DetailInfo = {
  time?: { hour: number; minute: number };
  ticketUrl?: string;
};

// Reject implausible times (e.g., a stray "24:00" or year fragments).
function pickTimeFromContext(md: string): { hour: number; minute: number } | undefined {
  // Prefer times introduced by a schedule keyword.
  const KEY_RE =
    /(horario|hora|comienzo|apertura|inicio|funci[oó]n|pases?|sesi[oó]n)[^0-9]{0,40}(\d{1,2})[:h.\s]{1,3}(\d{2})/i;
  const km = md.match(KEY_RE);
  if (km) {
    const h = parseInt(km[2], 10);
    const m = parseInt(km[3], 10);
    if (h >= 8 && h <= 23 && m >= 0 && m < 60) return { hour: h, minute: m };
  }
  // Fallback: standalone "HH:MM h" or "HH.MM h" tokens, only evening-ish.
  const RE = /\b(\d{1,2})[:.](\d{2})\s*h(?:oras)?\b/gi;
  let mm: RegExpExecArray | null;
  while ((mm = RE.exec(md)) !== null) {
    const h = parseInt(mm[1], 10);
    const min = parseInt(mm[2], 10);
    if (h >= 10 && h <= 23 && min >= 0 && min < 60) return { hour: h, minute: min };
  }
  return undefined;
}

const TICKET_HOST_RE =
  /^https?:\/\/([^/]+\.)?(entradas\.teatrodelsoho\.com|teatrodelsoho\.com\/entradas|elcorteingles\.es|ticketmaster\.es|entradas\.com|giglon\.com|enterticket\.es)\b/i;

function pickTicketUrlFromDetail(md: string): string | undefined {
  // Anchor markdown links: [text](url)
  const RE = /\[([^\]]{1,80})\]\((https?:\/\/[^\s)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = RE.exec(md)) !== null) {
    const label = m[1].toLowerCase();
    const url = m[2];
    if (
      (/comprar|entradas?|reservar|tickets?/i.test(label) ||
        TICKET_HOST_RE.test(url)) &&
      /^https?:\/\//i.test(url) &&
      !/facebook\.com|instagram\.com|twitter\.com|x\.com|youtube\.com|tiktok\.com/i.test(url)
    ) {
      return url;
    }
  }
  return undefined;
}

function parseDetailMarkdown(md: string): DetailInfo {
  const info: DetailInfo = {};
  if (!md) return info;
  const time = pickTimeFromContext(md);
  if (time) info.time = time;
  const ticket = pickTicketUrlFromDetail(md);
  if (ticket) info.ticketUrl = ticket;
  return info;
}

// --- Concurrency pool ----------------------------------------------------

async function runWithPool<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const runners = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (true) {
      const idx = cursor++;
      if (idx >= items.length) return;
      try {
        results[idx] = await worker(items[idx], idx);
      } catch {
        // swallow — caller handles per-item failures via try/catch inside worker
      }
    }
  });
  await Promise.all(runners);
  return results;
}

// --- Wall-time helpers ---------------------------------------------------

function replaceWallTime(iso: string, hour: number, minute: number): string {
  const d = new Date(iso);
  // Read wall Y/M/D in Madrid, then rebuild with the new time.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parseInt(parts.find((p) => p.type === "year")!.value, 10);
  const m = parseInt(parts.find((p) => p.type === "month")!.value, 10);
  const day = parseInt(parts.find((p) => p.type === "day")!.value, 10);
  return madridWallTimeToDate(y, m, day, hour, minute).toISOString();
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
        markdown = await fetchMarkdown(url, firecrawlKey);
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

    // ---- Detail enrichment (dry-run, capped) --------------------------
    const detailTargets = allCandidates.slice(0, MAX_DETAIL_FOLLOWS);
    const detailByUrl = new Map<string, { info: DetailInfo; failed: boolean }>();

    await runWithPool(detailTargets, DETAIL_CONCURRENCY, async (cand) => {
      try {
        const md = await fetchMarkdown(cand.eventUrl, firecrawlKey);
        detailByUrl.set(cand.eventUrl, { info: parseDetailMarkdown(md || ""), failed: false });
      } catch (e) {
        detailByUrl.set(cand.eventUrl, { info: {}, failed: true });
        ctx.logger.warn("teatro-soho: detail fetch failed", {
          url: cand.eventUrl,
          error: (e as Error).message,
        });
      }
    });

    // ---- Normalise ---------------------------------------------------
    const seen = new Set<string>();
    const out: CanonicalEvent[] = [];
    let skippedNoDate = 0;
    let skippedDupe = 0;
    let timeAssumedCount = 0;
    let detailEnrichedCount = 0;
    let detailTimeCount = 0;
    let detailTicketCount = 0;

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

      const dedupeKey =
        cand.eventUrl + "|" + stripAccents((cand.title ?? "").toLowerCase());
      if (seen.has(dedupeKey)) {
        skippedDupe++;
        continue;
      }
      seen.add(dedupeKey);

      const detail = detailByUrl.get(cand.eventUrl);
      const detailFailed = !!detail?.failed;
      const detailEnriched = !!detail && !detail.failed;
      if (detailEnriched) detailEnrichedCount++;

      // Time: detail > listing (never explicit today) > fallback 20:00.
      let timeSource: "listing" | "detail" | "fallback" = "fallback";
      let startAtIso = parsed.date.toISOString();
      if (detail?.info?.time) {
        startAtIso = replaceWallTime(
          startAtIso,
          detail.info.time.hour,
          detail.info.time.minute,
        );
        timeSource = "detail";
        detailTimeCount++;
      } else if (parsed.timeExplicit) {
        timeSource = "listing";
      }
      const timeAssumed = timeSource === "fallback";
      if (timeAssumed) timeAssumedCount++;

      // Ticket: prefer listing (already an official Comprar link), then detail.
      let ticketUrl: string | null = cand.ticketUrl ?? null;
      let ticketSource: "listing" | "detail" | null = cand.ticketUrl ? "listing" : null;
      if (!ticketUrl && detail?.info?.ticketUrl) {
        ticketUrl = detail.info.ticketUrl;
        ticketSource = "detail";
        detailTicketCount++;
      }

      out.push({
        title: (cand.title ?? "").trim(),
        description: cand.categoryRaw ? `Categoría: ${cand.categoryRaw}` : null,
        startAt: startAtIso,
        endAt: parsed.endDate ? parsed.endDate.toISOString() : null,
        timezone: "Europe/Madrid",
        venueName: "Teatro del Soho CaixaBank",
        venueAddress: null,
        locality: "Málaga",
        category: inferCategory(cand.categoryRaw ?? null, cand.title ?? ""),
        imageUrl: cand.imageUrl ?? null,
        sourceUrl: cand.eventUrl,
        ticketUrl,
        priceText: null,
        raw: {
          adapter: "teatro-soho",
          dateLine: cand.dateLine ?? null,
          categoryRaw: cand.categoryRaw ?? null,
          timeAssumed,
          detailEnriched,
          detailFailed,
          timeSource,
          ticketSource,
          rangeStartRaw: parsed.rangeStartRaw ?? null,
          rangeEndRaw: parsed.rangeEndRaw ?? null,
        },
      });
    }

    ctx.logger.info("teatro-soho: normalised", {
      candidates: allCandidates.length,
      returned: out.length,
      skippedNoDate,
      skippedDupe,
      timeAssumedCount,
      detailEnrichedCount,
      detailTimeCount,
      detailTicketCount,
      detailFollowCap: MAX_DETAIL_FOLLOWS,
      detailConcurrency: DETAIL_CONCURRENCY,
      dryRun: ctx.dryRun,
      seasons: seasons.map((s) => s.slug),
    });

    return out;
  },
};

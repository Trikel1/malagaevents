// Shared markdown-agenda parser helper for institutional/museum/cultural sources.
//
// SAFETY & SCOPE:
//  - Read-only. Pure functions. No DB. No writes. No AI calls.
//  - Uses Firecrawl v2 /scrape when FIRECRAWL_API_KEY is set (respects its
//    robots + rate limiting). Falls back to plain fetch with polite UA.
//  - Deterministic regex parsing. If a page has no recognisable event
//    structure, the caller should return [] and log `no_current_events`.
//  - Never invents dates. Events with unparseable date lines are skipped.
//  - 20:00 Europe/Madrid time fallback is used ONLY when no explicit time
//    is present. Callers must record raw.timeAssumed = true.
//
// This helper is intentionally conservative: it extracts CANDIDATES
// (title + nearby date-line + link + optional image). Real date parsing
// happens per-adapter to allow source-specific tuning.

import { madridWallTimeToDate } from "../../ingestion/dates.ts";

export const USER_AGENT =
  "MalagaEventsBot/1.0 (+https://malagaevents.lovable.app; contacto via web)";

export const MONTHS_ES: Record<string, number> = {
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

export const MONTH_TOKEN_RE =
  /\b(ene(?:ro)?|feb(?:rero)?|mar(?:zo)?|abr(?:il)?|may(?:o)?|jun(?:io)?|jul(?:io)?|ago(?:sto)?|sep(?:t)?(?:iembre)?|oct(?:ubre)?|nov(?:iembre)?|dic(?:iembre)?)\b/i;

export function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export async function fetchViaFirecrawl(
  url: string,
  apiKey: string,
): Promise<string> {
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

export async function fetchPlain(url: string): Promise<string> {
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

export async function fetchMarkdown(
  url: string,
  firecrawlKey: string | undefined,
): Promise<string> {
  if (firecrawlKey) return await fetchViaFirecrawl(url, firecrawlKey);
  return await fetchPlain(url);
}

export function absolutize(base: string, href: string): string {
  if (!href) return "";
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

// ---- Date-line parsing --------------------------------------------------

export type ParsedRange = {
  date: Date;
  endDate: Date | null;
  timeExplicit: boolean;
  rangeStartRaw?: string;
  rangeEndRaw?: string;
};

/** Guess year: if the parsed month is >= now.month, use current year;
 * if it's earlier, roll to next year. Optional explicit year overrides. */
function guessYear(month: number, explicitYear?: number): number {
  if (explicitYear && explicitYear > 2000) return explicitYear;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "numeric",
  }).formatToParts(new Date());
  const y = parseInt(parts.find((p) => p.type === "year")?.value ?? "2026", 10);
  const m = parseInt(parts.find((p) => p.type === "month")?.value ?? "1", 10);
  if (month >= m) return y;
  return y + 1;
}

/** Try to parse Spanish date lines commonly found on institutional pages:
 *   "12 de julio de 2026 20:30"
 *   "12 julio 2026"
 *   "12 - 15 julio"
 *   "30 oct - 11 ene"
 *   "12/07/2026 20:30"
 *   "Del 4 al 27 de octubre de 2025"
 */
export function parseAgendaDateLine(rawLine: string): ParsedRange | null {
  if (!rawLine) return null;
  const line = stripAccents(rawLine).toLowerCase().replace(/\s+/g, " ").trim();

  // "del 4 al 27 de octubre [de 2025]"
  const delAl = line.match(
    /del\s+(\d{1,2})\s+al\s+(\d{1,2})\s+de\s+([a-z]+)(?:\s+de\s+(\d{4}))?/,
  );
  if (delAl) {
    const d1 = parseInt(delAl[1], 10);
    const d2 = parseInt(delAl[2], 10);
    const m = MONTHS_ES[delAl[3]] ?? 0;
    if (!m) return null;
    const y = guessYear(m, delAl[4] ? parseInt(delAl[4], 10) : undefined);
    return {
      date: madridWallTimeToDate(y, m, d1, 20, 0),
      endDate: madridWallTimeToDate(y, m, d2, 22, 0),
      timeExplicit: false,
      rangeStartRaw: `${d1} ${delAl[3]}`,
      rangeEndRaw: `${d2} ${delAl[3]}`,
    };
  }

  // "del 4 de octubre al 11 de enero [de 2026]"
  const delAlCross = line.match(
    /del\s+(\d{1,2})\s+de\s+([a-z]+)\s+al\s+(\d{1,2})\s+de\s+([a-z]+)(?:\s+de\s+(\d{4}))?/,
  );
  if (delAlCross) {
    const d1 = parseInt(delAlCross[1], 10);
    const m1 = MONTHS_ES[delAlCross[2]] ?? 0;
    const d2 = parseInt(delAlCross[3], 10);
    const m2 = MONTHS_ES[delAlCross[4]] ?? 0;
    if (!m1 || !m2) return null;
    const y2 = guessYear(m2, delAlCross[5] ? parseInt(delAlCross[5], 10) : undefined);
    const y1 = m1 <= m2 ? y2 : y2 - 1;
    return {
      date: madridWallTimeToDate(y1, m1, d1, 20, 0),
      endDate: madridWallTimeToDate(y2, m2, d2, 22, 0),
      timeExplicit: false,
      rangeStartRaw: `${d1} ${delAlCross[2]}`,
      rangeEndRaw: `${d2} ${delAlCross[4]}`,
    };
  }

  // Cross-month range: "30 oct - 11 ene"
  const crossRange = line.match(
    /(\d{1,2})\s+([a-z]+)\s*[-–]\s*(\d{1,2})\s+([a-z]+)\b/,
  );
  if (crossRange) {
    const d1 = parseInt(crossRange[1], 10);
    const m1 = MONTHS_ES[crossRange[2]] ?? 0;
    const d2 = parseInt(crossRange[3], 10);
    const m2 = MONTHS_ES[crossRange[4]] ?? 0;
    if (m1 && m2) {
      const y1 = guessYear(m1);
      const y2 = m2 >= m1 ? y1 : y1 + 1;
      return {
        date: madridWallTimeToDate(y1, m1, d1, 20, 0),
        endDate: madridWallTimeToDate(y2, m2, d2, 22, 0),
        timeExplicit: false,
        rangeStartRaw: `${d1} ${crossRange[2]}`,
        rangeEndRaw: `${d2} ${crossRange[4]}`,
      };
    }
  }

  // Same-month range: "10 - 12 jul"
  const sameMonth = line.match(/(\d{1,2})\s*[-–]\s*(\d{1,2})\s+([a-z]+)\b/);
  if (sameMonth) {
    const d1 = parseInt(sameMonth[1], 10);
    const d2 = parseInt(sameMonth[2], 10);
    const m = MONTHS_ES[sameMonth[3]] ?? 0;
    if (m) {
      const y = guessYear(m);
      return {
        date: madridWallTimeToDate(y, m, d1, 20, 0),
        endDate: madridWallTimeToDate(y, m, d2, 22, 0),
        timeExplicit: false,
        rangeStartRaw: `${d1} ${sameMonth[3]}`,
        rangeEndRaw: `${d2} ${sameMonth[3]}`,
      };
    }
  }

  // Long form: "12 de julio de 2026[, 20:30]"
  const longForm = line.match(
    /(\d{1,2})\s+de\s+([a-z]+)(?:\s+de\s+(\d{4}))?(?:[\s,]+(\d{1,2})[:h.](\d{2}))?/,
  );
  if (longForm) {
    const d = parseInt(longForm[1], 10);
    const m = MONTHS_ES[longForm[2]] ?? 0;
    if (m) {
      const y = guessYear(m, longForm[3] ? parseInt(longForm[3], 10) : undefined);
      const hasTime = !!(longForm[4] && longForm[5]);
      const h = hasTime ? parseInt(longForm[4], 10) : 20;
      const min = hasTime ? parseInt(longForm[5], 10) : 0;
      return {
        date: madridWallTimeToDate(y, m, d, h, min),
        endDate: null,
        timeExplicit: hasTime,
      };
    }
  }

  // Short: "12 jul[, 20:30]"
  const short = line.match(
    /(\d{1,2})\s+([a-z]{3,10})(?:[\s,]+(\d{1,2})[:h.](\d{2}))?/,
  );
  if (short) {
    const d = parseInt(short[1], 10);
    const m = MONTHS_ES[short[2]] ?? 0;
    if (m) {
      const y = guessYear(m);
      const hasTime = !!(short[3] && short[4]);
      const h = hasTime ? parseInt(short[3], 10) : 20;
      const min = hasTime ? parseInt(short[4], 10) : 0;
      return {
        date: madridWallTimeToDate(y, m, d, h, min),
        endDate: null,
        timeExplicit: hasTime,
      };
    }
  }

  // Numeric dd/mm/yyyy[ hh:mm]
  const slash = line.match(
    /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})(?:[\s,]+(\d{1,2})[:h.](\d{2}))?/,
  );
  if (slash) {
    const d = parseInt(slash[1], 10);
    const m = parseInt(slash[2], 10);
    let y = parseInt(slash[3], 10);
    if (y < 100) y += 2000;
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    const hasTime = !!(slash[4] && slash[5]);
    const h = hasTime ? parseInt(slash[4], 10) : 20;
    const min = hasTime ? parseInt(slash[5], 10) : 0;
    return {
      date: madridWallTimeToDate(y, m, d, h, min),
      endDate: null,
      timeExplicit: hasTime,
    };
  }

  return null;
}

// ---- Candidate extraction from markdown --------------------------------

export type AgendaCandidate = {
  title: string;
  eventUrl: string;
  dateLine?: string;
  imageUrl?: string;
  ticketUrl?: string;
  contextLines?: string[];
};

const IMG_RE = /!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/i;
const HTML_IMG_RE = /<img[^>]+src=["'](https?:\/\/[^"']+)["']/i;
const HTML_ANCHOR_RE = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]{2,300})<\/a>/i;
const TICKET_LABEL_RE = /\b(entradas?|comprar|tickets?|reservar|inscribirse|inscripciones?)\b/i;
const TICKET_HOST_RE =
  /^https?:\/\/([^/]+\.)?(entradas\.|elcorteingles\.es|ticketmaster\.es|entradas\.com|giglon\.com|enterticket\.es|uniticket\.es|mientrada\.net|tickets\.|dice\.fm|wegow\.com|bacantix\.com|seetickets\.com|fever\.com)/i;
const REJECT_URL_RE = /^(#|mailto:|tel:|javascript:)/i;

/**
 * Extract event candidates from a markdown agenda page.
 * Strategy: find markdown headings (## or ###) with a real internal link
 * within N lines, plus a nearby date-like line.
 *
 * @param md   Markdown body of the listing page.
 * @param base Absolute base URL for link resolution.
 * @param opts.hrefFilter Regex an event link must match (source-specific).
 * @param opts.excludeFilter Regex to reject nav/menu links.
 * @param opts.headingLevels Heading levels to consider (default 2,3).
 */
export function extractAgendaCandidates(
  md: string,
  base: string,
  opts: {
    hrefFilter?: RegExp;
    excludeFilter?: RegExp;
    headingLevels?: number[];
  } = {},
): AgendaCandidate[] {
  const lines = md.split("\n").map((l) => l.trim());
  const levels = opts.headingLevels ?? [2, 3];
  const headingRe = new RegExp(`^(#{${Math.min(...levels)},${Math.max(...levels)}})\\s+(.+)$`);
  const linkInHeading = /\[([^\]]{2,300})\]\((https?:\/\/[^\s)]+|\/[^\s)]+)\)/;

  const out: AgendaCandidate[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const hm = line.match(headingRe);
    if (!hm) continue;
    const headingText = hm[2].trim();

    // Extract title + url from heading or nearby lines.
    let title = headingText.replace(/\[|\]/g, "").replace(/\(https?:[^)]+\)/g, "").trim();
    let eventUrl: string | undefined;

    const lm = headingText.match(linkInHeading);
    if (lm) {
      title = lm[1].trim();
      eventUrl = absolutize(base, lm[2]);
    } else {
      // Look forward up to 6 lines for an internal link (markdown OR HTML).
      for (let j = i + 1, k = 0; j < lines.length && k < 6; j++, k++) {
        const next = lines[j];
        if (!next) continue;
        const nm = next.match(/\[([^\]]{2,300})\]\((https?:\/\/[^\s)]+|\/[^\s)]+)\)/);
        if (nm) {
          eventUrl = absolutize(base, nm[2]);
          break;
        }
        const hm2 = next.match(HTML_ANCHOR_RE);
        if (hm2) {
          eventUrl = absolutize(base, hm2[1]);
          break;
        }
      }
    }
    if (!eventUrl) continue;
    if (REJECT_URL_RE.test(eventUrl)) continue;
    if (opts.hrefFilter && !opts.hrefFilter.test(eventUrl)) continue;
    if (opts.excludeFilter && opts.excludeFilter.test(eventUrl)) continue;
    if (!title || title.length < 2 || title.length > 300) continue;
    if (seen.has(eventUrl)) continue;
    seen.add(eventUrl);

    // Look for date-like line and image nearby (both directions).
    let dateLine: string | undefined;
    let imageUrl: string | undefined;
    let ticketUrl: string | undefined;
    const contextLines: string[] = [];

    for (let j = i - 6; j <= i + 12; j++) {
      if (j < 0 || j >= lines.length || j === i) continue;
      const l = lines[j];
      if (!l) continue;
      contextLines.push(l);
      if (!dateLine && MONTH_TOKEN_RE.test(l) && /\d{1,2}/.test(l) && l.length < 200) {
        dateLine = l;
      } else if (!dateLine && /\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/.test(l)) {
        dateLine = l;
      }
      if (!imageUrl) {
        const im = l.match(IMG_RE);
        if (im) imageUrl = im[1];
        else {
          const him = l.match(HTML_IMG_RE);
          if (him) imageUrl = him[1];
        }
      }
      if (!ticketUrl) {
        const links = l.matchAll(/\[([^\]]{1,80})\]\((https?:\/\/[^\s)]+)\)/g);
        for (const link of links) {
          const label = link[1];
          const url = link[2];
          if (
            (TICKET_LABEL_RE.test(label) || TICKET_HOST_RE.test(url)) &&
            !/facebook\.com|instagram\.com|twitter\.com|x\.com|youtube\.com|tiktok\.com/i.test(url)
          ) {
            ticketUrl = url;
            break;
          }
        }
      }
    }

    out.push({
      title,
      eventUrl,
      dateLine,
      imageUrl,
      ticketUrl,
      contextLines: contextLines.slice(0, 20),
    });
  }

  return out;
}

// ---- Concurrency pool --------------------------------------------------

export async function runWithPool<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const n = Math.max(1, Math.min(limit, items.length));
  const runners = new Array(n).fill(0).map(async () => {
    while (true) {
      const idx = cursor++;
      if (idx >= items.length) return;
      try {
        results[idx] = await worker(items[idx], idx);
      } catch {
        // swallow per-item
      }
    }
  });
  await Promise.all(runners);
  return results;
}

// ---- Time picking helper (from detail markdown) ------------------------

export function pickExplicitTime(
  md: string,
): { hour: number; minute: number } | undefined {
  if (!md) return undefined;
  const KEY_RE =
    /(horario|hora|comienzo|apertura|inicio|funci[oó]n|pases?|sesi[oó]n|comienza)[^0-9]{0,40}(\d{1,2})[:h.\s]{1,3}(\d{2})/i;
  const km = md.match(KEY_RE);
  if (km) {
    const h = parseInt(km[2], 10);
    const m = parseInt(km[3], 10);
    if (h >= 8 && h <= 23 && m >= 0 && m < 60) return { hour: h, minute: m };
  }
  const RE = /\b(\d{1,2})[:.](\d{2})\s*h(?:oras)?\b/gi;
  let mm: RegExpExecArray | null;
  while ((mm = RE.exec(md)) !== null) {
    const h = parseInt(mm[1], 10);
    const min = parseInt(mm[2], 10);
    if (h >= 10 && h <= 23 && min >= 0 && min < 60) return { hour: h, minute: min };
  }
  return undefined;
}

export function replaceMadridWallTime(
  iso: string,
  hour: number,
  minute: number,
): string {
  const d = new Date(iso);
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

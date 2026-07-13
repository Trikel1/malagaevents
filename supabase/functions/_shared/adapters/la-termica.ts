// La Térmica (Diputación de Málaga) — dedicated WP-JSON adapter, dry-run only.
//
// SPRINT H2 — replaces the generic markdown fallback with a dedicated
// parser that hits the WordPress REST API and extracts real event dates
// from the post body, where La Térmica consistently writes:
//
//     "6 de junio de 2026  De 17:00 h a 23:00 h"
//     "17 de abril | De 18.00 a 00.00 h"
//     "15 de diciembre 2025 | 17:00h"
//
// SAFETY & SCOPE:
//  - Read-only. Dry-run. No DB writes.
//  - Never emits midnight-UTC startAt (checked at the boundary).
//  - Falls back to 20:00 Europe/Madrid with raw.timeAssumed=true when
//    the source explicitly provides a date but no time.
//  - Skips posts where we cannot parse a date (never invents dates).
//  - Cap: at most 30 posts per category, at most 6 categories.

import type { SourceAdapter, CanonicalEvent } from "../ingestion/types.ts";
import { madridWallTimeToDate } from "../ingestion/dates.ts";
import { MONTHS_ES, stripAccents, USER_AGENT } from "./lib/agenda-parser.ts";

const API = "https://www.latermicamalaga.com/wp-json/wp/v2";
const BASE_LINK = "https://latermicamalaga.com";

// WP category id -> canonical category. Discovered live from La Térmica's
// /wp-json/wp/v2/categories (2026-07).
const EVENT_CATEGORIES: Array<{ id: number; canonical: string; label: string }> = [
  { id: 142, canonical: "music",      label: "espectaculosconciertos" },   // Teatro/Conciertos
  { id: 139, canonical: "festival",   label: "encuentros-festivales" },
  { id: 143, canonical: "exhibition", label: "exposiciones" },
  { id: 308, canonical: "cinema",     label: "proyecciones" },
  { id: 141, canonical: "conference", label: "debatesconferencias" },
  { id: 140, canonical: "workshop",   label: "cursos-y-talleres" },
];

type WpPost = {
  id: number;
  date: string;
  link: string;
  slug: string;
  title: { rendered: string };
  excerpt: { rendered: string };
  content: { rendered: string };
  categories: number[];
  _embedded?: {
    "wp:featuredmedia"?: Array<{ source_url?: string; alt_text?: string }>;
  };
};

// ---------- helpers ------------------------------------------------------

function stripHtml(s: string): string {
  return s
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&aacute;/gi, "á")
    .replace(/&eacute;/gi, "é")
    .replace(/&iacute;/gi, "í")
    .replace(/&oacute;/gi, "ó")
    .replace(/&uacute;/gi, "ú")
    .replace(/&#8211;|&#8212;/gi, "—")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeTitle(s: string): string {
  return stripHtml(s).replace(/\s{2,}/g, " ").trim();
}

/** Match Spanish long-form date. Returns { year, month, day, monthWord }. */
function findDateInText(
  text: string,
  fallbackYear: number,
): { y: number; m: number; d: number; matchIndex: number; matchLen: number } | null {
  const t = stripAccents(text.toLowerCase());
  // 15 de diciembre de 2025 | 15 diciembre 2025 | 5 de junio (no year)
  const RE = /\b(\d{1,2})\s+(?:de\s+)?([a-z]+)\s*(?:de\s+)?(\d{4})?\b/g;
  let m: RegExpExecArray | null;
  while ((m = RE.exec(t)) !== null) {
    const d = parseInt(m[1], 10);
    const mo = MONTHS_ES[m[2]];
    if (!mo || d < 1 || d > 31) continue;
    const y = m[3] ? parseInt(m[3], 10) : fallbackYear;
    if (y < 2020 || y > 2035) continue;
    return { y, m: mo, d, matchIndex: m.index, matchLen: m[0].length };
  }
  return null;
}

/** Pick first sensible HH:MM in Europe/Madrid working hours (08-23:59). */
function findStartTime(text: string): { h: number; mi: number; endH?: number; endMi?: number } | null {
  // Range: "De 17:00 h a 23:00 h" | "de 12.00 a 19.00 h" | "de 18.00 a 00.00 h"
  const RANGE =
    /\bde\s+(\d{1,2})[:.h ]{0,2}(\d{2})?\s*h?\s*(?:a|-|–)\s*(\d{1,2})[:.h ]{0,2}(\d{2})?\s*h?/i;
  const rm = text.match(RANGE);
  if (rm) {
    const h1 = parseInt(rm[1], 10);
    const m1 = rm[2] ? parseInt(rm[2], 10) : 0;
    const h2 = parseInt(rm[3], 10);
    const m2 = rm[4] ? parseInt(rm[4], 10) : 0;
    if (h1 >= 8 && h1 <= 23 && m1 < 60 && h2 >= 0 && h2 <= 23 && m2 < 60) {
      return { h: h1, mi: m1, endH: h2, endMi: m2 };
    }
  }
  // Single time: "17:00 h", "17.00h", "17h"
  const SINGLE = /\b(\d{1,2})[:.h](\d{2})?\s*h(?:oras)?\b/i;
  const sm = text.match(SINGLE);
  if (sm) {
    const h = parseInt(sm[1], 10);
    const mi = sm[2] ? parseInt(sm[2], 10) : 0;
    if (h >= 8 && h <= 23 && mi < 60) return { h, mi };
  }
  return null;
}

async function fetchPosts(catId: number, perPage: number): Promise<WpPost[]> {
  const url =
    `${API}/posts?per_page=${perPage}&categories=${catId}` +
    `&_fields=id,date,link,slug,title,excerpt,content,categories,_embedded` +
    `&_embed=wp:featuredmedia`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
      "Accept-Language": "es-ES,es;q=0.9",
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`wp_${res.status}: ${body.slice(0, 120)}`);
  }
  return (await res.json()) as WpPost[];
}

// ---------- adapter ------------------------------------------------------

export const laTermicaAdapter: SourceAdapter = {
  key: "la-termica",
  name: "La Térmica",

  fetchEvents: async (ctx) => {
    const now = new Date();
    const nowMs = now.getTime();
    const events: CanonicalEvent[] = [];
    const seen = new Set<string>();

    let fetched = 0;
    let noDate = 0;
    let past = 0;
    let assumed = 0;
    let rejectedBadHour = 0;
    let withEnd = 0;
    let withTicket = 0;
    let withImage = 0;

    for (const cat of EVENT_CATEGORIES) {
      let posts: WpPost[] = [];
      try {
        posts = await fetchPosts(cat.id, 30);
      } catch (e) {
        ctx.logger.warn("la-termica: category fetch failed", {
          catId: cat.id,
          label: cat.label,
          error: (e as Error).message,
        });
        continue;
      }
      fetched += posts.length;

      for (const p of posts) {
        const title = decodeTitle(p.title.rendered);
        if (!title) continue;
        if (seen.has(p.link)) continue;

        const rawText = stripHtml(
          (p.content?.rendered ?? "") + " " + (p.excerpt?.rendered ?? ""),
        );
        // Search date in the first ~800 chars of body first, fall back to title
        const head = rawText.slice(0, 800);
        const pubYear = new Date(p.date).getUTCFullYear();
        const dateHead = findDateInText(head, pubYear)
          ?? findDateInText(title, pubYear);
        if (!dateHead) {
          noDate++;
          continue;
        }

        // For time, look ONLY in the window right after the date match — that's
        // where La Térmica writes "De 17:00 h a 23:00 h". Prevents picking up
        // random hours from marketing text.
        const timeWindow = head.slice(
          dateHead.matchIndex,
          dateHead.matchIndex + dateHead.matchLen + 120,
        );
        const time = findStartTime(timeWindow);

        let timeAssumed = false;
        let timeSource: "wp-body" | "fallback" = "fallback";
        let hour = 20;
        let minute = 0;
        if (time) {
          hour = time.h;
          minute = time.mi;
          timeSource = "wp-body";
        } else {
          timeAssumed = true;
          assumed++;
        }

        const start = madridWallTimeToDate(dateHead.y, dateHead.m, dateHead.d, hour, minute);
        if (!start || Number.isNaN(start.getTime())) {
          noDate++;
          continue;
        }
        // Skip clearly past events (>3 days old)
        if (start.getTime() < nowMs - 3 * 86_400_000) {
          past++;
          continue;
        }

        // SAFETY GATE — never emit midnight-UTC or 0-6 local (the "02:00 bug")
        const utcHour = start.getUTCHours();
        const localHour = Number(
          new Intl.DateTimeFormat("en-GB", {
            timeZone: "Europe/Madrid",
            hour: "2-digit",
            hour12: false,
          }).format(start),
        );
        if (utcHour === 0 || (localHour >= 0 && localHour <= 6)) {
          rejectedBadHour++;
          ctx.logger.warn("la-termica: rejected bad-hour candidate", {
            title,
            localHour,
            utcHour,
          });
          continue;
        }

        let end: Date | null = null;
        if (time?.endH != null) {
          // Handle "hasta las 00:00 h" as next day
          const endDay = time.endH < hour ? dateHead.d + 1 : dateHead.d;
          end = madridWallTimeToDate(dateHead.y, dateHead.m, endDay, time.endH, time.endMi ?? 0);
          if (end && !Number.isNaN(end.getTime())) withEnd++;
          else end = null;
        }

        const media = p._embedded?.["wp:featuredmedia"]?.[0];
        const imageUrl = media?.source_url ? String(media.source_url) : null;
        if (imageUrl) withImage++;

        // Extract first "http…" link inside content that isn't the sourceUrl itself
        // as an approximate ticket/registration URL.
        let ticketUrl: string | null = null;
        const linkMatch = /https?:\/\/[^\s"'<>()]+/i.exec(rawText);
        if (linkMatch) {
          const u = linkMatch[0];
          if (
            u !== p.link &&
            !/latermicamalaga\.com\/wp-content/i.test(u) &&
            !/facebook\.com|instagram\.com|twitter\.com|x\.com|tiktok\.com/i.test(u)
          ) {
            ticketUrl = u;
            withTicket++;
          }
        }

        seen.add(p.link);
        events.push({
          title,
          description: null,
          startAt: start.toISOString(),
          endAt: end ? end.toISOString() : null,
          timezone: "Europe/Madrid",
          venueName: "La Térmica",
          venueAddress: "Avenida de los Guindos, 48, Málaga",
          locality: "Málaga",
          category: cat.canonical,
          imageUrl,
          sourceUrl: p.link.startsWith("http") ? p.link : `${BASE_LINK}${p.link}`,
          ticketUrl,
          priceText: /entrada\s+gratuita|gratis|free/i.test(rawText.slice(0, 400))
            ? "Entrada gratuita"
            : null,
          raw: {
            adapter: "la-termica",
            wpPostId: p.id,
            wpCategoryId: cat.id,
            wpCategoryLabel: cat.label,
            pubDate: p.date,
            timeAssumed,
            timeSource,
            dateParsedFrom: "wp-body",
          },
        });
      }
    }

    ctx.logger.info("la-termica: normalised", {
      postsFetched: fetched,
      emitted: events.length,
      noDate,
      past,
      timeAssumedCount: assumed,
      rejectedBadHour,
      withEnd,
      withTicket,
      withImage,
      dryRun: ctx.dryRun,
    });

    return events;
  },
};

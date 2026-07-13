// Pure parser for malaga.es institutional agenda pages
// (Diputación de Málaga · Agenda provincial, Culturama, Delegación de Cultura).
//
// Input: markdown + link array as returned by Firecrawl v2 `formats:["markdown","links"]`.
// Output: list of event stubs (URL + external id) or a fully-canonical event
//         parsed from a detail page.
//
// Design notes:
// - No network calls, no Deno globals. Trivially unit-testable from vitest.
// - Detail pages embed an `addtocalendar.com/atc/ical?…` link whose query
//   parameters (`e[0][date_start]`, `e[0][date_end]`, `e[0][timezone]`,
//   `e[0][title]`, `e[0][organizer]`, `e[0][description]`) are our canonical
//   source of truth for dates + organizer. Wall-clock rendering on the site
//   is inconsistent (mixed locales) so we DO NOT try to reparse the human
//   header.
// - `date_start` / `date_end` are US-style `M/D/YYYY`. We anchor an all-day
//   event to 09:00 Europe/Madrid to keep dedupe keys stable across DST.

export interface MalagaEsListItem {
  /** Stable id extracted from `com1_md3_cd-<n>`; used as externalId. */
  externalId: string;
  /** Canonical detail URL (query string stripped). */
  detailUrl: string;
  /** Slug fragment, useful for logs. */
  slug: string;
}

export interface MalagaEsDetail {
  externalId: string;
  title: string;
  /** Wall-clock components in Europe/Madrid (year/month/day + optional time). */
  startYear: number;
  startMonth: number;
  startDay: number;
  endYear: number;
  endMonth: number;
  endDay: number;
  timezone: "Europe/Madrid";
  organizer: string | null;
  locality: string | null;
  category: string | null;
  imageUrl: string | null;
  descriptionText: string | null;
  sourceUrl: string;
}

/**
 * Extract detail URLs from a list-page link array. Only accepts links whose
 * path starts with `pathPrefix` AND ends with a non-empty slug segment after
 * the `com1_md3_cd-<n>/` token. Query strings are dropped. Deduped by id.
 */
export function extractDetailLinks(
  links: readonly string[],
  pathPrefix: string,
): MalagaEsListItem[] {
  const prefix = pathPrefix.replace(/\/$/, "");
  const re = new RegExp(
    "^" +
      escapeRegex(prefix) +
      "/com1_md3_cd-(\\d+)/([a-z0-9][a-z0-9\\-]{4,})(?:[/?].*)?$",
    "i",
  );
  const seen = new Map<string, MalagaEsListItem>();
  for (const raw of links) {
    if (typeof raw !== "string") continue;
    const clean = raw.split("#")[0];
    const m = clean.match(re);
    if (!m) continue;
    const externalId = m[1];
    if (seen.has(externalId)) continue;
    const detailUrl = clean.split("?")[0];
    seen.set(externalId, {
      externalId,
      detailUrl,
      slug: m[2].toLowerCase(),
    });
  }
  return Array.from(seen.values());
}

/**
 * Parse a detail page. Returns null when the essential fields (title +
 * dates) cannot be recovered. Never throws.
 */
export function parseDetailPage(
  markdown: string,
  sourceUrl: string,
): MalagaEsDetail | null {
  if (typeof markdown !== "string" || markdown.length === 0) return null;

  const idMatch = sourceUrl.match(/com1_md3_cd-(\d+)/i);
  if (!idMatch) return null;
  const externalId = idMatch[1];

  // Title: first `# …` heading. Skip `## Agenda` boilerplate.
  let title: string | null = null;
  for (const line of markdown.split("\n")) {
    const t = line.trim();
    if (!t.startsWith("# ") || t.startsWith("## ")) continue;
    const candidate = t.replace(/^#\s+/, "").trim();
    if (candidate && !/^agenda$/i.test(candidate)) {
      title = candidate;
      break;
    }
  }
  if (!title) return null;

  // AddToCalendar ical link. We stop at whitespace or `)` / `"`.
  const icalMatch = markdown.match(/addtocalendar\.com\/atc\/ical\?([^\s)"]+)/);
  if (!icalMatch) return null;
  const params = parseIcalQuery(icalMatch[1]);
  const dateStart = params["e[0][date_start]"];
  const dateEnd = params["e[0][date_end]"] ?? dateStart;
  if (!dateStart) return null;
  const start = parseUsDate(dateStart);
  const end = parseUsDate(dateEnd ?? dateStart);
  if (!start || !end) return null;

  const tz = params["e[0][timezone]"];
  if (tz && tz !== "Europe/Madrid") return null;

  const organizer = params["e[0][organizer]"] ?? null;
  const descriptionHtml = params["e[0][description]"] ?? null;
  const descriptionText = descriptionHtml
    ? stripHtml(descriptionHtml).slice(0, 4000)
    : null;

  // Image: first Firecrawl markdown image whose URL contains `arc_` (site's
  // canonical media prefix). Falls back to null.
  let imageUrl: string | null = null;
  const imgRe = /!\[[^\]]*\]\((https?:\/\/[^\s)]+arc_[^\s)]+)\)/;
  const imgMatch = markdown.match(imgRe);
  if (imgMatch) imageUrl = imgMatch[1];

  // Locality: standalone line matching a Málaga-province municipality name
  // ending with a period. Falls back to the last comma-separated token on
  // the "Ciudad, Ciudad" wrap-up line before `Add to Calendar`.
  const locality = extractLocality(markdown);

  const category = extractCategory(markdown);

  return {
    externalId,
    title,
    startYear: start.year,
    startMonth: start.month,
    startDay: start.day,
    endYear: end.year,
    endMonth: end.month,
    endDay: end.day,
    timezone: "Europe/Madrid",
    organizer: organizer && organizer.trim() ? organizer.trim() : null,
    locality,
    category,
    imageUrl,
    descriptionText,
    sourceUrl,
  };
}

// ------------------------------- helpers -------------------------------

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Decode a query string preserving `e[0][x]` bracket keys. */
function parseIcalQuery(qs: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of qs.split("&")) {
    if (!pair) continue;
    const eq = pair.indexOf("=");
    const rawKey = eq === -1 ? pair : pair.slice(0, eq);
    const rawVal = eq === -1 ? "" : pair.slice(eq + 1);
    let key: string;
    let val: string;
    try {
      key = decodeURIComponent(rawKey.replace(/\+/g, " "));
      val = decodeURIComponent(rawVal.replace(/\+/g, " "));
    } catch {
      continue;
    }
    if (!(key in out)) out[key] = val;
  }
  return out;
}

function parseUsDate(
  s: string,
): { year: number; month: number; day: number } | null {
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const month = parseInt(m[1], 10);
  const day = parseInt(m[2], 10);
  const year = parseInt(m[3], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (year < 2000 || year > 2100) return null;
  return { year, month, day };
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function extractLocality(md: string): string | null {
  // Line "Torremolinos." right after the date header (see fixtures).
  const m = md.match(/\n([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ\-\s]{2,50})\.\s*\n/);
  if (m) {
    const cand = m[1].trim();
    if (cand.length <= 50 && !/agenda|información|más|inicio/i.test(cand)) {
      return cand;
    }
  }
  return null;
}

function extractCategory(md: string): string | null {
  // Categories on the site are single-line entries between the locality line
  // and the "Add to Calendar" block. We match a short line of words +
  // spaces + tildes only (no markdown syntax) that follows the locality.
  const lines = md.split("\n").map((l) => l.trim());
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line || line.length > 80) continue;
    if (/^[a-záéíóúñ\s]+\.$/i.test(line) && i + 1 < lines.length) {
      // The next non-empty short line is the category candidate.
      for (let j = i + 1; j < Math.min(i + 6, lines.length); j += 1) {
        const cand = lines[j];
        if (!cand) continue;
        if (cand.length > 80) break;
        if (/^[\[#*(\-]/.test(cand)) continue;
        if (/^[a-záéíóúñ\s\-,]+$/i.test(cand)) return cand;
        break;
      }
    }
  }
  return null;
}

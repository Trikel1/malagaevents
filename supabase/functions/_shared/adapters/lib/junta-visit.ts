// Pure parser for Junta de Andalucía · Agenda Cultural de Málaga.
//
// Detail pages expose a schema.org Event as JSON-LD inside `@graph` (name,
// url, description, image, @id, location.{name,url,address,geo}). The site
// unfortunately DOES NOT emit startDate/endDate in JSON-LD, so we recover the
// date + time from a stable Drupal wingsuit block:
//
//   <i class="far fa-calendar …"></i>  … <div class="text_base">18 de Julio del 2026</div>
//   <i class="far fa-clock    …"></i>  … <div class="text_base">…22:00 h.</div>
//
// No network calls, no Deno globals. Trivially unit-testable from vitest.
// Never throws; returns null when the essential fields cannot be recovered.

export interface JuntaListItem {
  externalId: string; // slug of the event (URL last segment)
  detailUrl: string;
}

export interface JuntaDetail {
  externalId: string; // schema.org @id (Drupal node id) when available, else slug
  slug: string;
  title: string;
  description: string | null;
  detailUrl: string;
  imageUrl: string | null;
  venueName: string | null;
  venueAddress: string | null;
  locality: string; // addressLocality (Málaga municipality)
  region: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  /** Wall-clock components in Europe/Madrid. */
  year: number;
  month: number; // 1-12
  day: number;
  hour: number; // 0-23; defaults to 20 when only date is present
  minute: number; // 0-59
  hasExplicitTime: boolean;
}

const MONTHS_ES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

const BASE_PATH = "/cultura/agendaculturaldeandalucia/evento/";

/** Extract unique detail links from the Málaga agenda listing HTML. */
export function extractJuntaListLinks(html: string): JuntaListItem[] {
  if (typeof html !== "string" || html.length === 0) return [];
  const re = new RegExp(
    `${escapeRegex(BASE_PATH)}([a-z0-9][a-z0-9\\-]{3,})`,
    "gi",
  );
  const seen = new Map<string, JuntaListItem>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const slug = m[1].toLowerCase();
    if (seen.has(slug)) continue;
    seen.set(slug, {
      externalId: slug,
      detailUrl: `https://www.juntadeandalucia.es${BASE_PATH}${slug}`,
    });
  }
  return Array.from(seen.values());
}

/** Parse a detail-page HTML into a structured event. */
export function parseJuntaDetailPage(
  html: string,
  detailUrl: string,
): JuntaDetail | null {
  if (typeof html !== "string" || html.length === 0) return null;

  const slugMatch = detailUrl.match(/\/evento\/([a-z0-9\-]+)/i);
  if (!slugMatch) return null;
  const slug = slugMatch[1].toLowerCase();

  // ---- JSON-LD Event ----
  const ldjson = extractLdjsonEvent(html);
  if (!ldjson) return null;
  const title = safeString(ldjson.name);
  if (!title) return null;
  const description = safeString(ldjson.description) ?? null;
  const imageUrl = pickImageUrl(ldjson.image);
  const location = (ldjson.location ?? {}) as Record<string, unknown>;
  const address = (location.address ?? {}) as Record<string, unknown>;
  const venueName = safeString(location.name);
  const venueAddress = joinStreetAddress(address.streetAddress);
  const locality = safeString(address.addressLocality) ?? "Málaga";
  const region = safeString(address.addressRegion);
  const postalCode = safeString(address.postalCode);
  const geo = (location.geo ?? {}) as Record<string, unknown>;
  const latitude = coerceNumber(geo.latitude);
  const longitude = coerceNumber(geo.longitude);
  const idStr = ldjson["@id"];
  const externalId =
    (typeof idStr === "string" || typeof idStr === "number") && String(idStr).length > 0
      ? String(idStr)
      : slug;

  // ---- Date + time from the wingsuit HTML block ----
  const dt = extractJuntaDateTime(html);
  if (!dt) return null;

  return {
    externalId,
    slug,
    title,
    description,
    detailUrl,
    imageUrl,
    venueName,
    venueAddress,
    locality,
    region,
    postalCode,
    latitude,
    longitude,
    year: dt.year,
    month: dt.month,
    day: dt.day,
    hour: dt.hour,
    minute: dt.minute,
    hasExplicitTime: dt.hasExplicitTime,
  };
}

// ---------------- helpers ----------------

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function safeString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

function coerceNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function pickImageUrl(v: unknown): string | null {
  if (typeof v === "string") return v.trim() || null;
  if (v && typeof v === "object") {
    const url = (v as Record<string, unknown>).url;
    return safeString(url);
  }
  return null;
}

function joinStreetAddress(v: unknown): string | null {
  if (typeof v === "string") return v.trim() || null;
  if (Array.isArray(v)) {
    const parts = v
      .map((x) => (typeof x === "string" ? x.trim() : ""))
      .filter((x) => x.length > 0);
    return parts.length ? parts.join(", ") : null;
  }
  return null;
}

function extractLdjsonEvent(html: string): Record<string, unknown> | null {
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1].trim();
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    const ev = findEvent(parsed);
    if (ev) return ev;
  }
  return null;
}

function findEvent(node: unknown): Record<string, unknown> | null {
  if (!node || typeof node !== "object") return null;
  const obj = node as Record<string, unknown>;
  const type = obj["@type"];
  if (
    (typeof type === "string" && type === "Event") ||
    (Array.isArray(type) && type.includes("Event"))
  ) {
    return obj;
  }
  const graph = obj["@graph"];
  if (Array.isArray(graph)) {
    for (const item of graph) {
      const ev = findEvent(item);
      if (ev) return ev;
    }
  }
  return null;
}

function extractJuntaDateTime(html: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  hasExplicitTime: boolean;
} | null {
  // Date: the `<div class="text_base">DD de MES del YYYY</div>` that sits in
  // the same flex block as the `fa-calendar` icon. We locate the first
  // fa-calendar and search forward within a small window for the text_base.
  const calIdx = html.search(/fa-calendar\b/);
  if (calIdx === -1) return null;
  const dateWindow = html.slice(calIdx, calIdx + 3000);
  const dateBlock = dateWindow.match(
    /<div[^>]*class="text_base"[^>]*>\s*(?:<p[^>]*>)?(?:<span[^>]*>)?\s*(\d{1,2})\s+de\s+([A-Za-zÁÉÍÓÚáéíóú]+)\s+del?\s+(\d{4})/,
  );
  if (!dateBlock) return null;
  const day = parseInt(dateBlock[1], 10);
  const monthName = dateBlock[2].toLowerCase();
  const monthNorm = monthName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const month = MONTHS_ES[monthNorm];
  const year = parseInt(dateBlock[3], 10);
  if (!month || day < 1 || day > 31 || year < 2000 || year > 2100) return null;

  // Time (optional): first fa-clock after the date block.
  let hour = 20;
  let minute = 0;
  let hasExplicitTime = false;
  const clockIdx = html.indexOf("fa-clock", calIdx);
  if (clockIdx !== -1) {
    const clockWindow = html.slice(clockIdx, clockIdx + 2000);
    const t = clockWindow.match(
      /<div[^>]*class="text_base"[^>]*>[\s\S]{0,300}?(\d{1,2})[:h.](\d{2})/,
    );
    if (t) {
      hour = parseInt(t[1], 10);
      minute = parseInt(t[2], 10);
      if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
        hasExplicitTime = true;
      } else {
        hour = 20;
        minute = 0;
      }
    }
  }

  return { year, month, day, hour, minute, hasExplicitTime };
}

// ---------------------------------------------------------------------------
// Visit Costa del Sol parser
// ---------------------------------------------------------------------------
//
// Detail markdown emitted by Firecrawl v2 (waitFor:3000) reliably contains:
//
//   # <TITLE>
//   [<Locality>](…#enlaceMapa)
//   <TITLE>- <DD MMM YYYY>              ← date line, mono/range
//   …
//   ## Apertura
//   - <TITLE>(<DD MMM YYYY>)            ← alt line (used for date-range check)
//
// Sitemap-art.xml lists every `/agenda/<slug>-p<ID>` — we use those as the
// canonical source of externalIds.

const VS_BASE_HOST = "https://www.visitacostadelsol.com";
const VS_AGENDA_URL_RE = /https:\/\/www\.visitacostadelsol\.com\/agenda\/[a-z0-9\-]+-p[0-9]+/g;

const MONTHS_ES_SHORT: Record<string, number> = {
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6,
  jul: 7, ago: 8, sep: 9, oct: 10, nov: 11, dic: 12,
};

export interface VisitListItem {
  externalId: string; // numeric part after `-p`
  slug: string;
  detailUrl: string;
}

export interface VisitDetail {
  externalId: string;
  slug: string;
  title: string;
  detailUrl: string;
  locality: string; // e.g. "Málaga"
  year: number;
  month: number;
  day: number;
  endYear: number;
  endMonth: number;
  endDay: number;
  descriptionText: string | null;
  imageUrl: string | null;
  externalWebsite: string | null;
}

/** Extract event URLs from the Visit Costa del Sol sitemap. */
export function extractVisitSitemapLinks(xml: string): VisitListItem[] {
  if (typeof xml !== "string" || xml.length === 0) return [];
  const seen = new Map<string, VisitListItem>();
  const matches = xml.match(VS_AGENDA_URL_RE) ?? [];
  for (const url of matches) {
    const m = url.match(/\/agenda\/([a-z0-9\-]+)-p([0-9]+)$/);
    if (!m) continue;
    const slug = m[1];
    const externalId = m[2];
    if (seen.has(externalId)) continue;
    seen.set(externalId, { externalId, slug, detailUrl: url });
  }
  return Array.from(seen.values());
}

/** Parse Firecrawl markdown for one Visit Costa del Sol event. */
export function parseVisitDetailMarkdown(
  markdown: string,
  detailUrl: string,
): VisitDetail | null {
  if (typeof markdown !== "string" || markdown.length === 0) return null;
  const m = detailUrl.match(/\/agenda\/([a-z0-9\-]+)-p([0-9]+)/);
  if (!m) return null;
  const slug = m[1];
  const externalId = m[2];

  // Title: the H1 that matches the slug, not the site-wide `# Agenda` header.
  let title: string | null = null;
  const headings = markdown.match(/^# .+$/gm) ?? [];
  for (const h of headings) {
    const t = h.replace(/^#\s+/, "").trim();
    if (/^agenda$/i.test(t)) continue;
    title = t;
    break;
  }
  if (!title) return null;

  // Locality: the first `[<Municipality>](…#enlaceMapa)` link after H1.
  let locality: string | null = null;
  const locMatch = markdown.match(/\[([A-ZÁÉÍÓÚÑ][^\]]{2,60})\]\([^)]*#enlaceMapa[^)]*\)/);
  if (locMatch) locality = locMatch[1].trim();

  // Date: line "<TITLE>- <DD MMM YYYY>" OR "<TITLE>- <DD MMM YYYY> - <DD MMM YYYY>".
  //       Also fallback to "## Apertura\n- <TITLE>(<DD MMM YYYY>)".
  const dateRange = findVisitDateRange(markdown);
  if (!dateRange) return null;

  // Image: first `arc_<n>_g.jpg` occurrence
  let imageUrl: string | null = null;
  const imgMatch = markdown.match(/https:\/\/[^\s)]+arc_\d+_[gm]\.jpg/);
  if (imgMatch) imageUrl = imgMatch[0];

  // External website (linke-arte, ticket vendor …)
  let externalWebsite: string | null = null;
  const extMatch = markdown.match(
    /\[https:\/\/[^\]]+\]\((https:\/\/(?!static\.costadelsolmalaga\.org|www\.visitacostadelsol\.com|www\.facebook\.com|x\.com|whatsapp:|maps\.googleapis|www\.google\.com)[^)]+)\)/,
  );
  if (extMatch) externalWebsite = extMatch[1];

  // Description: the paragraph after the date line, up to the next `* * *`.
  const descRe = new RegExp(
    `- ${escapeRegex(dateRange.raw)}\\s*\\n\\s*\\*\\s*\\*\\s*\\*\\s*\\n([\\s\\S]{0,3000}?)\\n\\s*\\*\\s*\\*\\s*\\*`,
  );
  const descMatch = markdown.match(descRe);
  let descriptionText: string | null = null;
  if (descMatch) {
    descriptionText = descMatch[1]
      .replace(/\s+/g, " ")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .trim()
      .slice(0, 2000);
  }

  return {
    externalId,
    slug,
    title,
    detailUrl,
    locality: locality ?? "Málaga",
    year: dateRange.startYear,
    month: dateRange.startMonth,
    day: dateRange.startDay,
    endYear: dateRange.endYear,
    endMonth: dateRange.endMonth,
    endDay: dateRange.endDay,
    descriptionText,
    imageUrl,
    externalWebsite,
  };
}

interface VisitDate {
  startYear: number;
  startMonth: number;
  startDay: number;
  endYear: number;
  endMonth: number;
  endDay: number;
  raw: string;
}

function findVisitDateRange(md: string): VisitDate | null {
  // Primary pattern: "TITLE- 25 Jul 2026" or "TITLE- 25 Jul 2026 - 27 Jul 2026"
  const primary = md.match(
    /-\s*(\d{1,2})\s+([A-Za-zÁÉÍÓÚáéíóú]{3})\s+(\d{4})(?:\s*-\s*(\d{1,2})\s+([A-Za-zÁÉÍÓÚáéíóú]{3})\s+(\d{4}))?\s*(?:\n|$)/,
  );
  if (primary) {
    const startDay = parseInt(primary[1], 10);
    const startMonth = MONTHS_ES_SHORT[primary[2].toLowerCase().slice(0, 3)];
    const startYear = parseInt(primary[3], 10);
    if (!startMonth || startYear < 2000) return null;
    const endDay = primary[4] ? parseInt(primary[4], 10) : startDay;
    const endMonth = primary[5]
      ? MONTHS_ES_SHORT[primary[5].toLowerCase().slice(0, 3)]
      : startMonth;
    const endYear = primary[6] ? parseInt(primary[6], 10) : startYear;
    return {
      startDay,
      startMonth,
      startYear,
      endDay,
      endMonth: endMonth ?? startMonth,
      endYear,
      raw: primary[0].replace(/^-\s*/, "").replace(/\s*$/, ""),
    };
  }
  return null;
}

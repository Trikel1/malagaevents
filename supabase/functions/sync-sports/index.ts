/**
 * sync-sports Edge Function
 * Scrapes sports event data from approved sources using Firecrawl v1/scrape
 * and upserts into sports_events table.
 *
 * Security:
 * - x-sync-key header required (validated against SYNC_SPORTS_KEY secret)
 * - Hard domain allowlist
 * - All DB writes via SERVICE_ROLE (bypasses RLS)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// ============================================================================
// CONSTANTS
// ============================================================================

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-sync-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_DOMAINS = new Set([
  "malagacf.com",
  "unicajabaloncesto.com",
  "ironman.com",
  "koobin.com",
  "entradas.com",
  "maratonmalaga.com",
  "zurichmaratonmalaga.es",
  "mundodeportivo.com",
  "sportmaniacs.com",
  "rfef.es",
  "besoccer.com",
  "rfaf.es",
  "rfebm.com",
  "atletismomalaga.com",
  "triatlondemalaga.com",
  "fam.es",
  "juntadeandalucia.es",
  // Phase 3 additions
  "imd.malaga.eu",
  "malaga.eu",
  "malaga.es",
  "runedia.com",
]);

const COOLDOWN_MINUTES = 15;

const SPORT_EVENT_SCHEMA = {
  type: "object",
  properties: {
    events: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          date: { type: "string", description: "ISO 8601 or dd/mm/yyyy" },
          time: { type: "string", description: "HH:MM format" },
          end_time: { type: "string" },
          venue: { type: "string" },
          city: { type: "string" },
          teams: { type: "string" },
          competition: { type: "string" },
          sport: { type: "string" },
          tickets_url: { type: "string" },
          image_url: { type: "string" },
          price_info: { type: "string" },
        },
        required: ["title", "date"],
      },
    },
  },
  required: ["events"],
};

// Source-specific extraction prompts
const SOURCE_PROMPTS: Record<string, string> = {
  malagacf:
    "Extract all upcoming football matches for Málaga CF from the calendar/schedule page. Include match title, date (YYYY-MM-DD format), time (HH:MM), opponent, competition name (e.g. LaLiga, Copa del Rey), venue, and ticket URL if available. Only include future matches.",
  unicaja:
    "Extract all upcoming basketball games for Unicaja Baloncesto from the calendar page. Include game title, date (YYYY-MM-DD), time (HH:MM), opponent teams, competition/league name (e.g. Liga Endesa, EuroCup), venue, and ticket URL.",
  ironman:
    "Extract upcoming triathlon and endurance events in Málaga or Andalucía. Include event title, date (YYYY-MM-DD), venue, city, registration URL.",
  "malagacf-koobin":
    "Extract all upcoming Malaga CF football match tickets available for sale. Include match title, date (YYYY-MM-DD), time (HH:MM), opponent, price info, buy URL.",
  "entradas-com":
    "Extract upcoming sports events in Malaga province. Include title, date (YYYY-MM-DD), time, venue, sport type, teams, ticket URL, price.",
  "maraton-malaga":
    "Extract upcoming marathon and running events in Malaga. Include event title, date (YYYY-MM-DD), time, start location, registration URL, distance.",
  "zurich-maraton":
    "Extract upcoming Zurich Marathon Malaga race details. Include event title, date (YYYY-MM-DD), time, start location, distances, registration URL.",
  runedia:
    "Extract all upcoming running races and trail events listed for Málaga province. Include race title, date (YYYY-MM-DD), location/city, distance, registration URL. List ALL events visible on the page.",
  sportmaniacs:
    "Extract all upcoming sports events listed for Málaga province. Include event title, date (YYYY-MM-DD), location/city, sport type, registration URL. List every event visible.",
  "rfef-tickets":
    "Extract upcoming Spanish football federation match tickets. Include match title, date (YYYY-MM-DD), time, teams, competition, venue, ticket URL.",
  "besoccer-malaga":
    "Extract upcoming Málaga CF football matches from the calendar. Include match title, date (YYYY-MM-DD), time (HH:MM), teams, competition, venue.",
  rfaf:
    "Extract upcoming football matches and events in Málaga province. Include title, date (YYYY-MM-DD), time, teams, competition, venue, city.",
  "rfaf-malaga":
    "Extract upcoming football matches in Málaga province from the federation calendar. Include title, date (YYYY-MM-DD), time (HH:MM), teams, competition, venue, city.",
  rfebm:
    "Extract upcoming handball matches in Málaga. Include title, date (YYYY-MM-DD), time, teams, competition, venue.",
  atletismo:
    "Extract upcoming running races and athletics events in Málaga province. Include event title, date (YYYY-MM-DD), time, venue/location, city, registration URL.",
  "atletismo-malaga":
    "Extract all upcoming athletics events and races from the Málaga athletics calendar. Include event title, date (YYYY-MM-DD), time, venue/location, city, distance, registration URL. List ALL visible events.",
  triatlon:
    "Extract upcoming triathlon events in Málaga. Include title, date (YYYY-MM-DD), time, venue, city, registration URL.",
  "triatlon-malaga":
    "Extract all upcoming triathlon events from the Málaga triathlon calendar. Include title, date (YYYY-MM-DD), time, venue, city, registration URL.",
  fam:
    "Extract upcoming athletics events and competitions in Málaga from the Andalusian Athletics Federation. Include title, date (YYYY-MM-DD), time, venue, city.",
  "fam-atletismo":
    "Extract all upcoming athletics competitions and events from the FAM calendar. Include event title, date (YYYY-MM-DD), time, venue, city, and registration URL if available. List ALL visible events.",
  junta:
    "Extract upcoming sports events in Málaga province from Junta de Andalucía. Include title, date (YYYY-MM-DD), time, venue, city, sport type.",
  "imd-malaga":
    "Extract all upcoming sports activities, competitions, and events from the IMD Málaga (Instituto Municipal de Deportes) page. Include title, date (YYYY-MM-DD), time, venue, city, sport type, registration URL. List ALL visible activities.",
  "koobin-deportes":
    "Extract all upcoming sports events and ticket listings for Málaga. Include event title, date (YYYY-MM-DD), time, venue, sport type, teams, ticket URL, price.",
  "diputacion-deportes":
    "Extract all upcoming sports events from Diputación de Málaga. Include event title, date (YYYY-MM-DD), time, venue, city, sport type.",
};

const DEFAULT_PROMPT =
  "Extract all upcoming sports events. Include title, date, time, venue, city, teams, competition, sport type, and ticket/registration URL if available.";

// ============================================================================
// MÁLAGA PROVINCE MUNICIPALITIES (complete whitelist, normalized)
// ============================================================================

const MALAGA_PROVINCE_MUNICIPALITIES: Set<string> = new Set([
  "malaga", "marbella", "mijas", "fuengirola", "torremolinos", "benalmadena",
  "estepona", "velez-malaga", "velez malaga", "rincon de la victoria",
  "antequera", "ronda", "alhaurin de la torre", "alhaurin el grande",
  "coin", "cartama", "nerja", "torre del mar", "torrox", "alora",
  "archidona", "campillos", "manilva", "casares", "ojen", "benahavis",
  "istan", "tolox", "yunquera", "el burgo", "ardales", "carratraca",
  "teba", "cuevas de san marcos", "villanueva de algaidas",
  "villanueva del rosario", "villanueva del trabuco", "villanueva de tapia",
  "alameda", "humilladero", "mollina", "fuente de piedra",
  "sierra de yeguas", "cuevas bajas", "algarrobo", "sayalonga",
  "canillas de aceituno", "canillas de albaida", "sedella", "salares",
  "archez", "competa", "frigiliana", "cortes de la frontera",
  "benaojan", "montejaque", "jimera de libar", "atajate", "benadalid",
  "benalauría", "benalauria", "gaucin", "algatocin", "jubrique",
  "genalguacil", "parauta", "igualeja", "pujerra", "juzcar",
  "farajan", "alpandeire", "cartajima", "arriate", "cuevas del becerro",
  "el gastor", "setenil de las bodegas",
  "colmenar", "comares", "cutar", "el borge", "benamargosa",
  "benamocarra", "iznate", "macharaviaya", "moclinejo",
  "almogía", "almogia", "casabermeja", "villanueva de la concepcion",
  "villanueva de la concepción",
  "pizarra", "alozaina", "guaro", "monda", "el chorro",
  "valle de abdalajis", "bobadilla",
  "cañete la real", "canete la real", "almargen", "cañete", "canete",
  "periana", "riogordo", "alfarnate", "alfarnatejo",
  "totalán", "totalan", "olias",
  "churriana", "guadalhorce", "teatinos", "campanillas",
  "puerto de la torre", "el palo", "pedregalejo", "huelin",
  "la malagueta", "la rosaleda",
  "torremolinos", "arroyo de la miel",
  "san pedro de alcantara", "san pedro alcantara", "nueva andalucia",
  "puerto banus", "las lagunas", "la cala de mijas", "cala de mijas",
  "calahonda", "riviera del sol", "la cala del moral",
  "benagalbon", "chilches", "benajarafe", "almayate", "cajiz",
  "lake district of malaga", "el torcal",
  "manilva", "sabinillas", "san luis de sabinillas",
  "cancelada", "bahia de casares",
  "cártama", "estacion de cartama",
  "pechina",
  // Major venue/area tokens
  "costa del sol", "axarquia", "axarquía", "serranía de ronda", "serrania de ronda",
  "guadalteba", "nororma", "valle del guadalhorce", "antequera",
]);

// Sources whose events are guaranteed Málaga-local
const LOCAL_ONLY_SOURCES = new Set([
  "maraton-malaga", "zurich-maraton", "atletismo", "triatlon",
  "atletismo-malaga", "triatlon-malaga", "imd-malaga", "diputacion-deportes",
]);

// Home venue tokens for team-based sources (only keep home matches)
const HOME_VENUE_RULES: Record<string, Set<string>> = {
  malagacf: new Set(["la rosaleda", "rosaleda", "malaga cf", "estadio la rosaleda"]),
  "malagacf-koobin": new Set(["la rosaleda", "rosaleda", "malaga cf", "estadio la rosaleda"]),
  unicaja: new Set(["martin carpena", "martín carpena", "palacio de deportes", "j.m. martin carpena", "carpena"]),
};

// ============================================================================
// HELPERS
// ============================================================================

function normalizeText(text: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isDomainAllowed(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    for (const domain of ALLOWED_DOMAINS) {
      if (hostname === domain || hostname.endsWith("." + domain)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

function getSourcePrompt(slug: string): string {
  return SOURCE_PROMPTS[slug] || DEFAULT_PROMPT;
}

/** Check if a city/venue/address is in Málaga province */
function isInMalagaProvince(
  city: string,
  venueName: string,
  address: string,
  sourceSlug: string
): boolean {
  // Sources guaranteed to be Málaga-local
  if (LOCAL_ONLY_SOURCES.has(sourceSlug)) return true;

  // Home venue rules for team sources (only home matches)
  const homeVenues = HOME_VENUE_RULES[sourceSlug];
  if (homeVenues) {
    const nVenue = normalizeText(venueName);
    for (const token of homeVenues) {
      if (nVenue.includes(token)) return true;
    }
    // If it's a team source and venue doesn't match home → away match → discard
    return false;
  }

  // General municipality check
  const textsToCheck = [city, venueName, address].filter(Boolean);
  for (const text of textsToCheck) {
    const normalized = normalizeText(text);
    // Direct municipality match
    for (const muni of MALAGA_PROVINCE_MUNICIPALITIES) {
      if (normalized.includes(muni)) return true;
    }
    // Check for "malaga" token (covers "Málaga", "Malaga", etc.)
    if (normalized.includes("malaga")) return true;
  }

  return false;
}

/** Derive start_date string (YYYY-MM-DD) in Europe/Madrid timezone */
function toMadridDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) throw new Error("Invalid date");
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Madrid",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return fmt.format(d);
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/** Parse date string from scraped data into ISO 8601 */
function parseEventDate(dateStr: string, timeStr?: string): string | null {
  if (!dateStr) return null;

  const isoMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const time = timeStr?.match(/(\d{2}):(\d{2})/);
    const hour = time ? time[1] : "12";
    const min = time ? time[2] : "00";
    return `${isoMatch[0]}T${hour}:${min}:00+01:00`;
  }

  const euroMatch = dateStr.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  if (euroMatch) {
    const day = euroMatch[1].padStart(2, "0");
    const month = euroMatch[2].padStart(2, "0");
    const year = euroMatch[3];
    const time = timeStr?.match(/(\d{2}):(\d{2})/);
    const hour = time ? time[1] : "12";
    const min = time ? time[2] : "00";
    return `${year}-${month}-${day}T${hour}:${min}:00+01:00`;
  }

  return null;
}

/** Generate SHA-256 dedupe key */
async function generateDedupeKey(
  normalizedTitle: string,
  normalizedVenue: string,
  startDatetime: string,
  sportCategory: string,
  domain: string,
  stableRef: string
): Promise<string> {
  const input = [
    normalizedTitle, normalizedVenue, startDatetime,
    sportCategory, domain, stableRef,
  ].join("|");

  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function mapSportCategory(sport: string): string {
  if (!sport) return "otros";
  const s = sport.toLowerCase();
  if (/f[uú]tbol\s*sala|futsal/i.test(s)) return "futsal";
  if (/f[uú]tbol|football|soccer/i.test(s)) return "futbol";
  if (/baloncesto|basketball|basket/i.test(s)) return "baloncesto";
  if (/balonmano|handball/i.test(s)) return "balonmano";
  if (/atletismo|running|marat[oó]n|carrera|cross/i.test(s)) return "atletismo";
  if (/motor|rally|karting|f1|motogp/i.test(s)) return "motor";
  if (/tenis|tennis|p[aá]del|padel/i.test(s)) return "tenis";
  if (/triatl[oó]n|triathlon|ironman/i.test(s)) return "atletismo";
  return "otros";
}

function sanitizeText(text: string | null | undefined): string {
  if (!text) return "";
  return String(text)
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeUrl(url: string | null | undefined): string {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return "";
    return parsed.href;
  } catch {
    return "";
  }
}

// ============================================================================
// FIRECRAWL SCRAPING & SEARCH
// ============================================================================

async function scrapeSource(
  url: string,
  prompt: string,
  apiKey: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["json", "markdown"],
        jsonOptions: {
          schema: SPORT_EVENT_SCHEMA,
          prompt,
        },
        onlyMainContent: true,
        waitFor: 3000,
        timeout: 30000,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText.substring(0, 200)}`,
      };
    }

    const result = await response.json();
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return { success: false, error: "Request timeout (45s)" };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Use Firecrawl Search API to find sports events via web search */
async function searchSportsEvents(
  query: string,
  apiKey: string,
  limit: number = 10
): Promise<{ success: boolean; results?: any[]; error?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        limit,
        lang: "es",
        country: "es",
        scrapeOptions: {
          formats: ["json"],
          jsonOptions: {
            schema: SPORT_EVENT_SCHEMA,
            prompt: `Extract ALL sports events from this page. For each event: title, date (YYYY-MM-DD), time (HH:MM), venue, city, sport type, teams, competition, tickets_url. Only events in Málaga province, Spain. Current date: ${new Date().toISOString().slice(0, 10)}.`,
          },
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `HTTP ${response.status}: ${errorText.substring(0, 200)}` };
    }

    const result = await response.json();
    return { success: true, results: result?.data || [] };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return { success: false, error: "Search timeout (30s)" };
    }
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

// Search queries for discovering sports events in Málaga
const SEARCH_QUERIES = [
  "eventos deportivos Málaga 2026 calendario",
  "carreras populares Málaga provincia 2026",
  "partidos fútbol Málaga febrero marzo 2026",
  "Unicaja baloncesto próximos partidos 2026",
  "triatlón atletismo Málaga Costa del Sol 2026",
  "padel tenis torneos Málaga 2026",
  "ciclismo running trail Málaga 2026",
  "natación waterpolo balonmano Málaga 2026",
];

// ============================================================================
// MAIN HANDLER
// ============================================================================

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  // Auth: ONLY x-sync-key header (used by cron AND admin-sync-sports)
  const syncKey = req.headers.get("x-sync-key");
  const expectedKey = Deno.env.get("SYNC_SPORTS_KEY");

  if (!expectedKey || syncKey !== expectedKey) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  const firecrawlApiKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (!firecrawlApiKey) {
    return new Response(
      JSON.stringify({ error: "FIRECRAWL_API_KEY not configured" }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  // Parse body
  let body: { slug?: string; force?: boolean; cooldownMinutes?: number; searchOnly?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine — sync all
  }

  const cooldownMin = body.cooldownMinutes ?? COOLDOWN_MINUTES;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Fetch active sources
  let sourcesQuery = supabase
    .from("sports_sources")
    .select("*")
    .eq("is_active", true);

  if (body.slug) {
    sourcesQuery = sourcesQuery.eq("slug", body.slug);
  }

  const { data: sources, error: sourcesError } = await sourcesQuery;
  if (sourcesError || !sources?.length) {
    return new Response(
      JSON.stringify({
        error: sourcesError?.message || "No active sources found",
      }),
      { status: 404, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  const results: Array<{
    slug: string;
    status: string;
    fetched: number;
    upserted: number;
    failed: number;
    skippedProvince: number;
    error?: string;
  }> = [];

  for (const source of sources) {
    // Domain check
    if (!isDomainAllowed(source.url)) {
      results.push({
        slug: source.slug,
        status: "skipped",
        fetched: 0, upserted: 0, failed: 0, skippedProvince: 0,
        error: "Domain not in allowlist",
      });
      continue;
    }

    // Cooldown check
    if (!body.force && source.last_sync_at) {
      const lastSync = new Date(source.last_sync_at).getTime();
      const cooldownMs = cooldownMin * 60 * 1000;
      if (Date.now() - lastSync < cooldownMs) {
        results.push({
          slug: source.slug,
          status: "cooldown",
          fetched: 0, upserted: 0, failed: 0, skippedProvince: 0,
          error: `Synced ${Math.round((Date.now() - lastSync) / 60000)}min ago`,
        });
        continue;
      }
    }

    // Create sync run
    const { data: runData } = await supabase
      .from("sports_sync_runs")
      .insert({ source_slug: source.slug, status: "running" })
      .select("id")
      .single();

    const runId = runData?.id;
    const prompt = getSourcePrompt(source.slug);

    console.log(`[sync-sports] Scraping ${source.slug}: ${source.url}`);

    const scrapeResult = await scrapeSource(source.url, prompt, firecrawlApiKey);

    if (!scrapeResult.success) {
      console.error(`[sync-sports] Scrape failed for ${source.slug}: ${scrapeResult.error}`);

      if (runId) {
        await supabase
          .from("sports_sync_runs")
          .update({
            status: "error",
            finished_at: new Date().toISOString(),
            error_sample: scrapeResult.error?.substring(0, 500),
          })
          .eq("id", runId);
      }

      await supabase
        .from("sports_sources")
        .update({
          last_error: scrapeResult.error?.substring(0, 500),
          last_sync_at: new Date().toISOString(),
        })
        .eq("id", source.id);

      results.push({
        slug: source.slug,
        status: "error",
        fetched: 0, upserted: 0, failed: 0, skippedProvince: 0,
        error: scrapeResult.error,
      });
      continue;
    }

    // Extract events from response
    const rawEvents =
      scrapeResult.data?.data?.json?.events ||
      scrapeResult.data?.data?.events ||
      scrapeResult.data?.json?.events ||
      [];

    // Log extraction details for debugging
    const hasMarkdown = !!(scrapeResult.data?.data?.markdown || scrapeResult.data?.markdown);
    const markdownLength = (scrapeResult.data?.data?.markdown || scrapeResult.data?.markdown || "").length;
    console.log(`[sync-sports] ${source.slug}: extracted ${rawEvents.length} events from JSON, markdown=${hasMarkdown} (${markdownLength} chars)`);

    let upserted = 0;
    let failed = 0;
    let skippedProvince = 0;
    const domain = new URL(source.url).hostname;

    const BATCH_SIZE = 50;
    const rows: any[] = [];

    for (const evt of rawEvents) {
      try {
        const title = sanitizeText(evt.title);
        if (!title || title.length < 3) continue;

        const startDatetime = parseEventDate(evt.date, evt.time);
        if (!startDatetime) continue;

        const normalizedTitle = normalizeText(title);
        const venue = sanitizeText(evt.venue) || source.name;
        const normalizedVenue = normalizeText(venue);
        const city = sanitizeText(evt.city) || "Málaga";
        const address = sanitizeText(evt.address || "");
        const sportCategory = mapSportCategory(evt.sport || source.sport_category);
        const stableRef = evt.tickets_url || evt.title || "";

        // Málaga province filter
        const inMalaga = isInMalagaProvince(city, venue, address, source.slug);
        if (!inMalaga) {
          skippedProvince++;
          console.log(`[sync-sports] Skipped (not Málaga): "${title}" venue="${venue}" city="${city}"`);
          continue;
        }

        const dedupeKey = await generateDedupeKey(
          normalizedTitle, normalizedVenue, startDatetime,
          sportCategory, domain, stableRef
        );

        const startDate = toMadridDate(startDatetime);

        rows.push({
          dedupe_key: dedupeKey,
          title,
          normalized_title: normalizedTitle,
          sport_category: sportCategory,
          competition: sanitizeText(evt.competition) || null,
          teams: sanitizeText(evt.teams) || null,
          start_datetime: startDatetime,
          start_date: startDate,
          venue_name: venue,
          normalized_venue: normalizedVenue,
          city,
          tickets_url: sanitizeUrl(evt.tickets_url) || null,
          image_url: sanitizeUrl(evt.image_url) || null,
          price_info: sanitizeText(evt.price_info) || null,
          source_id: source.id,
          source_url: source.url,
          status: "scheduled",
          is_in_malaga_province: true,
        });
      } catch (e) {
        failed++;
        console.warn(`[sync-sports] Failed to process event: ${e}`);
      }
    }

    // Upsert in batches
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const { error: upsertError } = await supabase
        .from("sports_events")
        .upsert(batch, { onConflict: "dedupe_key", ignoreDuplicates: false })
        .select("id");

      if (upsertError) {
        console.error(`[sync-sports] Upsert error: ${upsertError.message}`);
        failed += batch.length;
      } else {
        upserted += batch.length;
      }
    }

    // Update sync run
    if (runId) {
      await supabase
        .from("sports_sync_runs")
        .update({
          status: "done",
          finished_at: new Date().toISOString(),
          items_fetched: rawEvents.length,
          items_parsed: rows.length,
          items_upserted: upserted,
          items_failed: failed,
        })
        .eq("id", runId);
    }

    // Update source
    await supabase
      .from("sports_sources")
      .update({
        last_sync_at: new Date().toISOString(),
        last_error: null,
        items_fetched: rawEvents.length,
        items_upserted: upserted,
      })
      .eq("id", source.id);

    results.push({
      slug: source.slug,
      status: "done",
      fetched: rawEvents.length,
      upserted,
      failed,
      skippedProvince,
    });

    // Delay between sources
    if (sources.indexOf(source) < sources.length - 1) {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  // ========================================================================
  // PHASE 2: SEARCH-BASED DISCOVERY (runs after per-source scraping)
  // ========================================================================
  // When searchOnly=true, skip scraping and only do search.
  // Otherwise, search runs after scraping when no slug filter is set.
  const shouldSearch = body.searchOnly || (!body.slug);
  
  if (shouldSearch) {
    console.log(`[sync-sports] Starting search-based discovery (${SEARCH_QUERIES.length} queries)...`);
    
    const { data: searchRunData } = await supabase
      .from("sports_sync_runs")
      .insert({ source_slug: "search-discovery", status: "running" })
      .select("id")
      .single();
    const searchRunId = searchRunData?.id;

    let searchUpserted = 0;
    let searchFailed = 0;
    let searchFetched = 0;
    let searchSkippedProvince = 0;

    for (const query of SEARCH_QUERIES) {
      console.log(`[sync-sports] Searching: "${query}"`);
      const searchResult = await searchSportsEvents(query, firecrawlApiKey, 5);
      
      if (!searchResult.success) {
        console.warn(`[sync-sports] Search failed for "${query}": ${searchResult.error}`);
        continue;
      }

      // Each search result page may contain events
      for (const page of (searchResult.results || [])) {
        const pageEvents = page?.json?.events || page?.data?.json?.events || [];
        searchFetched += pageEvents.length;
        
        for (const evt of pageEvents) {
          try {
            const title = sanitizeText(evt.title);
            if (!title || title.length < 3) continue;

            const startDatetime = parseEventDate(evt.date, evt.time);
            if (!startDatetime) continue;

            // Skip past events
            const evtDate = new Date(startDatetime);
            if (evtDate < new Date(Date.now() - 24 * 60 * 60 * 1000)) continue;

            const normalizedTitle = normalizeText(title);
            const venue = sanitizeText(evt.venue) || "Málaga";
            const normalizedVenue = normalizeText(venue);
            const city = sanitizeText(evt.city) || "Málaga";
            const sportCategory = mapSportCategory(evt.sport || "otros");

            // Province filter
            if (!isInMalagaProvince(city, venue, "", "search-discovery")) {
              searchSkippedProvince++;
              continue;
            }

            const dedupeKey = await generateDedupeKey(
              normalizedTitle, normalizedVenue, startDatetime,
              sportCategory, "search", evt.tickets_url || evt.title || ""
            );

            const row = {
              dedupe_key: dedupeKey,
              title,
              normalized_title: normalizedTitle,
              sport_category: sportCategory,
              competition: sanitizeText(evt.competition) || null,
              teams: sanitizeText(evt.teams) || null,
              start_datetime: startDatetime,
              start_date: toMadridDate(startDatetime),
              venue_name: venue,
              normalized_venue: normalizedVenue,
              city,
              tickets_url: sanitizeUrl(evt.tickets_url) || null,
              image_url: sanitizeUrl(evt.image_url) || null,
              price_info: sanitizeText(evt.price_info) || null,
              source_url: page?.url || null,
              status: "scheduled",
              is_in_malaga_province: true,
            };

            const { error: upsertErr } = await supabase
              .from("sports_events")
              .upsert(row, { onConflict: "dedupe_key", ignoreDuplicates: false });

            if (upsertErr) {
              searchFailed++;
              console.warn(`[sync-sports] Search upsert error: ${upsertErr.message}`);
            } else {
              searchUpserted++;
            }
          } catch (e) {
            searchFailed++;
          }
        }
      }

      // Small delay between search queries
      await new Promise((r) => setTimeout(r, 1000));
    }

    if (searchRunId) {
      await supabase
        .from("sports_sync_runs")
        .update({
          status: "done",
          finished_at: new Date().toISOString(),
          items_fetched: searchFetched,
          items_parsed: searchFetched,
          items_upserted: searchUpserted,
          items_failed: searchFailed,
        })
        .eq("id", searchRunId);
    }

    results.push({
      slug: "search-discovery",
      status: "done",
      fetched: searchFetched,
      upserted: searchUpserted,
      failed: searchFailed,
      skippedProvince: searchSkippedProvince,
    });

    console.log(`[sync-sports] Search discovery: fetched=${searchFetched} upserted=${searchUpserted} failed=${searchFailed} skipped=${searchSkippedProvince}`);
  }

  console.log(`[sync-sports] Complete. Results:`, JSON.stringify(results));

  return new Response(
    JSON.stringify({ success: true, results }),
    { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
  );
});

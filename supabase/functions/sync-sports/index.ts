/**
 * sync-sports Edge Function
 * Scrapes sports event data from approved sources using Firecrawl v1/scrape
 * and upserts into sports_events table.
 *
 * Security:
 * - x-admin-key header required (validated against SYNC_ADMIN_KEY secret)
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
    "authorization, x-client-info, apikey, content-type, x-admin-key",
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
  // Legacy domains kept for future sources
  "besoccer.com",
  "rfaf.es",
  "rfebm.com",
  "atletismomalaga.com",
  "triatlondemalaga.com",
  "fam.es",
  "juntadeandalucia.es",
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
    "Extract all upcoming football matches for Málaga CF. Include match title, date, time, opponent, competition name, venue, and ticket URL if available.",
  unicaja:
    "Extract all upcoming basketball games for Unicaja Baloncesto. Include game title, date, time, opponent teams, competition/league name, venue, and ticket URL.",
  ironman:
    "Extract upcoming triathlon and endurance events in Málaga or Andalucía. Include event title, date, venue, city, registration URL.",
  "malagacf-koobin":
    "Extract upcoming Malaga CF football match tickets. Include match title, date, time, opponent, price, buy URL.",
  "entradas-com":
    "Extract upcoming sports events in Malaga province. Include title, date, time, venue, sport type, teams, ticket URL, price.",
  "maraton-malaga":
    "Extract upcoming marathon and running events in Malaga. Include event title, date, time, start location, registration URL, distance.",
  "zurich-maraton":
    "Extract upcoming Zurich Marathon Malaga race details. Include event title, date, time, start location, distances, registration URL.",
  runedia:
    "Extract upcoming running races and trail events near Malaga, Andalucia. Include race title, date, location/city, distance, registration URL.",
  sportmaniacs:
    "Extract upcoming sports and running events near Malaga. Include event title, date, location, sport type, registration URL.",
  "rfef-tickets":
    "Extract upcoming Spanish football federation match tickets. Include match title, date, time, teams, competition, venue, ticket URL.",
  // Legacy prompts
  besoccer:
    "Extract upcoming futsal matches. Include match title, date, time, teams, competition, venue.",
  rfaf:
    "Extract upcoming football matches and events in Málaga province. Include title, date, time, teams, competition, venue, city.",
  rfebm:
    "Extract upcoming handball matches in Málaga. Include title, date, time, teams, competition, venue.",
  atletismo:
    "Extract upcoming running races and athletics events in Málaga province. Include event title, date, time, venue/location, city, registration URL.",
  triatlon:
    "Extract upcoming triathlon events in Málaga. Include title, date, time, venue, city, registration URL.",
  fam:
    "Extract upcoming athletics events and competitions in Málaga from the Andalusian Athletics Federation. Include title, date, time, venue, city.",
  junta:
    "Extract upcoming sports events in Málaga province from Junta de Andalucía. Include title, date, time, venue, city, sport type.",
};

const DEFAULT_PROMPT =
  "Extract all upcoming sports events. Include title, date, time, venue, city, teams, competition, sport type, and ticket/registration URL if available.";

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
    return fmt.format(d); // returns YYYY-MM-DD
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/** Parse date string from scraped data into ISO 8601 */
function parseEventDate(dateStr: string, timeStr?: string): string | null {
  if (!dateStr) return null;

  // Try ISO format first
  const isoMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const time = timeStr?.match(/(\d{2}):(\d{2})/);
    const hour = time ? time[1] : "12";
    const min = time ? time[2] : "00";
    return `${isoMatch[0]}T${hour}:${min}:00+01:00`;
  }

  // Try dd/mm/yyyy or dd-mm-yyyy
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
    normalizedTitle,
    normalizedVenue,
    startDatetime,
    sportCategory,
    domain,
    stableRef,
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
// FIRECRAWL SCRAPING (same pattern as sync-events)
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
        formats: ["json"],
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

  // Auth: x-admin-key
  const adminKey = req.headers.get("x-admin-key");
  const expectedKey = Deno.env.get("SYNC_ADMIN_KEY");
  if (!expectedKey || adminKey !== expectedKey) {
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
  let body: { slug?: string; force?: boolean; cooldownMinutes?: number } = {};
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
    error?: string;
  }> = [];

  for (const source of sources) {
    // Domain check
    if (!isDomainAllowed(source.url)) {
      results.push({
        slug: source.slug,
        status: "skipped",
        fetched: 0,
        upserted: 0,
        failed: 0,
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
          fetched: 0,
          upserted: 0,
          failed: 0,
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
        fetched: 0,
        upserted: 0,
        failed: 0,
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

    let upserted = 0;
    let failed = 0;
    const domain = new URL(source.url).hostname;

    // Batch upsert
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
        const sportCategory = mapSportCategory(evt.sport || source.sport_category);
        const stableRef = evt.tickets_url || evt.title || "";

        const dedupeKey = await generateDedupeKey(
          normalizedTitle,
          normalizedVenue,
          startDatetime,
          sportCategory,
          domain,
          stableRef
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
        });
      } catch (e) {
        failed++;
        console.warn(`[sync-sports] Failed to process event: ${e}`);
      }
    }

    // Upsert in batches
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const { error: upsertError, count } = await supabase
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
    });

    // Delay between sources
    if (sources.indexOf(source) < sources.length - 1) {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  console.log(`[sync-sports] Complete. Results:`, JSON.stringify(results));

  return new Response(
    JSON.stringify({ success: true, results }),
    { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
  );
});

// admin-ingest-preflight (Phase 3E-2A):
// Authenticated admin action that computes the write-diff for ONE source
// WITHOUT ever inserting/updating/deleting anything in public.events and
// without ever activating the source. Always dryRun.
//
// Contract:
//   POST { sourceId: uuid }  (admin JWT required)
//   -> {
//        ok, sourceId, sourceName, adapter,
//        totalFetched, wouldInsert, wouldUpdate, wouldSkip, conflicts,
//        warnings[], generatedAt, dryRun: true, preview[]
//      }
//
// Security notes:
//  - Requires Authorization: Bearer <user JWT>, then validates admin via has_role.
//  - service_role stays server-side and is never echoed back.
//  - SYNC_ADMIN_KEY is NOT used (we do not call scrape-source at all).
//  - Never mutates public.events or event_sources.
//  - Optionally logs a diagnostic row in event_source_runs with dryRun=true.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import type {
  CanonicalEvent,
  EventSourceRow,
} from "../_shared/ingestion/types.ts";
import { getAdapter } from "../_shared/ingestion/adapters.ts";
import { generateEventDedupeKey } from "../_shared/ingestion/dedupe.ts";
import {
  normalizeTitle,
  normalizeVenueName,
  stableHash,
} from "../_shared/ingestion/normalize.ts";
import { parseSpanishDateToMadrid } from "../_shared/ingestion/dates.ts";
import { resolveVenueAlias } from "../_shared/ingestion/venues.ts";
import { resolveLocalityAlias } from "../_shared/ingestion/localities.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_PREVIEW = 50;

// deno-lint-ignore no-explicit-any
type Deps = any;

type PreflightAction = "insert" | "update" | "skip" | "conflict";

type PreviewItem = {
  action: PreflightAction;
  title: string | null;
  startAt: string | null;
  venueName: string | null;
  canonicalVenue: string | null;
  locality: string | null;
  category: string | null;
  sourceUrl: string | null;
  ticketUrl: string | null;
  imageUrl: string | null;
  existingEventId: string | null;
  existingDedupeKey: string | null;
  newDedupeKey: string;
  reason: string;
  raw: {
    timeAssumed: boolean;
    dateLine: string | null;
    cycleText: string | null;
  };
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function truncStr(v: unknown, max = 300): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) + "…" : s;
}
function truncUrl(v: unknown): string | null {
  const s = truncStr(v, 500);
  if (!s) return null;
  return /^https?:\/\//i.test(s) ? s : null;
}

function isValidCanonical(ev: CanonicalEvent): boolean {
  if (!ev.title || !ev.title.trim()) return false;
  if (!ev.sourceUrl || !ev.sourceUrl.trim()) return false;
  if (!ev.locality || !ev.locality.trim()) return false;
  if (ev.timezone !== "Europe/Madrid") return false;
  if (!parseSpanishDateToMadrid(ev.startAt)) return false;
  return true;
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function generatePlaintextToken(): string {
  // 32 random bytes as hex — 256 bits of entropy, plus a uuid prefix for readability.
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${crypto.randomUUID()}.${hex}`;
}

async function findExisting(
  supabase: Deps,
  ev: CanonicalEvent,
  canonicalVenue: string | null,
  dedupeKey: string,
): Promise<{ id: string; content_hash: string | null; dedupe_key: string | null } | null> {
  const { data: primary } = await supabase
    .from("events")
    .select("id, content_hash, dedupe_key")
    .eq("dedupe_key", dedupeKey)
    .maybeSingle();
  if (primary) return primary as { id: string; content_hash: string | null; dedupe_key: string | null };

  const titleNorm = normalizeTitle(ev.title);
  const venueNorm = normalizeVenueName(canonicalVenue ?? ev.venueName ?? "");
  const startMs = new Date(ev.startAt).getTime();
  if (!isFinite(startMs) || !titleNorm) return null;
  const lo = new Date(startMs - 5 * 60_000).toISOString();
  const hi = new Date(startMs + 5 * 60_000).toISOString();

  const { data: legacy } = await supabase
    .from("events")
    .select("id, content_hash, dedupe_key")
    .eq("title_normalized", titleNorm)
    .eq("venue_name_normalized", venueNorm)
    .gte("start_at", lo)
    .lte("start_at", hi)
    .limit(1)
    .maybeSingle();
  return (legacy as { id: string; content_hash: string | null; dedupe_key: string | null } | null) ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json({ error: "server_misconfig" }, 500);
  }

  // 1. authn
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data: userData, error: userErr } = await userClient.auth.getUser(token);
  if (userErr || !userData?.user) return json({ error: "invalid_token" }, 401);
  const adminUserId = userData.user.id;

  // 2. authz: admin only
  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: hasAdmin, error: roleErr } = await adminClient.rpc("has_role", {
    _user_id: adminUserId,
    _role: "admin",
  });
  if (roleErr || !hasAdmin) return json({ error: "forbidden" }, 403);

  // 3. input
  let body: { sourceId?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const sourceId = body?.sourceId;
  if (!sourceId || typeof sourceId !== "string" || !UUID_RE.test(sourceId)) {
    return json({ error: "sourceId_required" }, 400);
  }

  // 4. load source
  const { data: sourceRow, error: srcErr } = await adminClient
    .from("event_sources")
    .select("id, slug, name, kind, base_url, adapter_key, locality_slug, category_hints, priority, enabled, schedule_cron, robots_ok, notes, write_confirmed_at, write_confirmed_by")
    .eq("id", sourceId)
    .maybeSingle();
  if (srcErr || !sourceRow) return json({ error: "source_not_found" }, 404);
  const source = sourceRow as EventSourceRow;

  const adapter = getAdapter(source.adapter_key);
  if (!adapter) {
    return json({ error: "adapter_not_found", adapter_key: source.adapter_key }, 400);
  }

  // 5. optional run row for diagnostics (dryRun=true, phase=3E-2A-preflight)
  const startedAt = Date.now();
  let runId: string | null = null;
  {
    const { data: runIns } = await adminClient
      .from("event_source_runs")
      .insert({
        source_id: source.id,
        status: "running",
        inserted: 0,
        updated: 0,
        skipped_dupes: 0,
        errors: 0,
        meta: { dryRun: true, phase: "3E-2A-preflight" },
      })
      .select("id")
      .single();
    runId = (runIns as { id: string } | null)?.id ?? null;
  }

  const warnings: string[] = [];
  const preview: PreviewItem[] = [];
  let totalFetched = 0;
  let wouldInsert = 0;
  let wouldUpdate = 0;
  let wouldSkip = 0;
  let conflicts = 0;
  let errorsCount = 0;

  const logger = {
    info: (msg: string, extra?: Record<string, unknown>) =>
      console.log(JSON.stringify({ lvl: "info", src: source.slug, msg, ...extra })),
    warn: (msg: string, extra?: Record<string, unknown>) =>
      console.warn(JSON.stringify({ lvl: "warn", src: source.slug, msg, ...extra })),
    error: (msg: string, extra?: Record<string, unknown>) =>
      console.error(JSON.stringify({ lvl: "error", src: source.slug, msg, ...extra })),
  };

  let events: CanonicalEvent[] = [];
  try {
    events = await adapter.fetchEvents({ source, dryRun: true, logger });
  } catch (e) {
    errorsCount++;
    warnings.push(`fetch_failed: ${(e as Error).message}`.slice(0, 300));
  }
  totalFetched = events.length;

  // Track seen dedupe keys within this batch to flag internal conflicts.
  const seenKeys = new Set<string>();

  for (const ev of events) {
    if (!isValidCanonical(ev)) {
      errorsCount++;
      warnings.push(`invalid canonical: ${truncStr(ev.title) ?? "(sin título)"}`.slice(0, 300));
      continue;
    }

    let canonicalVenue: string | null = null;
    try {
      const v = await resolveVenueAlias(adminClient as never, ev.venueName);
      canonicalVenue = v.canonicalName;
      await resolveLocalityAlias(adminClient as never, ev.locality);
    } catch {
      // best-effort
    }

    let dedupeKey: string;
    try {
      dedupeKey = await generateEventDedupeKey(ev, canonicalVenue);
    } catch (e) {
      errorsCount++;
      warnings.push(`dedupe_key_failed: ${(e as Error).message}`.slice(0, 300));
      continue;
    }

    // Compute content_hash for parity with scrape-source (not returned raw).
    const contentHash = await stableHash(
      [ev.title, ev.description ?? "", ev.startAt, ev.venueName ?? "", ev.imageUrl ?? "", ev.ticketUrl ?? ""].join("|"),
    );

    let existing: { id: string; content_hash: string | null; dedupe_key: string | null } | null = null;
    try {
      existing = await findExisting(adminClient, ev, canonicalVenue, dedupeKey);
    } catch (e) {
      errorsCount++;
      warnings.push(`lookup_failed: ${(e as Error).message}`.slice(0, 200));
    }

    let action: PreflightAction;
    let reason: string;

    if (seenKeys.has(dedupeKey)) {
      action = "conflict";
      reason = "duplicate_within_batch";
      conflicts++;
    } else if (!existing) {
      action = "insert";
      reason = "no_match_in_events";
      wouldInsert++;
    } else if (existing.content_hash === contentHash && existing.dedupe_key === dedupeKey) {
      action = "skip";
      reason = "identical_content_and_key";
      wouldSkip++;
    } else if (existing.dedupe_key && existing.dedupe_key !== dedupeKey) {
      // legacy match (title/venue/±5min) with a different stored key
      action = "conflict";
      reason = "legacy_dedupe_key_mismatch";
      conflicts++;
    } else {
      action = "update";
      reason = existing.content_hash === contentHash
        ? "same_content_missing_key"
        : "content_changed";
      wouldUpdate++;
    }

    seenKeys.add(dedupeKey);

    const rawObj = (ev.raw && typeof ev.raw === "object")
      ? ev.raw as Record<string, unknown>
      : {};

    if (preview.length < MAX_PREVIEW) {
      preview.push({
        action,
        title: truncStr(ev.title),
        startAt: truncStr(ev.startAt),
        venueName: truncStr(ev.venueName),
        canonicalVenue: truncStr(canonicalVenue),
        locality: truncStr(ev.locality),
        category: truncStr(ev.category),
        sourceUrl: truncUrl(ev.sourceUrl),
        ticketUrl: truncUrl(ev.ticketUrl),
        imageUrl: truncUrl(ev.imageUrl),
        existingEventId: existing?.id ?? null,
        existingDedupeKey: existing?.dedupe_key ?? null,
        newDedupeKey: dedupeKey,
        reason,
        raw: {
          timeAssumed: rawObj["timeAssumed"] === true,
          dateLine: truncStr(rawObj["dateLine"]),
          cycleText: truncStr(rawObj["cycleText"]),
        },
      });
    }
  }

  // Finalize run row (never counts as inserted/updated — preflight is read-only).
  const durationMs = Date.now() - startedAt;
  const status = errorsCount === 0
    ? "success"
    : (totalFetched > 0 ? "partial" : "error");

  if (runId) {
    await adminClient
      .from("event_source_runs")
      .update({
        status,
        inserted: 0,
        updated: 0,
        skipped_dupes: 0,
        errors: errorsCount,
        duration_ms: durationMs,
        finished_at: new Date().toISOString(),
        meta: {
          dryRun: true,
          phase: "3E-2A-preflight",
          adapter: adapter.key,
          totalFetched,
          wouldInsert,
          wouldUpdate,
          wouldSkip,
          conflicts,
        },
      })
      .eq("id", runId);
  }

  return json({
    ok: true,
    dryRun: true as const,
    sourceId: source.id,
    sourceName: source.name,
    adapter: adapter.key,
    totalFetched,
    wouldInsert,
    wouldUpdate,
    wouldSkip,
    conflicts,
    warnings: warnings.slice(0, 50),
    generatedAt: new Date().toISOString(),
    preview,
  });
});

// Edge function: sync-sports-normalized
// Phase B: adapter routing for json/html/ics. Auth by SYNC_SPORTS_KEY.
//
// - Resolves source via public.sports_sources when body.slug is passed.
// - Routes by source_type: json → JSON feed adapter,
//   html → HTML + JSON-LD adapter (with optional ICS discovery),
//   ics → RFC 5545 ICS parser.
// - Upserts into public.sports_events using (source_name, external_id) or
//   fingerprint. Bumps missed_syncs; marks cancelled_or_unpublished at 3.
// - Empty-run safety: never deactivates events when the run yielded 0
//   parsed events (treated as no-data-this-run, not "everything cancelled").
// - Respects robots.txt when body.slug is used (checkRobots).
// - Logs run into public.sports_sync_runs with source_id + adapter + counters.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import type { CanonicalSportsEvent } from "../_shared/sports-sync/types.ts";
import { fetchJsonFeed } from "../_shared/sports-sync/adapters/json.ts";
import { computeFingerprint, computePayloadHash } from "../_shared/sports-sync/fingerprint.ts";
import { decideDeactivations } from "../_shared/sports-sync/upsert.ts";
import { runSourceAdapter } from "../_shared/sports-sync/adapters/sources.ts";
import { checkRobots } from "../_shared/sports-sync/robots.ts";

const MISSED_THRESHOLD = 3;


// deno-lint-ignore no-explicit-any
type SB = any;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

function checkAuth(req: Request): boolean {
  const expected = Deno.env.get("SYNC_SPORTS_KEY");
  const provided = req.headers.get("x-sync-key");
  return !!expected && !!provided && expected === provided;
}

async function loadExistingBySourceExternal(
  sb: SB, source_name: string, externalIds: string[],
): Promise<Map<string, { id: string; raw_payload_hash: string | null; status: string | null }>> {
  const map = new Map<string, { id: string; raw_payload_hash: string | null; status: string | null }>();
  if (externalIds.length === 0) return map;
  const { data } = await sb.from("sports_events")
    .select("id, external_id, raw_payload_hash, status")
    .eq("source_name", source_name)
    .in("external_id", externalIds);
  for (const r of (data ?? []) as Array<{ id: string; external_id: string; raw_payload_hash: string | null; status: string | null }>) {
    map.set(r.external_id, { id: r.id, raw_payload_hash: r.raw_payload_hash, status: r.status });
  }
  return map;
}

async function loadExistingByFingerprint(
  sb: SB, fingerprints: string[],
): Promise<Map<string, { id: string; raw_payload_hash: string | null; status: string | null }>> {
  const map = new Map<string, { id: string; raw_payload_hash: string | null; status: string | null }>();
  if (fingerprints.length === 0) return map;
  const { data } = await sb.from("sports_events")
    .select("id, fingerprint, raw_payload_hash, status")
    .in("fingerprint", fingerprints);
  for (const r of (data ?? []) as Array<{ id: string; fingerprint: string; raw_payload_hash: string | null; status: string | null }>) {
    map.set(r.fingerprint, { id: r.id, raw_payload_hash: r.raw_payload_hash, status: r.status });
  }
  return map;
}

function toRow(ev: CanonicalSportsEvent, hash: string, fingerprint: string, nowIso: string) {
  return {
    title: ev.title,
    sport_category: ev.sport_category,
    sport_subcategory: ev.sport_subcategory ?? null,
    start_datetime: ev.starts_at,
    end_datetime: ev.ends_at ?? null,
    start_date: ev.starts_at.slice(0, 10),
    venue_name: ev.venue_name,
    city: ev.municipality,
    address: ev.address ?? null,
    price_info: ev.price_amount != null
      ? `${ev.price_amount} ${ev.price_currency ?? "EUR"}`
      : null,
    tickets_url: ev.registration_url ?? null,
    registration_url: ev.registration_url ?? null,
    image_url: ev.image_url ?? null,
    source_url: ev.source_url,
    external_id: ev.external_id,
    source_name: ev.source_name,
    canonical_url: ev.canonical_url ?? ev.source_url,
    raw_payload_hash: hash,
    fingerprint,
    dedupe_key: ev.external_id
      ? `${ev.source_name}::${ev.external_id}`
      : fingerprint,
    last_seen_at: nowIso,
    missed_syncs: 0,
    status: ev.status,
    normalized_title: ev.title.toLowerCase(),
    normalized_venue: ev.venue_name.toLowerCase(),
    is_in_malaga_province: (ev.province ?? "Málaga").toLowerCase().includes("málaga")
      || (ev.province ?? "").toLowerCase().includes("malaga"),
    province: ev.province ?? "Málaga",
    organizer_name: ev.organizer_name ?? null,
    organizer_phone: ev.organizer_phone ?? null,
    organizer_email: ev.organizer_email ?? null,
    price_amount: ev.price_amount ?? null,
    price_currency: ev.price_currency ?? null,
  };
}

type FetchedEvents = {
  events: CanonicalSportsEvent[];
  adapterUsed: "json" | "html" | "ics";
  fetchNotes: string[];
};

async function fetchAllEvents(
  sourceName: string,
  sourceType: "json" | "html" | "ics" | "rss",
  feedUrl: string,
  slug: string | null,
): Promise<FetchedEvents> {
  if (sourceType === "json") {
    const events = (await fetchJsonFeed(feedUrl, sourceName)).events;
    return { events, adapterUsed: "json", fetchNotes: [] };
  }
  if (sourceType === "html" || sourceType === "ics") {
    const out = await runSourceAdapter({
      slug: slug ?? sourceName,
      sourceType,
      primaryUrl: feedUrl,
      sourceName,
    });
    return { events: out.events, adapterUsed: out.adapterUsed, fetchNotes: out.notes };
  }
  throw new Error(`adapter_not_supported:${sourceType}`);
}

async function processSource(
  sb: SB,
  sourceName: string,
  feedUrl: string,
  sourceType: "json" | "html" | "ics" | "rss",
  slug: string | null,
) {
  const nowIso = new Date().toISOString();
  const counters = {
    inserted: 0, updated: 0, unchanged: 0,
    deactivated: 0, errors: 0, rejected: 0,
  };
  const { events, adapterUsed, fetchNotes } =
    await fetchAllEvents(sourceName, sourceType, feedUrl, slug);

  // Pre-compute hashes + fingerprints once.
  type Prepared = { ev: CanonicalSportsEvent; hash: string; fingerprint: string };
  const prepared: Prepared[] = [];
  for (const ev of events) {
    prepared.push({
      ev,
      hash: await computePayloadHash(ev),
      fingerprint: computeFingerprint(ev),
    });
  }

  const externalIds = prepared.map((p) => p.ev.external_id).filter((x): x is string => !!x);
  const fingerprintsToCheck = prepared.filter((p) => !p.ev.external_id).map((p) => p.fingerprint);

  const byExternal = await loadExistingBySourceExternal(sb, sourceName, externalIds);
  const byFp = await loadExistingByFingerprint(sb, fingerprintsToCheck);

  const seenExternal = new Set<string>();
  const seenFp = new Set<string>();

  for (const { ev, hash, fingerprint } of prepared) {
    const existing = ev.external_id
      ? byExternal.get(ev.external_id) ?? null
      : byFp.get(fingerprint) ?? null;

    try {
      if (!existing) {
        const { error } = await sb.from("sports_events").insert(toRow(ev, hash, fingerprint, nowIso));
        if (error) { counters.errors++; continue; }
        counters.inserted++;
      } else if (existing.raw_payload_hash === hash
                 && existing.status !== "cancelled_or_unpublished"
                 && existing.status !== "missing_from_feed") {
        await sb.from("sports_events")
          .update({ last_seen_at: nowIso, missed_syncs: 0 })
          .eq("id", existing.id);
        counters.unchanged++;
      } else {
        const { error } = await sb.from("sports_events")
          .update(toRow(ev, hash, fingerprint, nowIso))
          .eq("id", existing.id);
        if (error) { counters.errors++; continue; }
        counters.updated++;
      }
    } catch {
      counters.errors++;
    }

    if (ev.external_id) seenExternal.add(ev.external_id);
    else seenFp.add(fingerprint);
  }

  // Empty-run safety: only run deactivation pass if we parsed at least one
  // credible event AND had no fatal errors. Otherwise a broken fetch or a
  // temporarily-empty page would sweep every event to cancelled.
  if (events.length > 0 && counters.errors === 0) {
    const { data: candidates } = await sb.from("sports_events")
      .select("id, external_id, fingerprint, missed_syncs, status")
      .eq("source_name", sourceName)
      .neq("status", "cancelled_or_unpublished");

    const decisions = decideDeactivations(
      new Set<string>([
        ...Array.from(seenExternal).map((x) => `ext:${x}`),
        ...Array.from(seenFp).map((x) => `fp:${x}`),
      ]),
      (candidates ?? []).map((r: { id: string; external_id: string | null; fingerprint: string | null; missed_syncs: number | null; status: string | null }) => ({
        id: r.id,
        key: r.external_id ? `ext:${r.external_id}` : `fp:${r.fingerprint ?? ""}`,
        missed_syncs: r.missed_syncs,
        status: r.status,
      })),
      MISSED_THRESHOLD,
      "cancelled_or_unpublished",
    );

    for (const d of decisions) {
      await sb.from("sports_events")
        .update({ missed_syncs: d.nextMissed, status: d.nextStatus })
        .eq("id", d.id);
      if (d.nextStatus === "cancelled_or_unpublished") counters.deactivated++;
    }
  }

  return { counters, feedCount: events.length, adapterUsed, fetchNotes };
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!checkAuth(req)) return json({ error: "unauthorized" }, 401);

  let body: { sourceName?: string; slug?: string; feedUrl?: string; adapter?: "json" | "html" | "ics" | "rss" } = {};
  try { body = await req.json(); } catch { /* empty body OK */ }

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // Resolve source: prefer registry lookup by slug; fallback to body/env for backward compat
  let sourceId: string | null = null;
  let sourceName = (body.sourceName ?? "malaga-sports-normalized").trim();
  let feedUrl = (body.feedUrl ?? "").trim();
  let sourceType: "json" | "html" | "ics" | "rss" = body.adapter ?? "json";
  const slug = (body.slug ?? "").trim();

  if (slug) {
    const { data: srcRow } = await sb.from("sports_sources")
      .select("id, slug, name, primary_url, source_type, enabled")
      .eq("slug", slug).maybeSingle();
    if (!srcRow) return json({ error: "source_not_found", slug }, 404);
    const r = srcRow as { id: string; slug: string; primary_url: string | null; source_type: string; enabled: boolean };
    if (!r.enabled) return json({ error: "source_disabled", slug }, 409);
    sourceId = r.id;
    sourceName = r.slug;
    if (!feedUrl) feedUrl = (r.primary_url ?? "").trim();
    if (r.source_type === "html" || r.source_type === "ics" || r.source_type === "json" || r.source_type === "rss") {
      sourceType = r.source_type;
    }
  }

  if (!feedUrl) feedUrl = (Deno.env.get("SPORTS_NORMALIZED_FEED_URL") ?? "").trim();
  if (!feedUrl) {
    return json({
      error: "no_feed_url",
      hint: "Pass body.slug (registered source) or body.feedUrl, or set SPORTS_NORMALIZED_FEED_URL",
    }, 400);
  }
  if (sourceType === "rss") {
    return json({ error: "adapter_not_implemented", adapter: "rss" }, 501);
  }

  // Robots.txt check when we scrape a public site (html/ics only).
  let robotsAllowed: boolean | null = null;
  let robotsReason: string | null = null;
  if (sourceType === "html" || sourceType === "ics") {
    const rc = await checkRobots(feedUrl);
    robotsAllowed = rc.allowed;
    robotsReason = rc.reason;
    if (sourceId) {
      await sb.from("sports_sources").update({
        robots_checked_at: rc.fetchedAt, robots_allowed: rc.allowed,
      }).eq("id", sourceId);
    }
    if (!rc.allowed) {
      if (sourceId) {
        await sb.from("sports_sources").update({
          last_status: "skipped_robots",
          last_error: `robots_disallow:${rc.reason}`.slice(0, 500),
        }).eq("id", sourceId);
      }
      return json({
        ok: false, skipped: true, reason: "robots_disallow", robots: rc,
        sourceName, adapter: sourceType,
      }, 200);
    }
  }

  const startedAt = Date.now();
  const attemptIso = new Date().toISOString();
  const { data: runRow } = await sb.from("sports_sync_runs")
    .insert({ status: "running", source_slug: sourceName, source_id: sourceId, adapter: sourceType })
    .select("id").maybeSingle();
  const runId = (runRow as { id: string } | null)?.id ?? null;
  if (sourceId) {
    await sb.from("sports_sources")
      .update({ last_attempt_at: attemptIso, last_status: "running" })
      .eq("id", sourceId);
  }

  try {
    const { counters, feedCount, adapterUsed, fetchNotes } =
      await processSource(sb, sourceName, feedUrl, sourceType, slug || null);
    const durationMs = Date.now() - startedAt;
    const finalStatus = counters.errors === 0 ? "success" : "partial";
    if (runId) {
      await sb.from("sports_sync_runs").update({
        status: finalStatus,
        items_fetched: feedCount,
        items_upserted: counters.inserted + counters.updated,
        items_failed: counters.errors,
        finished_at: new Date().toISOString(),
        error_sample: fetchNotes.length ? fetchNotes.join(" | ").slice(0, 500) : null,
      }).eq("id", runId);
    }
    if (sourceId) {
      await sb.from("sports_sources").update({
        last_status: finalStatus,
        last_success_at: counters.errors === 0 ? new Date().toISOString() : undefined,
        last_error: counters.errors === 0 ? null : `errors=${counters.errors}`,
        consecutive_failures: counters.errors === 0 ? 0 : undefined,
        items_fetched: feedCount,
        items_upserted: counters.inserted + counters.updated,
        last_sync_at: new Date().toISOString(),
      }).eq("id", sourceId);
    }
    return json({
      ok: true, sourceName, adapter: sourceType, adapterUsed,
      feedCount, counters, durationMs, runId,
      robots: { allowed: robotsAllowed, reason: robotsReason },
      notes: fetchNotes,
    });

  } catch (e) {
    const msg = ((e as Error).message ?? "unknown_error").slice(0, 500);
    if (runId) {
      await sb.from("sports_sync_runs").update({
        status: "error", finished_at: new Date().toISOString(), error_sample: msg,
      }).eq("id", runId);
    }
    if (sourceId) {
      // Increment failures via read-modify-write (best effort)
      const { data: cur } = await sb.from("sports_sources")
        .select("consecutive_failures").eq("id", sourceId).maybeSingle();
      const next = ((cur as { consecutive_failures: number } | null)?.consecutive_failures ?? 0) + 1;
      await sb.from("sports_sources").update({
        last_status: "error", last_error: msg, consecutive_failures: next,
      }).eq("id", sourceId);
    }
    return json({ error: "sync_failed", message: msg }, 500);
  }
});

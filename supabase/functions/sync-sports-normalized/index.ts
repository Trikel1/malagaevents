// Edge function: sync-sports-normalized
// Phase A: JSON adapter only. Auth by SYNC_SPORTS_KEY (x-sync-key header).
//
// - Reads feed URL from body.feedUrl OR env SPORTS_NORMALIZED_FEED_URL.
// - Upserts into public.sports_events using (source_name, external_id) or fingerprint.
// - Bumps missed_syncs for rows attributed to source_name that didn't appear.
// - Marks status='cancelled_or_unpublished' at 3 consecutive misses.
// - Logs run into public.sports_sync_runs.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import type { CanonicalSportsEvent } from "../_shared/sports-sync/types.ts";
import { fetchJsonFeed } from "../_shared/sports-sync/adapters/json.ts";
import { computeFingerprint, computePayloadHash } from "../_shared/sports-sync/fingerprint.ts";
import { decideDeactivations } from "../_shared/sports-sync/upsert.ts";

const MISSED_THRESHOLD_JSON = 3;

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

async function processSource(sb: SB, sourceName: string, feedUrl: string) {
  const nowIso = new Date().toISOString();
  const counters = { inserted: 0, updated: 0, unchanged: 0, deactivated: 0, errors: 0 };
  const events = (await fetchJsonFeed(feedUrl, sourceName)).events;

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
        // Refresh last_seen_at + reset missed counter, don't touch updated_at.
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

  // Deactivation pass: rows attributed to this source that we didn't see.
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
    MISSED_THRESHOLD_JSON,
    "cancelled_or_unpublished",
  );

  for (const d of decisions) {
    await sb.from("sports_events")
      .update({ missed_syncs: d.nextMissed, status: d.nextStatus })
      .eq("id", d.id);
    if (d.nextStatus === "cancelled_or_unpublished") counters.deactivated++;
  }

  return { counters, feedCount: events.length };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!checkAuth(req)) return json({ error: "unauthorized" }, 401);

  let body: { sourceName?: string; feedUrl?: string; adapter?: "json" } = {};
  try { body = await req.json(); } catch { /* empty body OK */ }

  const sourceName = (body.sourceName ?? "malaga-sports-normalized").trim();
  const feedUrl = (body.feedUrl ?? Deno.env.get("SPORTS_NORMALIZED_FEED_URL") ?? "").trim();
  const adapter = body.adapter ?? "json";

  if (!feedUrl) {
    return json({
      error: "no_feed_url",
      hint: "Set SPORTS_NORMALIZED_FEED_URL secret or pass body.feedUrl",
    }, 400);
  }
  if (adapter !== "json") {
    return json({ error: "adapter_not_implemented", adapter, phase: "A" }, 501);
  }

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const startedAt = Date.now();
  // Best-effort run log — table may or may not have all columns; ignore errors.
  const { data: runRow } = await sb.from("sports_sync_runs")
    .insert({ status: "running", source: sourceName })
    .select("id").maybeSingle();
  const runId = (runRow as { id: string } | null)?.id ?? null;

  try {
    const { counters, feedCount } = await processSource(sb, sourceName, feedUrl);
    const durationMs = Date.now() - startedAt;
    if (runId) {
      await sb.from("sports_sync_runs").update({
        status: counters.errors === 0 ? "success" : "partial",
        inserted: counters.inserted,
        updated: counters.updated,
        finished_at: new Date().toISOString(),
      }).eq("id", runId);
    }
    return json({
      ok: true, sourceName, adapter, feedCount, counters, durationMs, runId,
    });
  } catch (e) {
    const msg = (e as Error).message ?? "unknown_error";
    if (runId) {
      await sb.from("sports_sync_runs").update({
        status: "error", finished_at: new Date().toISOString(),
      }).eq("id", runId);
    }
    return json({ error: "sync_failed", message: msg }, 500);
  }
});

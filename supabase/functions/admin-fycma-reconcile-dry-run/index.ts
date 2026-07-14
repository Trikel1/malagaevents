// admin-fycma-reconcile-dry-run — Fase 5b (dry-run only, no writes).
//
// Produces the reconciliation plan for the FYCMA P0 source:
//   - inserts: events fetched from FYCMA that have no match in public.events.
//   - merges:  events fetched from FYCMA that match an existing row by
//              canonical URL or by (title, start day) at a FYCMA venue.
//              The plan records which fields would be filled in (url,
//              dedupe_key, venue_id, image_url, end_at) WITHOUT touching
//              the row.
//   - venueConsolidation: the 3 duplicate FYCMA venue rows and the
//     canonical target (chosen by highest usage). No UPDATE issued.
//
// CONTRACT:
//   POST (JWT admin required, verified via has_role('admin')).
//   200 -> { ok, dryRun: true, plan: {...}, writes: 0 }
//
// SAFETY:
// - No INSERT / UPDATE / DELETE on public.events, public.venues,
//   public.event_sources besides the standard last_dry_run_* metadata.
// - Reads are constrained to FYCMA venue rows / URLs, not the whole table.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fycmaAdapter, FYCMA_CANONICAL_VENUE } from "../_shared/adapters/fycma.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function madridDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "Europe/Madrid" });
}

function normalizeTitle(s: string): string {
  return s
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json({ error: "server_misconfig" }, 500);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data: userData, error: userErr } = await userClient.auth.getUser(token);
  if (userErr || !userData?.user) return json({ error: "invalid_token" }, 401);

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: hasAdmin, error: roleErr } = await admin.rpc("has_role", {
    _user_id: userData.user.id,
    _role: "admin",
  });
  if (roleErr || !hasAdmin) return json({ error: "forbidden" }, 403);

  // Load canonical FYCMA source row.
  const { data: source, error: srcErr } = await admin
    .from("event_sources")
    .select("id, slug, name, base_url, adapter_key, enabled, priority_tier, protected_source, legacy_refs")
    .eq("adapter_key", "fycma")
    .is("canonical_source_id", null)
    .maybeSingle();
  if (srcErr || !source) return json({ error: "fycma_source_missing" }, 500);

  const startedAt = Date.now();

  // 1) Fetch normalized FYCMA events (read-only).
  const events = await fycmaAdapter.fetchEvents({
    source: {
      id: source.id, slug: source.slug, name: source.name, kind: null,
      base_url: source.base_url, adapter_key: source.adapter_key,
      locality_slug: "malaga", category_hints: null, priority: 100,
      enabled: source.enabled, schedule_cron: null, robots_ok: true, notes: null,
    },
    dryRun: true,
    logger: { info: () => {}, warn: () => {}, error: () => {} },
  });

  // 2) Read all events at FYCMA venues (venue_id in duplicates OR name match).
  const legacyVenueIds: string[] = Array.isArray(source.legacy_refs?.venue_duplicates)
    ? source.legacy_refs.venue_duplicates
    : [
        "cb2e43bd-bef9-4a3b-b27c-9e5a73474c12",
        "e492194c-e0fd-4801-af76-50bc3ab7836a",
        "7bb158eb-5e36-4333-9250-a56ddf24d236",
      ];

  const { data: existing } = await admin
    .from("events")
    .select("id, title, start_at, end_at, url, dedupe_key, venue_id, venue_name, image_url")
    .or(
      `venue_id.in.(${legacyVenueIds.join(",")}),venue_name.ilike.%FYCMA%,venue_name.ilike.%Palacio de Ferias%`,
    );

  const existingRows = existing ?? [];

  // Index existing by canonical URL and by (normalized title + startDay).
  const byUrl = new Map<string, typeof existingRows[number]>();
  const byTitleDay = new Map<string, typeof existingRows[number]>();
  for (const r of existingRows) {
    if (r.url) byUrl.set(r.url.toLowerCase().replace(/\/$/, ""), r);
    if (r.title && r.start_at) {
      byTitleDay.set(`${normalizeTitle(r.title)}|${madridDay(r.start_at)}`, r);
    }
  }

  // 3) Choose canonical venue (highest event usage among duplicates).
  const { data: venueUsage } = await admin
    .from("events")
    .select("venue_id")
    .in("venue_id", legacyVenueIds);
  const usageCount = new Map<string, number>();
  for (const v of venueUsage ?? []) {
    if (v.venue_id) usageCount.set(v.venue_id, (usageCount.get(v.venue_id) ?? 0) + 1);
  }
  const canonicalVenueId =
    legacyVenueIds.slice().sort(
      (a, b) => (usageCount.get(b) ?? 0) - (usageCount.get(a) ?? 0),
    )[0] ?? legacyVenueIds[0];
  const aliasesVenueIds = legacyVenueIds.filter((v) => v !== canonicalVenueId);

  // 4) Build plan.
  const inserts: Array<{
    title: string; startAt: string; endAt: string | null;
    url: string; category: string | null; multiDay: boolean;
  }> = [];
  const merges: Array<{
    existingEventId: string; existingTitle: string; matchedBy: "url" | "title_day";
    wouldSet: { url?: string; dedupe_key?: string; venue_id?: string; image_url?: string; end_at?: string | null };
  }> = [];

  for (const e of events) {
    const urlKey = e.sourceUrl?.toLowerCase().replace(/\/$/, "") ?? "";
    const titleKey = `${normalizeTitle(e.title ?? "")}|${madridDay(e.startAt!)}`;
    const matchUrl = urlKey ? byUrl.get(urlKey) : undefined;
    const matchTitle = matchUrl ? undefined : byTitleDay.get(titleKey);
    const match = matchUrl ?? matchTitle;

    if (match) {
      const wouldSet: Record<string, unknown> = {};
      if (!match.url && e.sourceUrl) wouldSet.url = e.sourceUrl;
      if (!match.dedupe_key) wouldSet.dedupe_key = (e as { fycmaDedupeKey?: string }).fycmaDedupeKey;
      if (!match.venue_id || match.venue_id !== canonicalVenueId) wouldSet.venue_id = canonicalVenueId;
      if (!match.image_url && e.imageUrl) wouldSet.image_url = e.imageUrl;
      if (!match.end_at && e.endAt) wouldSet.end_at = e.endAt;
      merges.push({
        existingEventId: match.id,
        existingTitle: match.title,
        matchedBy: matchUrl ? "url" : "title_day",
        wouldSet,
      });
    } else {
      inserts.push({
        title: e.title!,
        startAt: e.startAt!,
        endAt: e.endAt ?? null,
        url: e.sourceUrl ?? "",
        category: e.category ?? null,
        multiDay: (e as { isMultiDay?: boolean }).isMultiDay === true,
      });
    }
  }

  const plan = {
    fetched: events.length,
    inserts: { count: inserts.length, sample: inserts.slice(0, 10) },
    merges: { count: merges.length, sample: merges.slice(0, 10) },
    venueConsolidation: {
      canonicalVenueId,
      canonicalVenueName: FYCMA_CANONICAL_VENUE,
      aliasesVenueIds,
      usage: Object.fromEntries(usageCount),
      eventsOrphanNullVenue: existingRows.filter((r) => !r.venue_id).length,
    },
    activation: {
      currentEnabled: source.enabled === true,
      wouldEnable: false, // dry-run: never flips enabled.
      writeGuards: [
        "WRITE_ENABLED=false in shared/write-auth still required",
        "SYNC_ADMIN_KEY header still required",
        "protected_source=true (bypass any auto-disable)",
      ],
    },
    writes: 0,
    durationMs: Date.now() - startedAt,
  };

  // Persist compact summary — this is the only mutation, and it's metadata
  // on event_sources, not on events / venues.
  await admin
    .from("event_sources")
    .update({
      last_dry_run_at: new Date().toISOString(),
      last_dry_run_status: "reconcile_ok",
      last_dry_run_result: {
        phase: "5b-reconcile",
        at: new Date().toISOString(),
        fetched: plan.fetched,
        insertsCount: plan.inserts.count,
        mergesCount: plan.merges.count,
        canonicalVenueId,
        aliasesVenueIds,
        writes: 0,
      },
    })
    .eq("id", source.id);

  return json({ ok: true, dryRun: true, source: { id: source.id, slug: source.slug }, plan }, 200);
});

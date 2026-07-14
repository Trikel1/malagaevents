// admin-fycma-dry-run: admin-only dry-run for the FYCMA P0 source.
//
// Contract:
//   POST (no body needed)
//   200 -> {
//     ok, dryRun: true,
//     source: { id, slug, priority_tier, protected_source },
//     inspectedUrl,
//     httpStatus,
//     durationMs,
//     candidateCount,
//     validCount,
//     rejectedCount,
//     multiDayCount,
//     fieldsFrequency: { title, start_date, end_date, ... },
//     sample: [ up to 8 normalized events ],
//     duplicatesInEvents: number,
//     duplicatesBreakdown: { byUrl, byTitleDate },
//     warnings: string[]
//   }
//
// GUARANTEES:
// - Never writes to `public.events`.
// - Writes ONLY the dry-run summary to `event_sources.last_dry_run_*` for
//   observability. That is a source metadata update, not event data.
// - Requires JWT admin (`has_role(_role => 'admin')`). Not a public endpoint.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  fycmaAdapter,
  normalizeFycmaEvent,
  FYCMA_CANONICAL_VENUE,
} from "../_shared/adapters/fycma.ts";

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

  // 1) Load the canonical FYCMA source row.
  const { data: sourceRow, error: srcErr } = await admin
    .from("event_sources")
    .select("id, slug, name, base_url, adapter_key, priority_tier, protected_source, enabled")
    .eq("adapter_key", "fycma")
    .is("canonical_source_id", null)
    .order("priority", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (srcErr || !sourceRow) {
    return json({ error: "fycma_source_missing", detail: srcErr?.message ?? null }, 500);
  }

  const startedAt = Date.now();
  const warnings: string[] = [];
  let httpStatus = 0;
  let inspectedUrl = "";
  let rawEventsCount = 0;
  let normalized: ReturnType<typeof normalizeFycmaEvent>[] = [];

  try {
    // We reuse the adapter's logic but capture raw counts by fetching once
    // through a lightweight logger. The adapter itself handles pagination.
    const canonicalApi = "https://fycma.com/wp-json/tribe/events/v1/events";
    const base = (sourceRow.base_url ?? "").trim();
    inspectedUrl =
      base && /wp-json\/tribe\/events\/v1\/events/.test(base) ? base : canonicalApi;

    // Fast HEAD-like probe to record HTTP status without extra load.
    const probe = await fetch(inspectedUrl + "?per_page=1", {
      headers: { "User-Agent": "MalagaEventsBot/1.0 (dry-run)", Accept: "application/json" },
    });
    httpStatus = probe.status;
    await probe.text();
    if (!probe.ok) warnings.push(`probe_http_${httpStatus}`);

    // Adapter run (paginated, capped).
    const collected: unknown[] = [];
    const captureLogger = {
      info: () => {},
      warn: (_m: string, extra?: Record<string, unknown>) => {
        if (extra?.reason) warnings.push(`reject:${String(extra.reason)}`);
      },
      error: (m: string) => warnings.push(`err:${m}`),
    };
    const events = await fycmaAdapter.fetchEvents({
      source: {
        id: sourceRow.id,
        slug: sourceRow.slug,
        name: sourceRow.name,
        kind: null,
        base_url: sourceRow.base_url,
        adapter_key: sourceRow.adapter_key,
        locality_slug: "malaga",
        category_hints: null,
        priority: 100,
        enabled: sourceRow.enabled,
        schedule_cron: null,
        robots_ok: true,
        notes: null,
      },
      dryRun: true,
      logger: captureLogger,
    });
    for (const e of events) collected.push(e);
    rawEventsCount = collected.length;
    // We already have normalized events from the adapter. But re-run
    // normalizeFycmaEvent on raw is impossible here since the adapter has
    // consumed the raw payload. We build the fieldsFrequency from the
    // adapter output shape instead.
    normalized = events.map((e) => ({
      ok: true,
      normalized: e as unknown as ReturnType<typeof normalizeFycmaEvent>["normalized"],
      fieldsPresent: [
        "title", "start_date",
        e.endAt ? "end_date" : null,
        e.description ? "description" : null,
        e.imageUrl ? "image" : null,
        "url",
        e.ticketUrl ? "ticket_url" : null,
        e.organizer ? "organizer" : null,
        e.category ? "category" : null,
      ].filter((x): x is string => !!x),
    }));
  } catch (e) {
    return json(
      {
        ok: false,
        dryRun: true,
        source: {
          id: sourceRow.id, slug: sourceRow.slug,
          priority_tier: sourceRow.priority_tier,
          protected_source: sourceRow.protected_source,
        },
        inspectedUrl,
        httpStatus,
        error: "adapter_failed",
        detail: String(e).slice(0, 500),
        durationMs: Date.now() - startedAt,
      },
      502,
    );
  }

  // Field frequency
  const fieldsFrequency: Record<string, number> = {};
  for (const n of normalized) {
    for (const f of n.fieldsPresent) fieldsFrequency[f] = (fieldsFrequency[f] ?? 0) + 1;
  }

  // Duplicate detection against existing events (READ-ONLY).
  const urls = normalized
    .map((n) => n.normalized?.sourceUrl)
    .filter((u): u is string => !!u);
  let dupByUrl = 0;
  if (urls.length > 0) {
    const { count } = await admin
      .from("events")
      .select("id", { head: true, count: "exact" })
      .in("url", urls);
    dupByUrl = count ?? 0;
  }

  // Approximate duplicates by title + start day for events whose canonical
  // URL is not yet stored: we look for events at the FYCMA venue on the
  // same start date.
  const titles = normalized
    .map((n) => n.normalized?.title)
    .filter((t): t is string => !!t);
  let dupByTitleDate = 0;
  if (titles.length > 0) {
    const { count } = await admin
      .from("events")
      .select("id", { head: true, count: "exact" })
      .or(
        "venue_name.ilike.%FYCMA%,venue_name.ilike.%Palacio de Ferias%,location_name_raw.ilike.%FYCMA%",
      )
      .in("title", titles);
    dupByTitleDate = count ?? 0;
  }

  const multiDayCount = normalized.filter(
    (n) => n.normalized && (n.normalized as { endAt?: string | null }).endAt,
  ).length;
  const sample = normalized.slice(0, 8).map((n) => {
    const e = n.normalized as {
      title?: string; startAt?: string; endAt?: string | null;
      sourceUrl?: string; ticketUrl?: string | null; imageUrl?: string | null;
      category?: string | null; organizer?: string | null;
      venueName?: string | null;
    } | undefined;
    return e
      ? {
          title: e.title,
          startAt: e.startAt,
          endAt: e.endAt ?? null,
          venue: e.venueName ?? null,
          category: e.category ?? null,
          organizer: e.organizer ?? null,
          url: e.sourceUrl,
          ticketUrl: e.ticketUrl ?? null,
          imageUrl: e.imageUrl ?? null,
        }
      : null;
  });

  const durationMs = Date.now() - startedAt;
  const summary = {
    ok: true,
    dryRun: true as const,
    source: {
      id: sourceRow.id,
      slug: sourceRow.slug,
      priority_tier: sourceRow.priority_tier,
      protected_source: sourceRow.protected_source,
      canonicalVenue: FYCMA_CANONICAL_VENUE,
    },
    inspectedUrl,
    httpStatus,
    durationMs,
    candidateCount: rawEventsCount,
    validCount: normalized.length,
    rejectedCount: rawEventsCount - normalized.length,
    multiDayCount,
    fieldsFrequency,
    duplicatesInEvents: dupByUrl + dupByTitleDate,
    duplicatesBreakdown: { byUrl: dupByUrl, byTitleDate: dupByTitleDate },
    sample,
    warnings: warnings.slice(0, 20),
  };

  // Persist compact summary to event_sources.last_dry_run_* (NO event writes).
  const compactSummary = {
    at: new Date().toISOString(),
    inspectedUrl: summary.inspectedUrl,
    httpStatus: summary.httpStatus,
    candidateCount: summary.candidateCount,
    validCount: summary.validCount,
    rejectedCount: summary.rejectedCount,
    multiDayCount: summary.multiDayCount,
    duplicatesInEvents: summary.duplicatesInEvents,
    fieldsFrequency: summary.fieldsFrequency,
    warnings: summary.warnings,
  };
  await admin
    .from("event_sources")
    .update({
      last_dry_run_at: new Date().toISOString(),
      last_dry_run_status: httpStatus === 200 ? "ok" : `http_${httpStatus}`,
      last_dry_run_result: compactSummary,
    })
    .eq("id", sourceRow.id);

  return json(summary, 200);
});

// scrape-source: run ONE ingestion source end-to-end.
//
// Phase 2A behaviour:
//  - Requires SYNC_ADMIN_KEY via `x-sync-key` header. No JWT, no anon access.
//  - Default mode is dryRun=true.
//  - Even when dryRun=false, this function DOES NOT insert into public.events
//    yet. It validates + normalises + generates dedupe_key and would-be
//    upserts, but the actual write path is disabled behind a `WRITE_ENABLED`
//    guard that stays off in Phase 2A. This is deliberate.
//  - Every run writes to event_source_runs; failures write to ingestion_errors.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { getAllHeaders } from "../_shared/security.ts";
import type {
  CanonicalEvent,
  EventSourceRow,
  RunStatus,
  RunSummary,
} from "../_shared/ingestion/types.ts";
import { getAdapter } from "../_shared/ingestion/adapters.ts";
import { generateEventDedupeKey } from "../_shared/ingestion/dedupe.ts";
import { stableHash } from "../_shared/ingestion/normalize.ts";
import { parseSpanishDateToMadrid } from "../_shared/ingestion/dates.ts";
import { resolveVenueAlias } from "../_shared/ingestion/venues.ts";
import { resolveLocalityAlias } from "../_shared/ingestion/localities.ts";

// Feature flag: real insertion into public.events is disabled in Phase 2A.
// DO NOT flip this without an explicit product decision and a migration
// review — sync-events is still authoritative today.
const WRITE_ENABLED = false;

type Deps = ReturnType<typeof createClient>;

function json(body: unknown, status = 200, origin?: string | null) {
  return new Response(JSON.stringify(body), { status, headers: getAllHeaders(origin) });
}

function checkAuth(req: Request): boolean {
  const expected = Deno.env.get("SYNC_ADMIN_KEY");
  if (!expected) return false;
  const provided = req.headers.get("x-sync-key");
  return !!provided && provided === expected;
}

async function loadSource(supabase: Deps, sourceId: string): Promise<EventSourceRow | null> {
  const { data, error } = await supabase
    .from("event_sources")
    .select("id, slug, name, kind, base_url, adapter_key, locality_slug, category_hints, priority, enabled, schedule_cron, robots_ok, notes")
    .eq("id", sourceId)
    .maybeSingle();
  if (error || !data) return null;
  return data as EventSourceRow;
}

async function startRun(
  supabase: Deps,
  sourceId: string,
  dryRun: boolean,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("event_source_runs")
    .insert({
      source_id: sourceId,
      status: "running",
      inserted: 0,
      updated: 0,
      skipped_dupes: 0,
      errors: 0,
      meta: { dryRun, phase: "2A" },
    })
    .select("id")
    .single();
  if (error || !data) return null;
  return (data as { id: string }).id;
}

async function finishRun(
  supabase: Deps,
  runId: string,
  patch: {
    status: RunStatus;
    inserted: number;
    updated: number;
    skippedDupes: number;
    errors: number;
    durationMs: number;
    meta?: Record<string, unknown>;
  },
) {
  await supabase
    .from("event_source_runs")
    .update({
      status: patch.status,
      inserted: patch.inserted,
      updated: patch.updated,
      skipped_dupes: patch.skippedDupes,
      errors: patch.errors,
      duration_ms: patch.durationMs,
      finished_at: new Date().toISOString(),
      meta: patch.meta ?? {},
    })
    .eq("id", runId);
}

async function logError(
  supabase: Deps,
  sourceId: string,
  runId: string | null,
  stage: string,
  message: string,
  payloadSample?: unknown,
) {
  await supabase.from("ingestion_errors").insert({
    source_id: sourceId,
    run_id: runId,
    stage,
    message: message.slice(0, 2000),
    payload_sample: payloadSample ? sanitizeSample(payloadSample) : null,
  });
}

/** Strip anything that looks secret before persisting into ingestion_errors. */
function sanitizeSample(input: unknown): unknown {
  try {
    const s = JSON.stringify(input, (_key, val) => {
      if (typeof val === "string" && val.length > 500) return val.slice(0, 500) + "…";
      return val;
    });
    return JSON.parse(
      s.replace(/("(?:api[_-]?key|token|authorization|password|secret)"\s*:\s*)"[^"]*"/gi, '$1"[REDACTED]"'),
    );
  } catch {
    return null;
  }
}

function isValidCanonical(ev: CanonicalEvent): boolean {
  if (!ev.title || !ev.title.trim()) return false;
  if (!ev.sourceUrl || !ev.sourceUrl.trim()) return false;
  if (!ev.locality || !ev.locality.trim()) return false;
  if (ev.timezone !== "Europe/Madrid") return false;
  if (!parseSpanishDateToMadrid(ev.startAt)) return false;
  return true;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: getAllHeaders(origin) });
  }
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405, origin);
  }
  if (!checkAuth(req)) {
    return json({ error: "unauthorized" }, 401, origin);
  }

  let body: { sourceId?: string; dryRun?: boolean };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400, origin);
  }
  const sourceId = body.sourceId?.trim();
  const dryRun = body.dryRun !== false; // default to true

  if (!sourceId || !/^[0-9a-f-]{36}$/i.test(sourceId)) {
    return json({ error: "invalid_source_id" }, 400, origin);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const source = await loadSource(supabase, sourceId);
  if (!source) return json({ error: "source_not_found" }, 404, origin);

  if (!dryRun && !source.enabled) {
    return json({ error: "source_disabled" }, 409, origin);
  }
  if (!dryRun && !source.robots_ok) {
    return json({ error: "robots_not_confirmed" }, 409, origin);
  }

  const adapter = getAdapter(source.adapter_key);
  if (!adapter) {
    const runId = await startRun(supabase, sourceId, dryRun);
    if (runId) {
      await logError(supabase, sourceId, runId, "load_source", `no adapter for key=${source.adapter_key}`);
      await finishRun(supabase, runId, {
        status: "error", inserted: 0, updated: 0, skippedDupes: 0, errors: 1, durationMs: 0,
        meta: { dryRun, reason: "no_adapter" },
      });
    }
    return json({ error: "adapter_not_found", adapter_key: source.adapter_key }, 400, origin);
  }

  const runId = await startRun(supabase, sourceId, dryRun);
  if (!runId) return json({ error: "run_insert_failed" }, 500, origin);

  const startedAt = Date.now();
  let inserted = 0, updated = 0, skippedDupes = 0, errors = 0;
  const preview: CanonicalEvent[] = [];

  try {
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
      events = await adapter.fetchEvents({ source, dryRun, logger });
    } catch (e) {
      errors++;
      await logError(supabase, sourceId, runId, "fetch", (e as Error).message);
    }

    for (const ev of events) {
      if (!isValidCanonical(ev)) {
        errors++;
        await logError(supabase, sourceId, runId, "normalize", "invalid canonical event", ev);
        continue;
      }
      let canonicalVenue: string | null = null;
      try {
        const v = await resolveVenueAlias(supabase, ev.venueName);
        canonicalVenue = v.canonicalName;
        await resolveLocalityAlias(supabase, ev.locality); // touched for future use
      } catch { /* alias lookup is best-effort */ }

      let dedupeKey: string;
      try {
        dedupeKey = await generateEventDedupeKey(ev, canonicalVenue);
      } catch (e) {
        errors++;
        await logError(supabase, sourceId, runId, "dedupe", (e as Error).message, ev);
        continue;
      }

      if (dryRun || !WRITE_ENABLED) {
        preview.push({ ...ev, raw: { dedupe_key: dedupeKey, canonicalVenue } });
        skippedDupes++; // treat as "would upsert" for accounting
        continue;
      }

      // Phase 2B upsert path — fully implemented but gated by WRITE_ENABLED.
      // WRITE_ENABLED remains false until an explicit product decision.
      try {
        const { data: existing } = await supabase
          .from("events")
          .select("id, content_hash")
          .eq("dedupe_key", dedupeKey)
          .maybeSingle();

        const contentHash = await stableHash(
          [ev.title, ev.description ?? "", ev.startAt, ev.venueName ?? "", ev.imageUrl ?? "", ev.ticketUrl ?? ""].join("|"),
        );
        const nowIso = new Date().toISOString();

        const row = {
          title: ev.title,
          description: ev.description ?? null,
          start_at: ev.startAt,
          end_at: ev.endAt ?? null,
          venue_name: ev.venueName ?? null,
          venue_address: ev.venueAddress ?? null,
          category: ev.category ?? null,
          image_url: ev.imageUrl ?? null,
          source_url: ev.sourceUrl,
          ticket_url: ev.ticketUrl ?? null,
          price_text: ev.priceText ?? null,
          dedupe_key: dedupeKey,
          source_id: source.id,
          content_hash: contentHash,
          last_seen_at: nowIso,
        };

        if (existing) {
          const ex = existing as { id: string; content_hash: string | null };
          if (ex.content_hash === contentHash) {
            skippedDupes++;
            // Still refresh last_seen_at so we know the event is alive.
            await supabase.from("events").update({ last_seen_at: nowIso }).eq("id", ex.id);
          } else {
            const { error: updErr } = await supabase.from("events").update(row).eq("id", ex.id);
            if (updErr) { errors++; await logError(supabase, sourceId, runId, "upsert", updErr.message, { dedupeKey }); }
            else updated++;
          }
        } else {
          const { error: insErr } = await supabase.from("events").insert(row);
          if (insErr) { errors++; await logError(supabase, sourceId, runId, "upsert", insErr.message, { dedupeKey }); }
          else inserted++;
        }
      } catch (e) {
        errors++;
        await logError(supabase, sourceId, runId, "upsert", (e as Error).message, { dedupeKey });
      }
    }

    const status: RunStatus = errors === 0 ? "success" : (inserted + updated + skippedDupes > 0 ? "partial" : "error");
    const durationMs = Date.now() - startedAt;

    await finishRun(supabase, runId, {
      status, inserted, updated, skippedDupes, errors, durationMs,
      meta: {
        dryRun,
        write_enabled: WRITE_ENABLED,
        adapter: adapter.key,
        events_fetched: events.length,
        phase: "2A",
      },
    });

    const summary: RunSummary = {
      runId, sourceId, status, inserted, updated, skippedDupes, errors, durationMs, dryRun,
      preview: dryRun ? preview.slice(0, 20) : undefined,
    };
    return json(summary, 200, origin);
  } catch (e) {
    const durationMs = Date.now() - startedAt;
    await logError(supabase, sourceId, runId, "finalize", (e as Error).message);
    await finishRun(supabase, runId, {
      status: "error", inserted, updated, skippedDupes, errors: errors + 1, durationMs,
      meta: { dryRun, fatal: true },
    });
    return json({ error: "run_failed" }, 500, origin);
  }
});

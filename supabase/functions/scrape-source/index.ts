// scrape-source: run ONE ingestion source end-to-end.
//
// Phase 3E-1 behaviour:
//  - Requires SYNC_ADMIN_KEY via `x-sync-key` header. No JWT, no anon access.
//  - Default mode is dryRun=true.
//  - Write path is now gated per-run (no global WRITE_ENABLED constant).
//    To actually write into public.events, ALL of these must hold:
//      * body.writeEnabled === true
//      * body.dryRun === false
//      * source.enabled === true
//      * source.robots_ok === true
//      * source.write_confirmed_at IS NOT NULL
//      * source.adapter_key === adapter.key
//      * body.maxWrites <= MAX_WRITES_PER_RUN (50)
//    Otherwise the function returns `write_not_authorized` and logs an
//    ingestion_error, without touching public.events.
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
import {
  stableHash,
  normalizeTitle,
  normalizeVenueName,
} from "../_shared/ingestion/normalize.ts";
import { parseSpanishDateToMadrid } from "../_shared/ingestion/dates.ts";
import { resolveVenueAlias } from "../_shared/ingestion/venues.ts";
import { resolveLocalityAlias } from "../_shared/ingestion/localities.ts";
import {
  authorizeWrite,
  MAX_WRITES_PER_RUN,
} from "../_shared/ingestion/write-auth.ts";

// deno-lint-ignore no-explicit-any
type Deps = any;

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
    .select("id, slug, name, kind, base_url, adapter_key, locality_slug, category_hints, priority, enabled, schedule_cron, robots_ok, notes, write_confirmed_at, write_confirmed_by")
    .eq("id", sourceId)
    .maybeSingle();
  if (error || !data) return null;
  return data as EventSourceRow;
}

async function startRun(
  supabase: Deps,
  sourceId: string,
  dryRun: boolean,
  writeAuthorized: boolean,
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
      meta: { dryRun, writeAuthorized, phase: "3E-1" },
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

// authorizeWrite + MAX_WRITES_PER_RUN are imported from
// _shared/ingestion/write-auth.ts to keep the gate identical in production
// (Edge Function) and in unit tests (vitest).


/** Find an existing event row: first by sha256 dedupe_key, then by legacy fallback. */
async function findExistingEvent(
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

  // Legacy fallback: title_normalized + venue_name_normalized + start_at ± 5 min.
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

  let body: { sourceId?: string; dryRun?: boolean; writeEnabled?: boolean; maxWrites?: number };
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

  const adapter = getAdapter(source.adapter_key);
  if (!adapter) {
    const runId = await startRun(supabase, sourceId, dryRun, false);
    if (runId) {
      await logError(supabase, sourceId, runId, "load_source", `no adapter for key=${source.adapter_key}`);
      await finishRun(supabase, runId, {
        status: "error", inserted: 0, updated: 0, skippedDupes: 0, errors: 1, durationMs: 0,
        meta: { dryRun, reason: "no_adapter", phase: "3E-1" },
      });
    }
    return json({ error: "adapter_not_found", adapter_key: source.adapter_key }, 400, origin);
  }

  // Authorize write path (only relevant if caller asked for it).
  let writeAuthorized = false;
  let maxWrites = 0;
  if (body.writeEnabled === true) {
    const auth = authorizeWrite(body, source, adapter.key);
    if (!auth.ok) {
      const runId = await startRun(supabase, sourceId, dryRun, false);
      if (runId) {
        await logError(supabase, sourceId, runId, "authorize_write", `write_not_authorized: ${auth.reason}`);
        await finishRun(supabase, runId, {
          status: "error", inserted: 0, updated: 0, skippedDupes: 0, errors: 1, durationMs: 0,
          meta: {
            dryRun, writeAuthorized: false, reason: auth.reason,
            adapter: adapter.key, phase: "3E-1",
          },
        });
      }
      return json({ error: "write_not_authorized", reason: auth.reason }, 403, origin);
    }
    writeAuthorized = true;
    maxWrites = auth.maxWrites;
  }

  const runId = await startRun(supabase, sourceId, dryRun, writeAuthorized);
  if (!runId) return json({ error: "run_insert_failed" }, 500, origin);

  const startedAt = Date.now();
  let inserted = 0, updated = 0, skippedDupes = 0, errors = 0;
  const preview: CanonicalEvent[] = [];
  const eventIds: string[] = [];
  let events: CanonicalEvent[] = [];

  try {
    const logger = {
      info: (msg: string, extra?: Record<string, unknown>) =>
        console.log(JSON.stringify({ lvl: "info", src: source.slug, msg, ...extra })),
      warn: (msg: string, extra?: Record<string, unknown>) =>
        console.warn(JSON.stringify({ lvl: "warn", src: source.slug, msg, ...extra })),
      error: (msg: string, extra?: Record<string, unknown>) =>
        console.error(JSON.stringify({ lvl: "error", src: source.slug, msg, ...extra })),
    };

    try {
      events = await adapter.fetchEvents({ source, dryRun, logger });
    } catch (e) {
      errors++;
      await logError(supabase, sourceId, runId, "fetch", (e as Error).message);
    }

    // Drop events whose startAt is more than 48h in the past. Past events
    // are never shown in the UI, and processing them per-row (alias
    // lookups + hashing + dedupe select) blows the CPU budget on large
    // feeds like malaga-open-data-csv (907 rows -> ~66 future).
    const pastCutoffMs = Date.now() - 48 * 3600_000;
    const beforeFilter = events.length;
    events = events.filter((ev) => {
      const t = ev?.startAt ? new Date(ev.startAt).getTime() : NaN;
      return !isFinite(t) || t >= pastCutoffMs;
    });
    if (events.length !== beforeFilter) {
      logger.info("filtered past events", {
        before: beforeFilter,
        after: events.length,
      });
    }

    // Cache alias lookups per-run — a single feed reuses the same venues /
    // localities dozens of times.
    const venueCache = new Map<string, string | null>();
    const localityCache = new Set<string>();

    for (const ev of events) {
      if (!isValidCanonical(ev)) {
        errors++;
        await logError(supabase, sourceId, runId, "normalize", "invalid canonical event", ev);
        continue;
      }
      let canonicalVenue: string | null = null;
      try {
        const venueKey = (ev.venueName ?? "").trim().toLowerCase();
        if (venueCache.has(venueKey)) {
          canonicalVenue = venueCache.get(venueKey) ?? null;
        } else {
          const v = await resolveVenueAlias(supabase as never, ev.venueName);
          canonicalVenue = v.canonicalName;
          venueCache.set(venueKey, canonicalVenue);
        }
        const localityKey = (ev.locality ?? "").trim().toLowerCase();
        if (localityKey && !localityCache.has(localityKey)) {
          await resolveLocalityAlias(supabase as never, ev.locality);
          localityCache.add(localityKey);
        }
      } catch { /* alias lookup is best-effort */ }

      let dedupeKey: string;
      try {
        dedupeKey = await generateEventDedupeKey(ev, canonicalVenue);
      } catch (e) {
        errors++;
        await logError(supabase, sourceId, runId, "dedupe", (e as Error).message, ev);
        continue;
      }

      // Dry-run / preview path (default). Never touches public.events.
      if (dryRun || !writeAuthorized) {
        if (preview.length < 20) {
          preview.push({
            ...ev,
            raw: {
              ...(ev.raw && typeof ev.raw === "object" ? ev.raw as Record<string, unknown> : {}),
              dedupe_key: dedupeKey,
              canonicalVenue,
            },
          });
        }
        skippedDupes++; // "would upsert" accounting for dry-run
        continue;
      }

      // Write path — only reachable when writeAuthorized=true.
      if (inserted + updated >= maxWrites) {
        skippedDupes++;
        continue;
      }

      try {
        const existing = await findExistingEvent(supabase, ev, canonicalVenue, dedupeKey);

        const contentHash = await stableHash(
          [ev.title, ev.description ?? "", ev.startAt, ev.venueName ?? "", ev.imageUrl ?? "", ev.ticketUrl ?? ""].join("|"),
        );
        const nowIso = new Date().toISOString();

        const row: Record<string, unknown> = {
          title: ev.title,
          description: ev.description ?? "",
          description_full: ev.description ?? null,
          category: ev.category ?? "general",
          start_at: ev.startAt,
          end_at: ev.endAt ?? null,
          venue_name: canonicalVenue ?? ev.venueName ?? null,
          venue_name_raw: ev.venueName ?? null,
          address: ev.venueAddress ?? "",
          location_name_raw: ev.locality,
          is_free: false,
          ticket_url: ev.ticketUrl ?? null,
          buy_url: ev.ticketUrl ?? null,
          image_url: ev.imageUrl ?? null,
          source_type: "official_feed",
          source: source.slug,
          source_ref: ev.sourceUrl,
          url: ev.sourceUrl,
          status: "published",
          dedupe_key: dedupeKey,
          source_id: source.id,
          content_hash: contentHash,
          last_seen_at: nowIso,
          last_synced_at: nowIso,
        };

        if (existing) {
          if (existing.content_hash === contentHash && existing.dedupe_key === dedupeKey) {
            skippedDupes++;
            await supabase.from("events").update({ last_seen_at: nowIso }).eq("id", existing.id);
          } else {
            // Consolidate legacy dedupe_key to sha256 on update.
            const { error: updErr } = await supabase.from("events").update(row).eq("id", existing.id);
            if (updErr) {
              errors++;
              await logError(supabase, sourceId, runId, "upsert", updErr.message, { dedupeKey });
            } else {
              updated++;
              eventIds.push(existing.id);
            }
          }
        } else {
          const { data: ins, error: insErr } = await supabase
            .from("events")
            .insert(row)
            .select("id")
            .single();
          if (insErr) {
            errors++;
            await logError(supabase, sourceId, runId, "upsert", insErr.message, { dedupeKey });
          } else if (ins) {
            inserted++;
            eventIds.push((ins as { id: string }).id);
          }
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
        writeAuthorized,
        maxWrites,
        adapter: adapter.key,
        events_fetched: events.length,
        event_ids: eventIds,
        phase: "3E-1",
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
      meta: { dryRun, writeAuthorized, fatal: true, phase: "3E-1" },
    });
    return json({ error: "run_failed" }, 500, origin);
  }
});

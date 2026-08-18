// Edge function: check-url-health
//
// Server-side liveness audit for every outbound URL the app exposes.
// Sources audited:
//   events            -> url, ticket_url, buy_url, image_url
//   sports_sources    -> primary_url, secondary_urls[]
//   sports_events     -> source_url, canonical_url, tickets_url, registration_url
//   pharmacies_guard  -> source_ref
//   pharmacies_directory -> source_ref
//
// Guarantees:
// - Format validation first (http/https only, parseable URL).
// - robots.txt is honoured: disallowed URLs are recorded as skipped, never fetched.
// - HEAD first, GET fallback for hosts that reject HEAD (405/501/403).
// - Hard timeout per request, redirects capped by the runtime (manual cap of 5).
// - A URL is only marked ok=true after a real 2xx/3xx response. Correct
//   formatting alone NEVER marks a URL valid.
//
// Auth: x-sync-key must equal SYNC_SPORTS_KEY (same secret as the sync engine).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { checkRobots } from "../_shared/sports-sync/robots.ts";

const TIMEOUT_MS = 12_000;
const MAX_REDIRECTS = 5;
const DEFAULT_LIMIT = 120;
const UA = "MalagaEventsLinkChecker/1.0 (+https://malagaevents.lovable.app)";

// deno-lint-ignore no-explicit-any
type SB = any;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

interface Candidate {
  entity_table: string;
  entity_id: string | null;
  field_name: string;
  url: string;
}

interface Result extends Candidate {
  http_status: number | null;
  latency_ms: number | null;
  robots_allowed: boolean | null;
  ok: boolean;
  error: string | null;
}

function isWellFormed(raw: string): boolean {
  try {
    const u = new URL(raw.trim());
    return (u.protocol === "http:" || u.protocol === "https:") && !!u.hostname.includes(".");
  } catch {
    return false;
  }
}

/** Manual redirect walk so we can cap hops and report the final status. */
async function probe(url: string): Promise<{ status: number | null; latency: number; error: string | null }> {
  const started = Date.now();
  let current = url;
  let error: string | null = null;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      let res = await fetch(current, {
        method: "HEAD",
        redirect: "manual",
        signal: ctrl.signal,
        headers: { "user-agent": UA, accept: "*/*" },
      });
      // Some hosts refuse HEAD; retry once with a ranged GET.
      if (res.status === 405 || res.status === 501 || res.status === 403) {
        try { await res.body?.cancel(); } catch { /* ignore */ }
        res = await fetch(current, {
          method: "GET",
          redirect: "manual",
          signal: ctrl.signal,
          headers: { "user-agent": UA, accept: "*/*", range: "bytes=0-2048" },
        });
      }
      clearTimeout(timer);

      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        try { await res.body?.cancel(); } catch { /* ignore */ }
        if (!loc) return { status: res.status, latency: Date.now() - started, error: "redirect_without_location" };
        if (hop === MAX_REDIRECTS) {
          return { status: res.status, latency: Date.now() - started, error: "too_many_redirects" };
        }
        current = new URL(loc, current).toString();
        continue;
      }

      try { await res.body?.cancel(); } catch { /* ignore */ }
      return { status: res.status, latency: Date.now() - started, error: null };
    } catch (e) {
      clearTimeout(timer);
      const msg = (e as Error).name === "AbortError" ? "timeout" : ((e as Error).message ?? "fetch_error");
      error = msg.slice(0, 200);
      break;
    }
  }
  return { status: null, latency: Date.now() - started, error: error ?? "unreachable" };
}

async function collect(sb: SB, perTable: number): Promise<Candidate[]> {
  const out: Candidate[] = [];
  const push = (entity_table: string, entity_id: string | null, field_name: string, url: unknown) => {
    if (typeof url !== "string" || !url.trim()) return;
    out.push({ entity_table, entity_id, field_name, url: url.trim() });
  };

  const { data: sources } = await sb.from("sports_sources")
    .select("id, primary_url, url, secondary_urls").eq("enabled", true);
  for (const r of (sources ?? [])) {
    push("sports_sources", r.id, "primary_url", r.primary_url ?? r.url);
    const sec = Array.isArray(r.secondary_urls) ? r.secondary_urls : [];
    for (const s of sec) push("sports_sources", r.id, "secondary_urls", typeof s === "string" ? s : (s?.url ?? null));
  }

  const { data: sportsEvents } = await sb.from("sports_events")
    .select("id, source_url, canonical_url, tickets_url, registration_url")
    .gte("start_date", new Date().toISOString().slice(0, 10))
    .limit(perTable);
  for (const r of (sportsEvents ?? [])) {
    push("sports_events", r.id, "source_url", r.source_url);
    push("sports_events", r.id, "canonical_url", r.canonical_url);
    push("sports_events", r.id, "tickets_url", r.tickets_url);
    push("sports_events", r.id, "registration_url", r.registration_url);
  }

  const { data: events } = await sb.from("events")
    .select("id, url, ticket_url, buy_url, image_url")
    .eq("status", "published")
    .gte("start_at", new Date().toISOString())
    .limit(perTable);
  for (const r of (events ?? [])) {
    push("events", r.id, "url", r.url);
    push("events", r.id, "ticket_url", r.ticket_url);
    push("events", r.id, "buy_url", r.buy_url);
    push("events", r.id, "image_url", r.image_url);
  }

  const { data: guard } = await sb.from("pharmacies_guard").select("id, source_ref").limit(perTable);
  for (const r of (guard ?? [])) push("pharmacies_guard", r.id, "source_ref", r.source_ref);

  const { data: dir } = await sb.from("pharmacies_directory").select("id, source_ref").limit(perTable);
  for (const r of (dir ?? [])) push("pharmacies_directory", r.id, "source_ref", r.source_ref);

  // De-duplicate by (table, field, url): one health row per distinct link.
  const seen = new Set<string>();
  return out.filter((c) => {
    const k = `${c.entity_table}|${c.field_name}|${c.url}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const expected = Deno.env.get("SYNC_SPORTS_KEY");
  const provided = req.headers.get("x-sync-key");
  if (!expected || provided !== expected) return json({ error: "unauthorized" }, 401);

  let body: { limit?: number; tables?: string[]; perTable?: number } = {};
  try { body = await req.json(); } catch { /* empty body OK */ }
  const limit = Math.min(Math.max(body.limit ?? DEFAULT_LIMIT, 1), 400);
  const perTable = Math.min(Math.max(body.perTable ?? 60, 1), 200);

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  let candidates = await collect(sb, perTable);
  if (body.tables?.length) {
    candidates = candidates.filter((c) => body.tables!.includes(c.entity_table));
  }
  candidates = candidates.slice(0, limit);

  const robotsCache = new Map<string, boolean>();
  const results: Result[] = [];

  for (const c of candidates) {
    if (!isWellFormed(c.url)) {
      results.push({ ...c, http_status: null, latency_ms: null, robots_allowed: null, ok: false, error: "malformed_url" });
      continue;
    }
    const host = new URL(c.url).host;
    let allowed = robotsCache.get(host);
    if (allowed === undefined) {
      allowed = (await checkRobots(c.url, UA)).allowed;
      robotsCache.set(host, allowed);
    }
    if (!allowed) {
      results.push({ ...c, http_status: null, latency_ms: null, robots_allowed: false, ok: false, error: "robots_disallow" });
      continue;
    }
    const p = await probe(c.url);
    results.push({
      ...c,
      http_status: p.status,
      latency_ms: p.latency,
      robots_allowed: true,
      ok: p.status != null && p.status >= 200 && p.status < 400,
      error: p.error,
    });
  }

  const nowIso = new Date().toISOString();
  const rows = results.map((r) => ({
    entity_table: r.entity_table,
    entity_id: r.entity_id,
    field_name: r.field_name,
    url: r.url,
    http_status: r.http_status,
    latency_ms: r.latency_ms,
    robots_allowed: r.robots_allowed,
    ok: r.ok,
    error: r.error,
    last_checked_at: nowIso,
  }));

  let written = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    const { error } = await sb.from("url_health_checks")
      .upsert(chunk, { onConflict: "entity_table,field_name,url_hash" });
    if (!error) written += chunk.length;
  }

  return json({
    ok: true,
    checked: results.length,
    written,
    summary: {
      healthy: results.filter((r) => r.ok).length,
      broken: results.filter((r) => !r.ok && r.error !== "robots_disallow").length,
      robots_blocked: results.filter((r) => r.error === "robots_disallow").length,
      malformed: results.filter((r) => r.error === "malformed_url").length,
    },
    byTable: Object.fromEntries(
      [...new Set(results.map((r) => r.entity_table))].map((t) => [
        t,
        {
          total: results.filter((r) => r.entity_table === t).length,
          ok: results.filter((r) => r.entity_table === t && r.ok).length,
        },
      ]),
    ),
  });
});

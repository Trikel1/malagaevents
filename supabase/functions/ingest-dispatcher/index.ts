// ingest-dispatcher: fan out to scrape-source for each eligible event source.
//
// Phase 2A behaviour:
//  - Requires SYNC_ADMIN_KEY via `x-sync-key`. Same gate as scrape-source.
//  - Default mode is dryRun=true.
//  - Only picks sources where enabled=true AND robots_ok=true UNLESS
//    an explicit sourceIds list is provided (dry-run of disabled sources is
//    allowed so we can validate adapters before flipping enabled=true).
//  - Runs in low concurrency (max 2 in flight).
//  - Does NOT touch or replace the existing sync-events / sync-sports crons.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { getAllHeaders } from "../_shared/security.ts";

const MAX_CONCURRENCY = 2;
const HARD_LIMIT = 20;

function json(body: unknown, status = 200, origin?: string | null) {
  return new Response(JSON.stringify(body), { status, headers: getAllHeaders(origin) });
}

function checkAuth(req: Request): boolean {
  const expected = Deno.env.get("SYNC_ADMIN_KEY");
  if (!expected) return false;
  const provided = req.headers.get("x-sync-key");
  return !!provided && provided === expected;
}

async function invokeScrapeSource(
  sourceId: string,
  dryRun: boolean,
): Promise<{ sourceId: string; status: number; body: unknown }> {
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/scrape-source`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-sync-key": Deno.env.get("SYNC_ADMIN_KEY") ?? "",
      "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""}`,
    },
    body: JSON.stringify({ sourceId, dryRun }),
  });
  const body = await res.json().catch(() => null);
  return { sourceId, status: res.status, body };
}

async function runWithConcurrency<T>(
  items: string[],
  worker: (item: string) => Promise<T>,
  concurrency: number,
): Promise<T[]> {
  const results: T[] = [];
  let cursor = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await worker(items[idx]);
    }
  });
  await Promise.all(runners);
  return results;
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

  let body: { dryRun?: boolean; sourceIds?: string[]; limit?: number };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const dryRun = body.dryRun !== false; // default true
  const limit = Math.min(Math.max(1, body.limit ?? HARD_LIMIT), HARD_LIMIT);
  const explicitIds = Array.isArray(body.sourceIds)
    ? body.sourceIds.filter((s) => typeof s === "string" && /^[0-9a-f-]{36}$/i.test(s))
    : null;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // Build the eligible source list.
  let query = supabase
    .from("event_sources")
    .select("id, slug, enabled, robots_ok, priority, adapter_key")
    .order("priority", { ascending: false })
    .order("slug", { ascending: true })
    .limit(limit);

  if (explicitIds && explicitIds.length > 0) {
    query = query.in("id", explicitIds);
  } else {
    // Only truly-eligible sources when no explicit list is passed.
    query = query.eq("enabled", true).eq("robots_ok", true);
  }

  const { data: sources, error } = await query;
  if (error) return json({ error: "sources_query_failed" }, 500, origin);
  const list = (sources ?? []) as Array<{ id: string; slug: string; enabled: boolean; robots_ok: boolean; adapter_key: string | null }>;

  if (list.length === 0) {
    return json({ dryRun, processed: 0, results: [], note: "no eligible sources" }, 200, origin);
  }

  const results = await runWithConcurrency(
    list.map((s) => s.id),
    (id) => invokeScrapeSource(id, dryRun),
    MAX_CONCURRENCY,
  );

  const summary = {
    dryRun,
    processed: results.length,
    successes: results.filter((r) => r.status === 200).length,
    failures: results.filter((r) => r.status !== 200).length,
    results: results.map((r) => ({ sourceId: r.sourceId, status: r.status })),
  };
  return json(summary, 200, origin);
});

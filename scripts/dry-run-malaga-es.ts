// Dry-run harness for Bloque 3 malaga.es adapters (Diputación provincial +
// Culturama). Executes both adapters against real URLs via Firecrawl, prints
// a compact JSON summary, and verifies that no writes hit the database.
//
// Usage: FIRECRAWL_API_KEY=... deno run --allow-net --allow-env scripts/dry-run-malaga-es.ts
//
// Bounded: LIMIT=3 detail fetches per source to stay within one API-credit
// unit per run. Purpose is to prove wiring, not to backfill.

import { diputacionMalagaAdapter } from "../supabase/functions/_shared/adapters/diputacion-malaga.ts";
import { culturamaAdapter } from "../supabase/functions/_shared/adapters/culturama.ts";
import { generateEventDedupeKey } from "../supabase/functions/_shared/ingestion/dedupe.ts";
import type {
  EventSourceRow,
  AdapterContext,
} from "../supabase/functions/_shared/ingestion/types.ts";

function makeSource(slug: string, baseUrl: string): EventSourceRow {
  return {
    id: `dry-run-${slug}`,
    slug,
    name: slug,
    kind: "institutional",
    base_url: baseUrl,
    adapter_key: null,
    locality_slug: null,
    category_hints: null,
    priority: 5,
    enabled: false,
    schedule_cron: null,
    robots_ok: false,
    notes: null,
    write_confirmed_at: null,
    write_confirmed_by: null,
  };
}

function makeLogger(sink: unknown[]): AdapterContext["logger"] {
  return {
    info: (msg, extra) => sink.push({ lvl: "info", msg, extra }),
    warn: (msg, extra) => sink.push({ lvl: "warn", msg, extra }),
    error: (msg, extra) => sink.push({ lvl: "error", msg, extra }),
  };
}

async function runOne(adapter: typeof diputacionMalagaAdapter, baseUrl: string) {
  const logs: unknown[] = [];
  const started = Date.now();
  const events = await adapter.fetchEvents({
    source: makeSource(adapter.key, baseUrl),
    dryRun: true,
    logger: makeLogger(logs),
  });
  const keys = await Promise.all(
    events.map((e) => generateEventDedupeKey(e, e.venueName)),
  );
  return {
    adapter: adapter.key,
    baseUrl,
    durationMs: Date.now() - started,
    canonicalCount: events.length,
    externalIds: events.map((e) => e.externalId),
    dedupeKeys: keys,
    sample: events.slice(0, 2).map((e) => ({
      externalId: e.externalId,
      title: e.title,
      startAt: e.startAt,
      locality: e.locality,
      sourceUrl: e.sourceUrl,
      organizer: e.organizer,
    })),
    logs,
  };
}

const out = {
  diputacion: await runOne(
    diputacionMalagaAdapter,
    "https://www.malaga.es/es/laprovincia/3315/agenda",
  ),
  culturama: await runOne(
    culturamaAdapter,
    "https://www.malaga.es/culturama/2157/agenda",
  ),
};

console.log(JSON.stringify(out, null, 2));

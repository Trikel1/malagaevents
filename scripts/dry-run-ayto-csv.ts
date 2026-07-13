// Dry-run harness: executes the ayto-malaga-csv adapter against the real
// production URL under Deno, mirroring the exact runtime scrape-source uses,
// and dumps a JSON summary. Does NOT touch the database — the adapter is a
// pure function that only returns CanonicalEvent[].
//
// Usage:  deno run --allow-net --allow-env scripts/dry-run-ayto-csv.ts

import { aytoMalagaCsvAdapter } from "../supabase/functions/_shared/adapters/ayto-malaga-csv.ts";
import { generateEventDedupeKey } from "../supabase/functions/_shared/ingestion/dedupe.ts";
import type { EventSourceRow } from "../supabase/functions/_shared/ingestion/types.ts";

const source: EventSourceRow = {
  id: "a0df1863-0442-4e7f-b476-ba2d8fd5c04a",
  slug: "ayto-malaga-csv",
  name: "Ayuntamiento de Málaga (CSV Open Data)",
  kind: "csv",
  base_url:
    "https://datosabiertos.malaga.eu/recursos/cultura/agenda/2026.csv",
  adapter_key: "ayto-malaga-csv",
  locality_slug: "malaga",
  category_hints: null,
  priority: 1,
  enabled: false,
  schedule_cron: null,
  robots_ok: false,
  notes: null,
  write_confirmed_at: null,
  write_confirmed_by: null,
};

const startedAt = Date.now();
const logs: Array<{ lvl: string; msg: string; extra?: unknown }> = [];
const logger = {
  info: (msg: string, extra?: Record<string, unknown>) =>
    logs.push({ lvl: "info", msg, extra }),
  warn: (msg: string, extra?: Record<string, unknown>) =>
    logs.push({ lvl: "warn", msg, extra }),
  error: (msg: string, extra?: Record<string, unknown>) =>
    logs.push({ lvl: "error", msg, extra }),
};

const events = await aytoMalagaCsvAdapter.fetchEvents({
  source,
  dryRun: true,
  logger,
});

const keys = await Promise.all(
  events.map((e) => generateEventDedupeKey(e, e.venueName)),
);
const uniqueKeys = new Set(keys);

const durationMs = Date.now() - startedAt;
const out = {
  fetchedAt: new Date().toISOString(),
  url: source.base_url,
  events_canonicalised: events.length,
  unique_dedupe_keys: uniqueKeys.size,
  duplicates_collapsed: events.length - uniqueKeys.size,
  duration_ms: durationMs,
  sample: events.slice(0, 5).map((e, i) => ({
    dedupe_key: keys[i],
    external_id: e.externalId,
    title: e.title,
    startAt: e.startAt,
    venueName: e.venueName,
    category: e.category,
  })),
  logs,
};
console.log(JSON.stringify(out, null, 2));

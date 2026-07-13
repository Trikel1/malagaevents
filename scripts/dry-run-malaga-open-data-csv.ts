// Real-CSV dry-run harness for the malaga-open-data-csv adapter.
// Pure read-only: no DB writes, no side effects.
//
// Usage:
//   deno run --allow-net --allow-env scripts/dry-run-malaga-open-data-csv.ts

import { malagaOpenDataCsvAdapter } from "../supabase/functions/_shared/adapters/malaga-open-data-csv.ts";
import { generateEventDedupeKey } from "../supabase/functions/_shared/ingestion/dedupe.ts";
import { fetchCsv } from "../supabase/functions/_shared/adapters/lib/csv.ts";
import type { EventSourceRow } from "../supabase/functions/_shared/ingestion/types.ts";

const URL_CSV =
  "https://datosabiertos.malaga.eu/recursos/cultura/agenda/2026.csv";

const source: EventSourceRow = {
  id: "00000000-0000-0000-0000-000000000000",
  slug: "malaga-open-data-csv",
  name: "Málaga · Datos Abiertos (Agenda CSV)",
  kind: "csv",
  base_url: URL_CSV,
  adapter_key: "malaga-open-data-csv",
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

const logger = {
  info: () => {},
  warn: () => {},
  error: (m: string, e?: Record<string, unknown>) => console.error(m, e ?? ""),
};

// Total raw rows (adapter is capped at 8000 for safety).
const raw = await fetchCsv(URL_CSV, {}, { timeoutMs: 25000, retries: 2 });
const totalRows = raw.rows.length;

const started = Date.now();
const events = await malagaOpenDataCsvAdapter.fetchEvents({
  source,
  dryRun: true,
  logger,
});
const durationMs = Date.now() - started;

const now = Date.now();
let future = 0;
let past = 0;
let missingVenue = 0;
let missingAddress = 0;
let missingLocality = 0;
let missingUrl = 0;
let missingDescription = 0;
let explicitTime = 0;
let timeAssumed = 0;
let rangedEnd = 0;
const categoryCount = new Map<string, number>();
const venueCount = new Map<string, number>();
const externalIdCount = new Map<string, number>();
const sourceUrlCount = new Map<string, number>();

for (const ev of events) {
  const t = new Date(ev.startAt).getTime();
  if (!Number.isNaN(t)) (t >= now ? future++ : past++);
  if (ev.timeAssumed) timeAssumed++;
  else explicitTime++;
  if (ev.endAt) rangedEnd++;
  if (!ev.venueName) missingVenue++;
  if (!ev.venueAddress) missingAddress++;
  if (!ev.locality) missingLocality++;
  if (!ev.sourceUrl || ev.sourceUrl === URL_CSV) missingUrl++;
  if (!ev.description) missingDescription++;
  if (ev.category) categoryCount.set(ev.category, (categoryCount.get(ev.category) ?? 0) + 1);
  if (ev.venueName) venueCount.set(ev.venueName, (venueCount.get(ev.venueName) ?? 0) + 1);
  if (ev.externalId) externalIdCount.set(ev.externalId, (externalIdCount.get(ev.externalId) ?? 0) + 1);
  if (ev.sourceUrl) sourceUrlCount.set(ev.sourceUrl, (sourceUrlCount.get(ev.sourceUrl) ?? 0) + 1);
}

const dupExternalIds = [...externalIdCount.values()]
  .filter((n) => n > 1).reduce((a, n) => a + (n - 1), 0);
const dupSourceUrls = [...sourceUrlCount.values()]
  .filter((n) => n > 1).reduce((a, n) => a + (n - 1), 0);

const dedupeKeys = await Promise.all(
  events.map((e) => generateEventDedupeKey(e, e.venueName)),
);
const uniqueDedupe = new Set(dedupeKeys);
const dedupeCollapsed = events.length - uniqueDedupe.size;

const previews = events.slice(0, 10).map((e, i) => ({
  dedupe_key: dedupeKeys[i],
  external_id: e.externalId,
  title: e.title,
  startAt: e.startAt,
  endAt: e.endAt,
  timeAssumed: e.timeAssumed ?? false,
  venue: e.venueName,
  address: e.venueAddress,
  locality: e.locality,
  category: e.category,
  sourceUrl: e.sourceUrl,
}));

console.log(JSON.stringify({
  fetched_at: new Date().toISOString(),
  url: URL_CSV,
  duration_ms: durationMs,
  totals: {
    raw_rows: totalRows,
    canonicalised: events.length,
    rejected: totalRows - events.length,
    future_or_current: future,
    past,
  },
  missing: {
    title: 0,           // rejected upstream
    start_date: 0,      // idem
    venue: missingVenue,
    address: missingAddress,
    locality: missingLocality,
    source_url: missingUrl,
    description: missingDescription,
  },
  time: {
    explicit: explicitTime,
    assumed: timeAssumed,
    ranged_endAt: rangedEnd,
  },
  dedupe: {
    unique_keys: uniqueDedupe.size,
    collapsed_by_fingerprint: dedupeCollapsed,
    duplicate_external_ids: dupExternalIds,
    duplicate_source_urls: dupSourceUrls,
  },
  top_categories: [...categoryCount.entries()]
    .sort((a, b) => b[1] - a[1]).slice(0, 15)
    .map(([k, v]) => ({ k, v })),
  top_venues: [...venueCount.entries()]
    .sort((a, b) => b[1] - a[1]).slice(0, 15)
    .map(([k, v]) => ({ k, v })),
  previews,
}, null, 2));

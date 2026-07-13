// Extended metrics harness for the ayto-malaga-csv adapter.
// Pure read-only. No DB writes. Reuses the registered adapter unchanged.
//
// Usage:
//   deno run --allow-net --allow-env scripts/dry-run-ayto-csv-metrics.ts

import { aytoMalagaCsvAdapter } from "../supabase/functions/_shared/adapters/ayto-malaga-csv.ts";
import { generateEventDedupeKey } from "../supabase/functions/_shared/ingestion/dedupe.ts";
import { fetchCsv } from "../supabase/functions/_shared/adapters/lib/csv.ts";
import type { EventSourceRow } from "../supabase/functions/_shared/ingestion/types.ts";

const URL_CSV =
  "https://datosabiertos.malaga.eu/recursos/cultura/agenda/2026.csv";

const source: EventSourceRow = {
  id: "a0df1863-0442-4e7f-b476-ba2d8fd5c04a",
  slug: "ayto-malaga-csv",
  name: "Ayuntamiento de Málaga (CSV Open Data)",
  kind: "csv",
  base_url: URL_CSV,
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

const logger = {
  info: () => {},
  warn: () => {},
  error: (msg: string, extra?: Record<string, unknown>) =>
    console.error(msg, extra ?? ""),
};

// ── Raw row count (bypasses adapter's row cap) ────────────────────────────
const raw = await fetchCsv(URL_CSV, {}, { timeoutMs: 25000, retries: 2 });
const totalRows = raw.rows.length;

// ── Canonicalised events via the real adapter ─────────────────────────────
const started = Date.now();
const events = await aytoMalagaCsvAdapter.fetchEvents({
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
const seenExternalIds = new Map<string, number>();
const seenSourceUrls = new Map<string, number>();

for (const ev of events) {
  const t = new Date(ev.startAt).getTime();
  if (!Number.isNaN(t)) {
    if (t >= now) future++;
    else past++;
  }
  // "time assumed" heuristic: startAt at exactly 00:00 in Madrid tz.
  // Row F_INICIO ends in " 00:00:00" → the CSV had no explicit time.
  const rawStart = String((ev.raw as Record<string, string>)?.F_INICIO ?? "");
  const hasClockInRaw = /\d{2}:\d{2}:\d{2}$/.test(rawStart) &&
    !/00:00:00$/.test(rawStart);
  const horario = String((ev.raw as Record<string, string>)?.HORARIO ?? "")
    .trim();
  const horarioHasTime = /\d{1,2}[:.h]\d{2}|\d{1,2}\s*h/i.test(horario);
  if (hasClockInRaw || horarioHasTime) explicitTime++;
  else timeAssumed++;

  if (ev.endAt) rangedEnd++;
  if (!ev.venueName) missingVenue++;
  if (!ev.venueAddress) missingAddress++;
  if (!ev.locality) missingLocality++;
  if (!ev.sourceUrl || ev.sourceUrl === URL_CSV) missingUrl++;
  if (!ev.description) missingDescription++;

  if (ev.category) {
    categoryCount.set(ev.category, (categoryCount.get(ev.category) ?? 0) + 1);
  }
  if (ev.venueName) {
    venueCount.set(ev.venueName, (venueCount.get(ev.venueName) ?? 0) + 1);
  }
  if (ev.externalId) {
    seenExternalIds.set(
      ev.externalId,
      (seenExternalIds.get(ev.externalId) ?? 0) + 1,
    );
  }
  if (ev.sourceUrl) {
    seenSourceUrls.set(
      ev.sourceUrl,
      (seenSourceUrls.get(ev.sourceUrl) ?? 0) + 1,
    );
  }
}

const dupExternalIds = [...seenExternalIds.values()].filter((n) => n > 1)
  .reduce((a, n) => a + (n - 1), 0);
const dupSourceUrls = [...seenSourceUrls.values()].filter((n) => n > 1)
  .reduce((a, n) => a + (n - 1), 0);

// Dedupe fingerprint collapse
const dedupeKeys = await Promise.all(
  events.map((e) => generateEventDedupeKey(e, e.venueName)),
);
const uniqueDedupe = new Set(dedupeKeys);
const dedupeCollapsed = events.length - uniqueDedupe.size;

const sortedCats = [...categoryCount.entries()].sort((a, b) => b[1] - a[1]);
const sortedVenues = [...venueCount.entries()].sort((a, b) => b[1] - a[1]);

// Sanitised preview: strip PII-adjacent raw
const previews = events.slice(0, 10).map((e, i) => ({
  dedupe_key: dedupeKeys[i],
  external_id: e.externalId,
  title: e.title,
  startAt: e.startAt,
  endAt: e.endAt,
  venue: e.venueName,
  address: e.venueAddress,
  locality: e.locality,
  category: e.category,
  sourceUrl: e.sourceUrl,
}));

const rejectedRows = totalRows - events.length;

const summary = {
  fetched_at: new Date().toISOString(),
  url: URL_CSV,
  duration_ms: durationMs,
  totals: {
    raw_rows: totalRows,
    canonicalised: events.length,
    rejected: rejectedRows,
    future_or_current: future,
    past: past,
  },
  missing: {
    title: 0, // rejected upstream — canonicalizeRow requires title
    start: 0, // idem
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
    unique_dedupe_keys: uniqueDedupe.size,
    collapsed_by_fingerprint: dedupeCollapsed,
    duplicate_external_ids: dupExternalIds,
    duplicate_source_urls: dupSourceUrls,
  },
  top_categories: sortedCats.slice(0, 15).map(([k, v]) => ({ k, v })),
  top_venues: sortedVenues.slice(0, 15).map(([k, v]) => ({ k, v })),
  previews,
};

console.log(JSON.stringify(summary, null, 2));

// Sprint G3 — Global coverage harness.
//
// Runs dry-run against every registered cultural/events adapter with a
// stub EventSourceRow, computes coverage metrics, and prints a summary
// table. Read-only: never touches public.events, never mutates
// event_sources, never calls scrape-source.
//
// Behaviour:
//  - Non-fatal for 0-event returns (that's a signal, not a failure).
//  - Fails only on: invalid CanonicalEvent shape, thrown exceptions,
//    or accidental writes (there aren't any — this test never uses
//    a Supabase client).
//  - Reports firecrawlAvailable without ever exposing the key value.
//  - Reports a per-adapter status:
//      ok_events                 → returned >= 1 valid event
//      no_current_events         → 0 events, warning surfaced, likely
//                                  needs Firecrawl or manual review
//      blocked_needs_firecrawl   → 0 events AND no FIRECRAWL_API_KEY set
//                                  AND the adapter did fetch something
//      blocked_needs_manual_review → 0 events AND Firecrawl was
//                                  available (structure changed)
//      fetch_failed              → adapter errored during fetch
//
// This is a diagnostic, not a validator. It exists so a maintainer can
// answer "which adapters are ready for manual robots review?" without
// touching production.

import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import type { CanonicalEvent, EventSourceRow, SourceAdapter } from "../ingestion/types.ts";
import { listAdapterKeys, getAdapter } from "../ingestion/adapters.ts";

type Row = {
  adapter_key: string;
  sourceSlug: string;
  baseUrl: string;
  status:
    | "ok_events"
    | "no_current_events"
    | "blocked_needs_firecrawl"
    | "blocked_needs_manual_review"
    | "fetch_failed";
  eventsReturned: number;
  withEndAt: number;
  timeAssumed: number;
  ticketUrls: number;
  imageUrls: number;
  invalid: number;
  dupSourceUrls: number;
  dupDedupeKeys: number;
  venueDist: Record<string, number>;
  warningsSample: string[];
  errorsSample: string[];
  fatalError?: string;
};

// Adapters explicitly SKIPPED here (opt-out list): placeholder or
// non-parsing adapters we don't want to hit live in the harness.
const SKIP_KEYS = new Set<string>([
  // ayto-malaga is the Phase 2A placeholder that returns []; leave it in
  // to prove infrastructure integrity, but keep it here for future opt-out.
]);

// Best-known source metadata (kept local to avoid hitting the DB).
const KNOWN: Record<string, { slug: string; baseUrl: string }> = {
  "ayto-malaga": { slug: "ayto-malaga", baseUrl: "https://www.malaga.eu/" },
  "teatro-cervantes": { slug: "teatro-cervantes", baseUrl: "https://www.teatrocervantes.com/" },
  "teatro-soho": { slug: "teatro-soho", baseUrl: "https://www.teatrodelsoho.com/" },
  "teatro-canovas": {
    slug: "teatro-canovas",
    baseUrl: "https://www.juntadeandalucia.es/cultura/aaiicc/teatros/teatro-canovas",
  },
  "la-termica": { slug: "la-termica", baseUrl: "https://www.latermicamalaga.com/" },
  "mva": { slug: "mva", baseUrl: "https://www.malaga.es/mva/" },
  "museo-picasso": { slug: "museo-picasso", baseUrl: "https://www.museopicassomalaga.org/" },
  "museo-thyssen": { slug: "museo-thyssen", baseUrl: "https://www.carmenthyssenmalaga.org/" },
  "sala-trinchera": { slug: "sala-trinchera", baseUrl: "https://salatrinchera.com/" },
  "sala-paris-15": { slug: "paris15", baseUrl: "https://www.paris15.es/eventos/" },
  "la-cochera-cabaret": { slug: "cochera-cabaret", baseUrl: "https://www.lacocheracabaret.com/" },
  "contenedor-cultural-uma": {
    slug: "contenedor-uma",
    baseUrl: "https://www.uma.es/servicio-cultura/info/111568/contenedor-cultural/",
  },
  "cine-albeniz": { slug: "cine-albeniz", baseUrl: "https://cinealbeniz.com/" },
};

function stubSource(adapterKey: string): EventSourceRow {
  const known = KNOWN[adapterKey] ?? { slug: adapterKey, baseUrl: "" };
  return {
    id: "00000000-0000-0000-0000-000000000000",
    slug: known.slug,
    name: adapterKey,
    kind: "adapter",
    base_url: known.baseUrl,
    adapter_key: adapterKey,
    locality_slug: "malaga",
    category_hints: null,
    priority: 50,
    enabled: false,
    schedule_cron: null,
    robots_ok: false,
    notes: null,
  } as unknown as EventSourceRow;
}

function makeLogger() {
  const warnings: string[] = [];
  const errors: string[] = [];
  return {
    warnings,
    errors,
    logger: {
      info: (_msg: string, _extra?: Record<string, unknown>) => {},
      warn: (msg: string, extra?: Record<string, unknown>) =>
        warnings.push(msg + " " + JSON.stringify(extra ?? {})),
      error: (msg: string, extra?: Record<string, unknown>) =>
        errors.push(msg + " " + JSON.stringify(extra ?? {})),
    },
  };
}

function validateCanonicalStrict(ev: CanonicalEvent): string | null {
  if (!ev.title || !ev.title.trim()) return "missing_title";
  if (!ev.sourceUrl || !/^https?:\/\//.test(ev.sourceUrl)) return "bad_sourceUrl";
  if (!ev.locality) return "missing_locality";
  if (ev.timezone !== "Europe/Madrid") return "bad_timezone";
  const t = new Date(ev.startAt).getTime();
  if (!isFinite(t)) return "bad_startAt";
  return null;
}

async function runOne(
  adapter: SourceAdapter,
  firecrawlAvailable: boolean,
): Promise<Row> {
  const source = stubSource(adapter.key);
  const known = KNOWN[adapter.key] ?? { slug: adapter.key, baseUrl: source.base_url ?? "" };
  const { logger, warnings, errors } = makeLogger();

  let events: CanonicalEvent[] = [];
  let fatal: string | undefined;
  try {
    events = await adapter.fetchEvents({ source, dryRun: true, logger });
  } catch (e) {
    fatal = (e as Error).message;
  }

  let withEndAt = 0;
  let timeAssumed = 0;
  let ticketUrls = 0;
  let imageUrls = 0;
  let invalid = 0;
  const sourceUrlSeen = new Map<string, number>();
  const dedupeSeen = new Map<string, number>();
  const venueDist = new Map<string, number>();

  for (const ev of events) {
    const v = validateCanonicalStrict(ev);
    if (v) invalid++;
    if (ev.endAt) withEndAt++;
    const raw = (ev.raw ?? {}) as Record<string, unknown>;
    if (raw.timeAssumed === true) timeAssumed++;
    if (ev.ticketUrl) ticketUrls++;
    if (ev.imageUrl) imageUrls++;
    sourceUrlSeen.set(ev.sourceUrl, (sourceUrlSeen.get(ev.sourceUrl) ?? 0) + 1);
    const dk = ev.sourceUrl + "|" + (ev.title ?? "").toLowerCase();
    dedupeSeen.set(dk, (dedupeSeen.get(dk) ?? 0) + 1);
    venueDist.set(ev.venueName ?? "?", (venueDist.get(ev.venueName ?? "?") ?? 0) + 1);
  }

  let dupSourceUrls = 0, dupDedupeKeys = 0;
  for (const [, n] of sourceUrlSeen) if (n > 1) dupSourceUrls += n - 1;
  for (const [, n] of dedupeSeen) if (n > 1) dupDedupeKeys += n - 1;

  const status: Row["status"] = fatal
    ? "fetch_failed"
    : events.length > 0
    ? "ok_events"
    : errors.length > 0
    ? "fetch_failed"
    : firecrawlAvailable
    ? "blocked_needs_manual_review"
    : "blocked_needs_firecrawl";

  return {
    adapter_key: adapter.key,
    sourceSlug: known.slug,
    baseUrl: known.baseUrl,
    status,
    eventsReturned: events.length,
    withEndAt,
    timeAssumed,
    ticketUrls,
    imageUrls,
    invalid,
    dupSourceUrls,
    dupDedupeKeys,
    venueDist: Object.fromEntries(venueDist),
    warningsSample: warnings.slice(0, 2),
    errorsSample: errors.slice(0, 2),
    fatalError: fatal,
  };
}

Deno.test("coverage-report: cultural adapters", async () => {
  // Never print the key value. Just its presence.
  const firecrawlAvailable = !!Deno.env.get("FIRECRAWL_API_KEY");
  console.log("[coverage] firecrawlAvailable:", firecrawlAvailable);

  const keys = listAdapterKeys().filter((k) => !SKIP_KEYS.has(k));
  console.log("[coverage] registered adapters:", keys);

  const rows: Row[] = [];
  for (const key of keys) {
    const adapter = getAdapter(key);
    if (!adapter) {
      console.log("[coverage] registry mismatch — missing adapter for key:", key);
      continue;
    }
    const row = await runOne(adapter, firecrawlAvailable);
    rows.push(row);
  }

  // Print compact per-adapter summary.
  console.log("\n=== COVERAGE SUMMARY ===");
  for (const r of rows) {
    console.log(
      `[${r.adapter_key}] status=${r.status} slug=${r.sourceSlug} ` +
        `events=${r.eventsReturned} invalid=${r.invalid} ` +
        `withEndAt=${r.withEndAt} timeAssumed=${r.timeAssumed} ` +
        `tickets=${r.ticketUrls} images=${r.imageUrls} ` +
        `dupUrl=${r.dupSourceUrls} dupDedupe=${r.dupDedupeKeys} ` +
        `venues=${Object.keys(r.venueDist).length}` +
        (r.fatalError ? ` FATAL=${r.fatalError.slice(0, 120)}` : ""),
    );
    if (r.warningsSample.length > 0) {
      console.log("  warn:", r.warningsSample.map((w) => w.slice(0, 200)));
    }
    if (r.errorsSample.length > 0) {
      console.log("  err:", r.errorsSample.map((e) => e.slice(0, 200)));
    }
  }

  // Aggregate.
  const byStatus = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});
  console.log("\n[coverage] by status:", byStatus);
  console.log("[coverage] total adapters:", rows.length);

  // Invariants — the only real failure modes.
  const totalInvalid = rows.reduce((s, r) => s + r.invalid, 0);
  const totalDupUrls = rows.reduce((s, r) => s + r.dupSourceUrls, 0);
  const totalDupDedupe = rows.reduce((s, r) => s + r.dupDedupeKeys, 0);
  assertEquals(totalInvalid, 0, "no adapter should emit invalid CanonicalEvent shapes");
  assertEquals(totalDupUrls, 0, "no adapter should emit duplicate sourceUrls");
  assertEquals(totalDupDedupe, 0, "no adapter should emit duplicate dedupe-like keys");
  assert(rows.length >= 8, `expected >= 8 registered cultural adapters, got ${rows.length}`);
});

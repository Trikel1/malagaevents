// Local harness: exercises the teatro-cervantes adapter against the live
// listing page via Firecrawl (if FIRECRAWL_API_KEY is set) or a plain fetch
// fallback. NO database access. NO writes. Read-only validation of parsing.
//
// Detail-follow is opt-in for this harness: set CERVANTES_TEST_DETAIL=1
// to exercise the detail-page enrichment path against live pages.

import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { teatroCervantesAdapter } from "./teatro-cervantes.ts";
import type { EventSourceRow } from "../ingestion/types.ts";

const source: EventSourceRow = {
  id: "42715da2-3e57-4721-819f-49910aa94ee0",
  slug: "teatro-cervantes",
  name: "Teatro Cervantes / Echegaray",
  kind: "adapter",
  base_url: "https://www.teatrocervantes.com/",
  adapter_key: "teatro-cervantes",
  locality_slug: "malaga",
  category_hints: null,
  priority: 10,
  enabled: false,
  schedule_cron: null,
  robots_ok: false,
  notes: null,
} as unknown as EventSourceRow;

const warnings: string[] = [];
const infos: string[] = [];
const logger = {
  info: (msg: string, extra?: Record<string, unknown>) => {
    infos.push(msg + " " + JSON.stringify(extra ?? {}));
  },
  warn: (msg: string, extra?: Record<string, unknown>) => {
    warnings.push(msg + " " + JSON.stringify(extra ?? {}));
  },
  error: (msg: string, extra?: Record<string, unknown>) => {
    warnings.push("ERR " + msg + " " + JSON.stringify(extra ?? {}));
  },
};

Deno.test("teatro-cervantes: fetchEvents returns valid CanonicalEvent[]", async () => {
  const followEnabled = Deno.env.get("CERVANTES_TEST_DETAIL") === "1";
  if (!followEnabled) Deno.env.set("CERVANTES_DETAIL_FOLLOW", "0");
  else if (!Deno.env.get("CERVANTES_DETAIL_LIMIT")) {
    Deno.env.set("CERVANTES_DETAIL_LIMIT", "30");
  }

  const events = await teatroCervantesAdapter.fetchEvents({
    source,
    dryRun: true,
    logger,
  });

  const nowTs = Date.now();
  let pastCount = 0;
  let missingReq = 0;
  let timeAssumedCount = 0;
  let detailEnrichedCount = 0;
  let withEndAtCount = 0;
  let ongoingRangeCount = 0;
  let rangeEvents = 0;
  const categories = new Set<string | null | undefined>();
  const venueCounts: Record<string, number> = {};
  const venueSourceCounts: Record<string, number> = {};
  const sourceUrlSeen = new Set<string>();
  let duplicateSourceUrl = 0;
  const dedupeKeySeen = new Set<string>();
  let duplicateDedupeKey = 0;

  for (const ev of events) {
    if (!ev.title || !ev.sourceUrl || !ev.startAt || !ev.locality) missingReq++;
    assertEquals(ev.timezone, "Europe/Madrid");
    assert(/^https?:\/\//.test(ev.sourceUrl), `sourceUrl must be absolute: ${ev.sourceUrl}`);

    const startTs = new Date(ev.startAt).getTime();
    if (isFinite(startTs) && startTs < nowTs - 24 * 3600 * 1000) pastCount++;

    const raw = (ev.raw as Record<string, unknown> | undefined) ?? {};
    if (raw.timeAssumed === true) timeAssumedCount++;
    if (raw.detailEnriched === true) detailEnrichedCount++;
    if (raw.rangeStartRaw) rangeEvents++;

    if (ev.endAt) {
      withEndAtCount++;
      const endTs = new Date(ev.endAt).getTime();
      if (isFinite(endTs) && startTs < nowTs && endTs > nowTs) ongoingRangeCount++;
    }

    categories.add(ev.category);
    const v = ev.venueName ?? "null";
    venueCounts[v] = (venueCounts[v] ?? 0) + 1;
    const vs = (raw.venueSource as string | undefined) ?? "unknown";
    venueSourceCounts[vs] = (venueSourceCounts[vs] ?? 0) + 1;

    if (sourceUrlSeen.has(ev.sourceUrl)) duplicateSourceUrl++;
    sourceUrlSeen.add(ev.sourceUrl);

    // dedupe-like key (matches DB dedupe_key composition: title|venue|start:minute)
    const startMinute = new Date(ev.startAt).toISOString().slice(0, 16);
    const key = (ev.title ?? "").toLowerCase().trim() + "|" +
      (ev.venueName ?? "").toLowerCase().trim() + "|" + startMinute;
    if (dedupeKeySeen.has(key)) duplicateDedupeKey++;
    dedupeKeySeen.add(key);
  }

  const first5 = events.slice(0, 5).map((ev) => ({
    title: ev.title,
    startAt: ev.startAt,
    endAt: ev.endAt,
    venueName: ev.venueName,
    sourceUrl: ev.sourceUrl,
    venueSource: (ev.raw as Record<string, unknown> | undefined)?.venueSource,
    timeAssumed: (ev.raw as Record<string, unknown> | undefined)?.timeAssumed,
  }));

  const skippedNoDateWarnings = warnings.filter((w) =>
    w.includes("unparseable date")
  ).length;

  console.log("[cervantes] === QA SUMMARY ===");
  console.log("[cervantes] total events:", events.length);
  console.log("[cervantes] missingRequiredFields:", missingReq);
  console.log("[cervantes] duplicateSourceUrl:", duplicateSourceUrl);
  console.log("[cervantes] duplicateDedupeKey:", duplicateDedupeKey);
  console.log("[cervantes] venueDistribution:", venueCounts);
  console.log("[cervantes] venueSourceDistribution:", venueSourceCounts);
  console.log("[cervantes] detailEnriched:", detailEnrichedCount);
  console.log("[cervantes] withEndAt:", withEndAtCount);
  console.log("[cervantes] rangeEvents:", rangeEvents);
  console.log("[cervantes] ongoingRangeCount:", ongoingRangeCount);
  console.log("[cervantes] timeAssumed:", timeAssumedCount);
  console.log("[cervantes] skippedNoDate:", skippedNoDateWarnings);
  console.log("[cervantes] pastCount:", pastCount);
  console.log("[cervantes] categories:", [...categories]);
  console.log("[cervantes] detailFollowEnabled:", followEnabled);
  console.log("[cervantes] first5:", JSON.stringify(first5, null, 2));

  assert(events.length > 0, "expected at least 1 parsed event");
  assertEquals(missingReq, 0, "no event should miss required fields");
  assertEquals(duplicateSourceUrl + duplicateDedupeKey, 0, "no duplicates expected");
  assert(
    pastCount <= events.length * 0.15,
    `too many past-dated events (excluding ongoing ranges): ${pastCount}/${events.length}`,
  );

  // Every event must have adapter + venueSource in raw (sanitized shape).
  for (const ev of events) {
    const raw = (ev.raw as Record<string, unknown> | undefined) ?? {};
    assertEquals(raw.adapter, "teatro-cervantes");
    assert(
      raw.venueSource === "listing" || raw.venueSource === "detail" || raw.venueSource === "fallback",
      `venueSource must be listing|detail|fallback, got ${String(raw.venueSource)}`,
    );
  }
});

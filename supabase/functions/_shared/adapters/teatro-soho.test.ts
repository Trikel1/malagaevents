// Local harness: exercises the teatro-soho adapter live via Firecrawl
// (or fallback fetch). No DB. No writes. Read-only parsing validation.
// Sprint B: extended metrics for detail-enrichment quality.

import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { teatroSohoAdapter } from "./teatro-soho.ts";
import type { EventSourceRow } from "../ingestion/types.ts";

const source: EventSourceRow = {
  id: "7392b725-0fd4-4c50-8833-bcf8836f0b07",
  slug: "teatro-soho",
  name: "Teatro del Soho CaixaBank",
  kind: "adapter",
  base_url: "https://www.teatrodelsoho.com/",
  adapter_key: "teatro-soho",
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

Deno.test("teatro-soho: fetchEvents returns valid CanonicalEvent[]", async () => {
  const events = await teatroSohoAdapter.fetchEvents({
    source,
    dryRun: true,
    logger,
  });

  console.log("[soho] events returned:", events.length);

  assert(events.length > 0, "expected at least 1 parsed event");

  const now = Date.now();
  let missingReq = 0;
  let pastCount = 0;
  let timeAssumed = 0;
  let detailEnriched = 0;
  let detailFailed = 0;
  let detailTime = 0;
  let withEndAt = 0;
  let ticketCount = 0;
  const venueDist = new Map<string, number>();
  const sourceUrlSeen = new Map<string, number>();
  const dedupeSeen = new Map<string, number>();
  let dupSourceUrls = 0;
  let dupDedupe = 0;

  for (const ev of events) {
    if (!ev.title || !ev.sourceUrl || !ev.startAt || !ev.locality) missingReq++;
    assertEquals(ev.timezone, "Europe/Madrid");
    assert(/^https?:\/\//.test(ev.sourceUrl), `sourceUrl must be absolute: ${ev.sourceUrl}`);

    const t = new Date(ev.startAt).getTime();
    if (isFinite(t) && t < now - 24 * 3600 * 1000) pastCount++;

    const raw = (ev.raw ?? {}) as Record<string, unknown>;
    if (raw.timeAssumed === true) timeAssumed++;
    if (raw.detailEnriched === true) detailEnriched++;
    if (raw.detailFailed === true) detailFailed++;
    if (raw.timeSource === "detail") detailTime++;
    if (ev.endAt) withEndAt++;
    if (ev.ticketUrl) ticketCount++;

    venueDist.set(ev.venueName ?? "?", (venueDist.get(ev.venueName ?? "?") ?? 0) + 1);

    const su = ev.sourceUrl;
    sourceUrlSeen.set(su, (sourceUrlSeen.get(su) ?? 0) + 1);
    const dk = su + "|" + (ev.title ?? "").toLowerCase();
    dedupeSeen.set(dk, (dedupeSeen.get(dk) ?? 0) + 1);
  }

  for (const [, n] of sourceUrlSeen) if (n > 1) dupSourceUrls += n - 1;
  for (const [, n] of dedupeSeen) if (n > 1) dupDedupe += n - 1;

  const first5 = events.slice(0, 5).map((ev) => ({
    title: ev.title,
    startAt: ev.startAt,
    endAt: ev.endAt,
    ticketUrl: ev.ticketUrl,
    timeAssumed: (ev.raw as any)?.timeAssumed,
    timeSource: (ev.raw as any)?.timeSource,
    ticketSource: (ev.raw as any)?.ticketSource,
    detailEnriched: (ev.raw as any)?.detailEnriched,
    sourceUrl: ev.sourceUrl,
  }));

  console.log("[soho] stats:", {
    total: events.length,
    missingReq,
    pastCount,
    dupSourceUrls,
    dupDedupe,
    timeAssumed,
    detailEnriched,
    detailFailed,
    detailTime,
    withEndAt,
    ticketCount,
    venueDist: Object.fromEntries(venueDist),
  });
  console.log("[soho] first5:", JSON.stringify(first5, null, 2));
  console.log("[soho] infos:", infos);
  console.log("[soho] warnings sample:", warnings.slice(0, 5));

  assertEquals(missingReq, 0, "no event should miss required fields");
  assertEquals(dupSourceUrls, 0, "no duplicate sourceUrls expected");
  assertEquals(dupDedupe, 0, "no duplicate dedupe-like keys expected");
});

// Local harness: exercises the teatro-soho adapter live via Firecrawl
// (or fallback fetch). No DB. No writes. Read-only parsing validation.

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
  console.log("[soho] first 5:", JSON.stringify(events.slice(0, 5), null, 2));
  console.log("[soho] infos:", infos);
  console.log("[soho] warnings sample:", warnings.slice(0, 5));

  assert(events.length > 0, "expected at least 1 parsed event");

  const now = Date.now();
  let missingReq = 0;
  let pastCount = 0;
  let timeAssumed = 0;
  const categories = new Set<string | null | undefined>();
  const venues = new Set<string | null | undefined>();
  const dedupe = new Set<string>();
  let duplicates = 0;

  for (const ev of events) {
    if (!ev.title || !ev.sourceUrl || !ev.startAt || !ev.locality) missingReq++;
    assertEquals(ev.timezone, "Europe/Madrid");
    assert(/^https?:\/\//.test(ev.sourceUrl), `sourceUrl must be absolute: ${ev.sourceUrl}`);
    const t = new Date(ev.startAt).getTime();
    if (isFinite(t) && t < now - 24 * 3600 * 1000) pastCount++;
    if ((ev.raw as any)?.timeAssumed === true) timeAssumed++;
    categories.add(ev.category);
    venues.add(ev.venueName);
    const k = ev.sourceUrl + "|" + ev.title;
    if (dedupe.has(k)) duplicates++;
    dedupe.add(k);
  }

  console.log("[soho] stats:", {
    total: events.length,
    missingReq,
    pastCount,
    timeAssumed,
    duplicates,
    categories: [...categories],
    venues: [...venues],
  });

  assertEquals(missingReq, 0, "no event should miss required fields");
  assertEquals(duplicates, 0, "no exact duplicates expected");
});

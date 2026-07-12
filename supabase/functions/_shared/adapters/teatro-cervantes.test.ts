// Local harness: exercises the teatro-cervantes adapter against the live
// listing page via Firecrawl (if FIRECRAWL_API_KEY is set) or a plain fetch
// fallback. NO database access. NO writes. Read-only validation of parsing.

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
  const events = await teatroCervantesAdapter.fetchEvents({
    source,
    dryRun: true,
    logger,
  });

  console.log("[cervantes] events returned:", events.length);
  console.log("[cervantes] first 3:", JSON.stringify(events.slice(0, 3), null, 2));
  console.log("[cervantes] infos:", infos.slice(-3));
  console.log("[cervantes] warnings sample:", warnings.slice(0, 5));

  assert(events.length > 0, "expected at least 1 parsed event");

  const now = Date.now();
  let pastCount = 0;
  let missingReq = 0;
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
    const k = ev.sourceUrl + "|" + ev.title + "|" + ev.startAt;
    if (dedupe.has(k)) duplicates++;
    dedupe.add(k);
  }

  console.log("[cervantes] stats:", {
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
  assert(pastCount <= events.length * 0.05, `too many past-dated events: ${pastCount}/${events.length}`);
});

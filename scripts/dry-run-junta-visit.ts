// Dry-run harness for Bloque 4 adapters (Junta de Andalucía · Cultura Málaga
// + Visit Costa del Sol). Executes both adapters against real endpoints and
// prints a compact JSON summary. No DB writes — adapters return pure
// CanonicalEvent[] arrays.
//
// Usage: FIRECRAWL_API_KEY=… deno run --allow-net --allow-env scripts/dry-run-junta-visit.ts
//
// Bounded to limit=3 per source to keep the run cheap.

import { runJuntaAndalucia } from "../supabase/functions/_shared/adapters/junta-andalucia-cultura.ts";
import { runVisitCostaDelSol } from "../supabase/functions/_shared/adapters/visit-costa-del-sol.ts";
import { generateEventDedupeKey } from "../supabase/functions/_shared/ingestion/dedupe.ts";

const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
if (!apiKey) {
  console.error("FIRECRAWL_API_KEY missing");
  Deno.exit(1);
}

const logs: unknown[] = [];
const logger = {
  info: (m: string, e?: unknown) => logs.push({ l: "info", m, e }),
  warn: (m: string, e?: unknown) => logs.push({ l: "warn", m, e }),
  error: (m: string, e?: unknown) => logs.push({ l: "error", m, e }),
};

async function summarize(label: string, events: Awaited<ReturnType<typeof runJuntaAndalucia>>) {
  const keys = await Promise.all(events.map((e) => generateEventDedupeKey(e, e.venueName)));
  return {
    adapter: label,
    canonicalCount: events.length,
    externalIds: events.map((e) => e.externalId),
    dedupeKeys: keys,
    sample: events.slice(0, 2).map((e) => ({
      externalId: e.externalId,
      title: e.title,
      startAt: e.startAt,
      locality: e.locality,
      venueName: e.venueName,
      sourceUrl: e.sourceUrl,
      organizer: e.organizer,
    })),
  };
}

const junta = await runJuntaAndalucia({ limit: 3, detailDelayMs: 400, logger });
const visit = await runVisitCostaDelSol({
  firecrawl: { apiKey, timeoutMs: 90_000, waitFor: 3000, onlyMainContent: false },
  limit: 3,
  detailDelayMs: 600,
  logger,
});

console.log(JSON.stringify({
  junta: await summarize("junta-andalucia-cultura", junta),
  visit: await summarize("visit-costa-del-sol", visit),
  logs,
}, null, 2));

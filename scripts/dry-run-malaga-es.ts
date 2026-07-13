// Dry-run harness for Bloque 3 malaga.es adapters (Diputación + Culturama).
// Uses Firecrawl real API, limit=3 detail fetches per source to stay cheap.
// No DB writes: adapters are pure functions returning CanonicalEvent[].

import { runDiputacionMalaga } from "../supabase/functions/_shared/adapters/diputacion-malaga.ts";
import { runCulturama } from "../supabase/functions/_shared/adapters/culturama.ts";
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

async function summarize(label: string, events: Awaited<ReturnType<typeof runDiputacionMalaga>>) {
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
      organizer: e.organizer,
      sourceUrl: e.sourceUrl,
    })),
  };
}

const dip = await runDiputacionMalaga({
  firecrawl: { apiKey },
  limit: 3,
  detailDelayMs: 400,
  logger,
});
const cul = await runCulturama({
  firecrawl: { apiKey },
  limit: 3,
  detailDelayMs: 400,
  logger,
});

console.log(JSON.stringify({
  diputacion: await summarize("diputacion-malaga", dip),
  culturama: await summarize("culturama", cul),
  logs,
}, null, 2));

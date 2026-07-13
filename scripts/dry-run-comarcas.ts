// Dry-run harness for Bloque 5 adapters (Axarquía Costa del Sol + Serranía de
// Ronda). Executes both against real endpoints and prints a compact JSON
// summary. No DB writes — adapters return pure CanonicalEvent[] arrays.
//
// Usage: deno run --allow-net --allow-env scripts/dry-run-comarcas.ts
//
// Bounded to limit=3 per source to keep the run cheap.

import { runAxarquia } from "../supabase/functions/_shared/adapters/axarquia-costa-del-sol.ts";
import { runSerrania } from "../supabase/functions/_shared/adapters/serrania-de-ronda.ts";
import { generateEventDedupeKey } from "../supabase/functions/_shared/ingestion/dedupe.ts";

const logs: unknown[] = [];
const logger = {
  info: (m: string, e?: unknown) => logs.push({ l: "info", m, e }),
  warn: (m: string, e?: unknown) => logs.push({ l: "warn", m, e }),
  error: (m: string, e?: unknown) => logs.push({ l: "error", m, e }),
};

async function summarize(
  label: string,
  events: Awaited<ReturnType<typeof runAxarquia>>,
) {
  const keys = await Promise.all(events.map((e) => generateEventDedupeKey(e)));
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
    })),
  };
}

const axarquia = await runAxarquia({ limit: 3, detailDelayMs: 400, logger });
const serrania = await runSerrania({ limit: 3, logger });

const summary = {
  axarquia: await summarize("axarquia-costa-del-sol", axarquia),
  serrania: await summarize("serrania-de-ronda", serrania),
  logs,
};

console.log(JSON.stringify(summary, null, 2));

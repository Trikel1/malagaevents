// Ayuntamiento de Málaga adapter — placeholder for Phase 2A.
//
// This adapter INTENTIONALLY returns [] until Phase 2B implements the real
// scraping. The point of Phase 2A is to validate the modular architecture
// end-to-end (dispatcher -> scrape-source -> adapter -> run/error logging)
// without touching production data.
//
// event_sources row for this adapter must remain: enabled=false, robots_ok=false.

import type { SourceAdapter } from "../ingestion/types.ts";

export const aytoMalagaAdapter: SourceAdapter = {
  key: "ayto-malaga",
  name: "Ayuntamiento de Málaga",
  fetchEvents: async (ctx) => {
    ctx.logger.info("ayto-malaga adapter invoked (placeholder, returns [])", {
      sourceSlug: ctx.source.slug,
      baseUrl: ctx.source.base_url,
      dryRun: ctx.dryRun,
    });
    // NOTE: real scraping is intentionally omitted in Phase 2A.
    // The dispatcher and scrape-source function should still record a
    // successful run with 0 events.
    return await Promise.resolve([]);
  },
};

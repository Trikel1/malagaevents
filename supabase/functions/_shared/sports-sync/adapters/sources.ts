// Per-slug adapter registry. Given a `sports_sources` row (slug + URLs),
// returns a runnable adapter that produces CanonicalSportsEvent[].
//
// The registry is intentionally data-driven: each entry declares its
// municipality, sport category default, and any post-filter. The heavy
// lifting (JSON-LD extraction, ICS parsing) lives in the generic adapters.

import type { CanonicalSportsEvent } from "../types.ts";
import { parseSportsHtml, discoverIcsUrls } from "./html.ts";
import { parseSportsIcs } from "./ics.ts";
import { safeFetch, SafeFetchError } from "../../adapters/lib/http.ts";
import { SPORTS_USER_AGENT } from "../robots.ts";

export interface SourceConfig {
  slug: string;
  municipality: string;
  category: string;
  /** Optional post filter applied after parse. */
  keep?: (ev: CanonicalSportsEvent) => boolean;
  /** If true, try to discover an ICS export URL in the HTML page and prefer it. */
  probeIcsFromHtml?: boolean;
}

const SPORTS_UA = `${SPORTS_USER_AGENT}/1.0 (+https://malagaevents.lovable.app)`;

const FETCH_OPTS = {
  timeoutMs: 20000,
  retries: 2,
  maxBytes: 4 * 1024 * 1024,
  maxRedirects: 5,
  accept: "text/html,application/xhtml+xml,text/calendar;q=0.9,*/*;q=0.5",
  headers: { "User-Agent": SPORTS_UA },
};

export const SOURCE_CONFIGS: Record<string, SourceConfig> = {
  "malaga-capital-deportes": {
    slug: "malaga-capital-deportes",
    municipality: "Málaga",
    category: "other",
    probeIcsFromHtml: true,
  },
  "diputacion-malaga-deportes": {
    slug: "diputacion-malaga-deportes",
    municipality: "Diputación de Málaga",
    category: "other",
    probeIcsFromHtml: true,
  },
  "torremolinos-deportes": {
    slug: "torremolinos-deportes",
    municipality: "Torremolinos",
    category: "other",
    probeIcsFromHtml: true,
  },
  "rincon-victoria-deportes": {
    slug: "rincon-victoria-deportes",
    municipality: "Rincón de la Victoria",
    category: "other",
    probeIcsFromHtml: true,
  },
  "velez-malaga-deportes": {
    slug: "velez-malaga-deportes",
    municipality: "Vélez-Málaga",
    category: "other",
    probeIcsFromHtml: true,
  },
  "fuengirola-deportes": {
    slug: "fuengirola-deportes",
    municipality: "Fuengirola",
    category: "other",
    probeIcsFromHtml: true,
  },
  "ronda-turismo-agenda": {
    slug: "ronda-turismo-agenda",
    municipality: "Ronda",
    category: "other",
    probeIcsFromHtml: true,
  },
  "unicaja-baloncesto": {
    slug: "unicaja-baloncesto",
    municipality: "Málaga",
    category: "basketball",
    probeIcsFromHtml: true,
  },
};

export interface RunOutcome {
  events: CanonicalSportsEvent[];
  adapterUsed: "html" | "ics";
  discoveredIcs?: string | null;
  notes: string[];
}

/**
 * Adapter runner: given a source_type + primary_url, fetches and parses.
 * Never throws for empty results — throws only on network/parse hard errors,
 * which the caller records as an error run without deactivating events.
 */
export async function runSourceAdapter(input: {
  slug: string;
  sourceType: "html" | "ics" | "rss" | "json";
  primaryUrl: string;
  sourceName?: string;
}): Promise<RunOutcome> {
  const cfg = SOURCE_CONFIGS[input.slug] ?? {
    slug: input.slug,
    municipality: "Málaga",
    category: "other",
    probeIcsFromHtml: false,
  };
  const sourceName = input.sourceName ?? input.slug;
  const notes: string[] = [];

  // ICS type: fetch text, parse directly.
  if (input.sourceType === "ics") {
    const res = await safeFetch(input.primaryUrl, FETCH_OPTS);
    const events = parseSportsIcs(res.body, {
      sourceName,
      sourceUrl: input.primaryUrl,
      defaultMunicipality: cfg.municipality,
      defaultCategory: cfg.category,
      keep: cfg.keep,
    });
    return { events, adapterUsed: "ics", notes };
  }

  // HTML type: fetch page, try JSON-LD Events. If ICS discovery is enabled,
  // and a .ics link exists on the page, also parse the ICS and merge.
  if (input.sourceType === "html") {
    const page = await safeFetch(input.primaryUrl, FETCH_OPTS);
    const htmlEvents = parseSportsHtml(page.body, {
      sourceName,
      sourceUrl: input.primaryUrl,
      defaultMunicipality: cfg.municipality,
      defaultCategory: cfg.category,
      keep: cfg.keep,
      baseUrl: page.finalUrl,
    });

    let icsUrl: string | null = null;
    if (cfg.probeIcsFromHtml) {
      const candidates = discoverIcsUrls(page.body, page.finalUrl);
      if (candidates.length > 0) {
        icsUrl = candidates[0];
        notes.push(`discovered_ics:${icsUrl}`);
      }
    }
    let icsEvents: CanonicalSportsEvent[] = [];
    if (icsUrl) {
      try {
        const ics = await safeFetch(icsUrl, FETCH_OPTS);
        icsEvents = parseSportsIcs(ics.body, {
          sourceName,
          sourceUrl: icsUrl,
          defaultMunicipality: cfg.municipality,
          defaultCategory: cfg.category,
          keep: cfg.keep,
        });
      } catch (e) {
        const msg = e instanceof SafeFetchError ? e.code : "unknown";
        notes.push(`ics_fetch_failed:${msg}`);
      }
    }

    // Merge: prefer ICS entries by UID; HTML entries fill gaps.
    const byKey = new Map<string, CanonicalSportsEvent>();
    for (const e of htmlEvents) byKey.set(e.external_id ?? `${e.title}|${e.starts_at}`, e);
    for (const e of icsEvents) byKey.set(e.external_id ?? `${e.title}|${e.starts_at}`, e);
    return {
      events: [...byKey.values()],
      adapterUsed: icsEvents.length > 0 ? "ics" : "html",
      discoveredIcs: icsUrl,
      notes,
    };
  }

  throw new Error(`adapter_not_supported:${input.sourceType}`);
}

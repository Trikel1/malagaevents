// Ayuntamiento de Málaga adapter — Phase 2B real fetcher.
//
// Uses Firecrawl to pull the events listing markdown, then extracts candidate
// events with the Lovable AI Gateway. Only runs when the caller explicitly
// invokes it (adapter code path is guarded by scrape-source, which itself is
// only reachable via SYNC_ADMIN_KEY + WRITE_ENABLED for real writes).
//
// SAFETY:
// - No side effects on the database — this function only returns
//   CanonicalEvent[]. Insertion is the caller's responsibility and is still
//   gated by WRITE_ENABLED=false in scrape-source.
// - If FIRECRAWL_API_KEY or LOVABLE_API_KEY are missing, returns [] with a
//   logged warning. Never throws for missing config.
// - Requests use only Firecrawl's public API (respects Firecrawl's own robots
//   handling). We also stop early on non-200 responses.

import type { SourceAdapter, CanonicalEvent } from "../ingestion/types.ts";
import { parseSpanishDateToMadrid } from "../ingestion/dates.ts";

const FIRECRAWL_V2 = "https://api.firecrawl.dev/v2";
const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

async function firecrawlScrape(url: string, apiKey: string) {
  const res = await fetch(`${FIRECRAWL_V2}/scrape`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      formats: ["markdown"],
      onlyMainContent: true,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`firecrawl_${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  const markdown: string | undefined = data?.markdown ?? data?.data?.markdown;
  return markdown ?? "";
}

async function extractWithAi(
  markdown: string,
  sourceUrl: string,
  apiKey: string,
): Promise<CanonicalEvent[]> {
  const prompt = `Extract events from the following markdown from ${sourceUrl}. Return ONLY a JSON array (no prose, no fences) of objects with keys: title (string), startAt (ISO 8601 or Spanish date like "12 de julio de 2026 20:30"), endAt (optional), venueName (optional string), venueAddress (optional string), locality (string, e.g. "Málaga"), category (optional), description (optional), imageUrl (optional), ticketUrl (optional), priceText (optional). Skip anything without a clear date. Max 30 items.

MARKDOWN:
${markdown.slice(0, 12000)}`;

  const res = await fetch(AI_GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "You are a strict JSON extractor. Output ONLY valid JSON arrays." },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`ai_gateway_${res.status}`);
  const data = await res.json();
  const raw: string = data?.choices?.[0]?.message?.content ?? "[]";
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const out: CanonicalEvent[] = [];
  for (const item of parsed as Array<Record<string, unknown>>) {
    const title = typeof item.title === "string" ? item.title.trim() : "";
    const startAtRaw = typeof item.startAt === "string" ? item.startAt : "";
    const locality = typeof item.locality === "string" && item.locality.trim() ? item.locality.trim() : "Málaga";
    if (!title || !startAtRaw) continue;
    const dt = parseSpanishDateToMadrid(startAtRaw);
    if (!dt) continue;

    out.push({
      title,
      description: typeof item.description === "string" ? item.description : null,
      startAt: dt.toISOString(),
      endAt: typeof item.endAt === "string" ? (parseSpanishDateToMadrid(item.endAt)?.toISOString() ?? null) : null,
      timezone: "Europe/Madrid",
      venueName: typeof item.venueName === "string" ? item.venueName : null,
      venueAddress: typeof item.venueAddress === "string" ? item.venueAddress : null,
      locality,
      category: typeof item.category === "string" ? item.category : null,
      imageUrl: typeof item.imageUrl === "string" ? item.imageUrl : null,
      sourceUrl,
      ticketUrl: typeof item.ticketUrl === "string" ? item.ticketUrl : null,
      priceText: typeof item.priceText === "string" ? item.priceText : null,
      raw: null,
    });
  }
  return out;
}

export const aytoMalagaAdapter: SourceAdapter = {
  key: "ayto-malaga",
  name: "Ayuntamiento de Málaga",
  fetchEvents: async (ctx) => {
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    const aiKey = Deno.env.get("LOVABLE_API_KEY");
    const url = ctx.source.base_url;

    if (!firecrawlKey || !aiKey) {
      ctx.logger.warn("ayto-malaga: missing API keys, returning []", {
        hasFirecrawl: !!firecrawlKey,
        hasAi: !!aiKey,
      });
      return [];
    }
    if (!url) {
      ctx.logger.warn("ayto-malaga: base_url missing on source row");
      return [];
    }

    try {
      const md = await firecrawlScrape(url, firecrawlKey);
      if (!md) {
        ctx.logger.warn("ayto-malaga: empty markdown");
        return [];
      }
      const events = await extractWithAi(md, url, aiKey);
      ctx.logger.info("ayto-malaga: extracted", { count: events.length, dryRun: ctx.dryRun });
      return events;
    } catch (e) {
      ctx.logger.error("ayto-malaga: fetch failed", { error: (e as Error).message });
      return [];
    }
  },
};

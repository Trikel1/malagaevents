// Shared Firecrawl v2 helpers for malaga.es adapters
// (Diputación de Málaga · Agenda provincial and Culturama).
//
// Both sources sit behind CloudFront with browser-fingerprint filtering, so we
// only reach them via Firecrawl. Robots.txt served by `www.malaga.es` is empty
// (no rules → allowed for all bots). Terms of use of Diputación de Málaga
// permit non-commercial reproduction of institutional content citing the
// source (art. 8, Aviso Legal). See docs/agenda-preflight/*.md for evidence.
//
// SAFETY:
// - No writes. Never imports @supabase/supabase-js.
// - Requires FIRECRAWL_API_KEY. If missing, adapters must skip gracefully.
// - Detail fetch is bounded (default 25 URLs per run) and serialised with a
//   small delay to stay well under Firecrawl per-second quotas.

const FIRECRAWL_V2 = "https://api.firecrawl.dev/v2";

export interface FirecrawlPage {
  markdown: string;
  links: string[];
}

export interface FirecrawlDeps {
  apiKey: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export async function firecrawlScrapePage(
  url: string,
  deps: FirecrawlDeps,
): Promise<FirecrawlPage> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), deps.timeoutMs ?? 60_000);
  try {
    const res = await fetchImpl(`${FIRECRAWL_V2}/scrape`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${deps.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown", "links"],
        onlyMainContent: true,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`firecrawl_${res.status}: ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    const payload = (data?.data ?? data) as {
      markdown?: string;
      links?: unknown;
    };
    const markdown = typeof payload.markdown === "string" ? payload.markdown : "";
    const links = Array.isArray(payload.links)
      ? (payload.links as unknown[]).filter(
          (x): x is string => typeof x === "string",
        )
      : [];
    return { markdown, links };
  } finally {
    clearTimeout(t);
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}



# Phase 3.1: Replace Firecrawl with Jina Reader + AI extraction for Sports

## Problem
Many sports sites (Unicaja, BeSoccer, Sportmaniacs, etc.) are JS-heavy SPAs that Firecrawl cannot render, returning empty results.

## Solution: 2-Step Pipeline
Replace Firecrawl's single-call approach with a two-step pipeline:

1. **Jina Reader** (`https://r.jina.ai/{url}`) -- renders JS-heavy pages via headless browser and returns clean markdown. Free tier available, no API key required for basic usage.
2. **Lovable AI Gateway** (Gemini Flash) -- takes the markdown and extracts structured event JSON using the existing `SPORT_EVENT_SCHEMA`. The `LOVABLE_API_KEY` is already configured.

This approach handles JS-heavy sites because Jina Reader uses a real headless browser under the hood.

## Changes

### 1. Replace `scrapeSource()` in `supabase/functions/sync-sports/index.ts`

Replace the single Firecrawl call with two sequential calls:

```text
scrapeSource(url, prompt, apiKey)
  becomes
scrapeWithJinaAndAI(url, prompt)
  Step 1: fetch("https://r.jina.ai/{url}") -> markdown
  Step 2: POST Lovable AI Gateway with markdown + prompt -> structured JSON
```

- Jina Reader call: `GET https://r.jina.ai/{encoded_url}` with `Accept: application/json` header (returns `{ content: "..." }` with rendered markdown)
- AI extraction call: `POST https://ai.gateway.lovable.dev/v1/chat/completions` with `LOVABLE_API_KEY`, using `google/gemini-2.5-flash` model and tool calling to extract events matching the existing schema
- Keep the 45s timeout, abort controller pattern
- Fall back to Firecrawl if Jina Reader fails (graceful degradation)

### 2. Replace `searchSportsEvents()` 

Keep using Firecrawl Search API for web discovery queries (Jina Reader doesn't do web search). No change needed here.

### 3. Remove Firecrawl as hard dependency

- `FIRECRAWL_API_KEY` becomes optional for source scraping (still needed for search discovery)
- If neither Jina nor Firecrawl succeed, log and skip gracefully

### 4. Update domain allowlist

Jina Reader fetches the page server-side, so the allowlist check should validate the *target* URL before passing to Jina, not Jina's domain. No structural change needed -- just keep the existing check on `source.url`.

## Technical Details

### Jina Reader Request
```typescript
const jinaResponse = await fetch(`https://r.jina.ai/${encodeURIComponent(url)}`, {
  headers: { "Accept": "application/json" },
  signal: controller.signal,
});
const { content } = await jinaResponse.json(); // markdown string
```

### AI Extraction Request
```typescript
const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${lovableApiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "google/gemini-2.5-flash",
    messages: [
      { role: "system", content: "Extract sports events from the provided webpage content." },
      { role: "user", content: `${prompt}\n\nWebpage content:\n${content.substring(0, 30000)}` },
    ],
    tools: [{
      type: "function",
      function: {
        name: "extract_events",
        parameters: SPORT_EVENT_SCHEMA,
      },
    }],
    tool_choice: { type: "function", function: { name: "extract_events" } },
  }),
});
```

### Fallback Chain
```text
For each source:
  1. Try Jina Reader + Gemini extraction
  2. If Jina fails -> try Firecrawl (if API key available)
  3. If both fail -> log error, skip source
```

## Files Modified
- `supabase/functions/sync-sports/index.ts` -- replace `scrapeSource`, add `scrapeWithJinaAndAI`, keep `searchSportsEvents` unchanged

## No Frontend Changes
This is entirely a backend pipeline change. The sports events UI, hooks, and filters remain untouched.


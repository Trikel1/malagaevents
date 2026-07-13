// Shared harness helper for institutional/museum adapters.
// Read-only: exercises the adapter live via Firecrawl or plain fetch and
// asserts CanonicalEvent invariants. Tolerates empty listings gracefully
// so a source that has no current events (or changed structure) does NOT
// fail the test suite — instead it logs `no_current_events`.

import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import type { CanonicalEvent, EventSourceRow, SourceAdapter } from "../../ingestion/types.ts";

export function makeStubSource(slug: string, adapterKey: string, baseUrl: string): EventSourceRow {
  return {
    id: "00000000-0000-0000-0000-000000000000",
    slug,
    name: slug,
    kind: "adapter",
    base_url: baseUrl,
    adapter_key: adapterKey,
    locality_slug: "malaga",
    category_hints: null,
    priority: 10,
    enabled: false,
    schedule_cron: null,
    robots_ok: false,
    notes: null,
  } as unknown as EventSourceRow;
}

export function makeLogger() {
  const warnings: string[] = [];
  const infos: string[] = [];
  const errors: string[] = [];
  return {
    warnings,
    infos,
    errors,
    logger: {
      info: (msg: string, extra?: Record<string, unknown>) =>
        infos.push(msg + " " + JSON.stringify(extra ?? {})),
      warn: (msg: string, extra?: Record<string, unknown>) =>
        warnings.push(msg + " " + JSON.stringify(extra ?? {})),
      error: (msg: string, extra?: Record<string, unknown>) =>
        errors.push(msg + " " + JSON.stringify(extra ?? {})),
    },
  };
}

export function assertCanonicalInvariants(
  label: string,
  events: CanonicalEvent[],
): {
  timeAssumed: number;
  withEndAt: number;
  ticketCount: number;
  venueDist: Record<string, number>;
} {
  const now = Date.now();
  let missingReq = 0;
  let pastCount = 0;
  let timeAssumed = 0;
  let withEndAt = 0;
  let ticketCount = 0;
  const venueDist = new Map<string, number>();

  for (const ev of events) {
    if (!ev.title || !ev.sourceUrl || !ev.startAt || !ev.locality) missingReq++;
    assertEquals(ev.timezone, "Europe/Madrid", `${label}: timezone must be Europe/Madrid`);
    assert(/^https?:\/\//.test(ev.sourceUrl), `${label}: sourceUrl must be absolute`);
    const t = new Date(ev.startAt).getTime();
    if (isFinite(t) && t < now - 24 * 3600 * 1000) pastCount++;
    const raw = (ev.raw ?? {}) as Record<string, unknown>;
    if (raw.timeAssumed === true) timeAssumed++;
    if (ev.endAt) withEndAt++;
    if (ev.ticketUrl) ticketCount++;
    venueDist.set(ev.venueName ?? "?", (venueDist.get(ev.venueName ?? "?") ?? 0) + 1);
  }

  assertEquals(missingReq, 0, `${label}: no event should miss required fields`);
  console.log(`[${label}] stats:`, {
    total: events.length,
    pastCount,
    timeAssumed,
    withEndAt,
    ticketCount,
    venueDist: Object.fromEntries(venueDist),
  });

  return {
    timeAssumed,
    withEndAt,
    ticketCount,
    venueDist: Object.fromEntries(venueDist),
  };
}

export async function runAdapterHarness(adapter: SourceAdapter, baseUrl: string): Promise<void> {
  const source = makeStubSource(adapter.key, adapter.key, baseUrl);
  const { logger, warnings, infos, errors } = makeLogger();
  const events = await adapter.fetchEvents({ source, dryRun: true, logger });
  console.log(`[${adapter.key}] events returned:`, events.length);
  if (events.length === 0) {
    console.log(`[${adapter.key}] no_current_events — non-fatal`);
    console.log(`[${adapter.key}] warnings sample:`, warnings.slice(0, 5));
    console.log(`[${adapter.key}] errors sample:`, errors.slice(0, 5));
    return;
  }
  assertCanonicalInvariants(adapter.key, events);
  console.log(`[${adapter.key}] first3:`, JSON.stringify(events.slice(0, 3), null, 2));
  console.log(`[${adapter.key}] infos sample:`, infos.slice(0, 5));
}

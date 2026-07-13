import { laTermicaAdapter } from "./la-termica.ts";
import { runAdapterHarness } from "./lib/harness.ts";
import { validateEvents, formatReport } from "./lib/data-quality.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("la-termica: dry-run harness (WP-JSON dedicated)", async () => {
  await runAdapterHarness(laTermicaAdapter, "https://www.latermicamalaga.com/");
});

Deno.test("la-termica: data-quality gate — never emits midnight-UTC or 0-6 local", async () => {
  const source = {
    id: "00000000-0000-0000-0000-000000000000",
    slug: "la-termica",
    name: "la-termica",
    kind: "adapter",
    base_url: "https://www.latermicamalaga.com/",
    adapter_key: "la-termica",
    locality_slug: "malaga",
    category_hints: null,
    priority: 10,
    enabled: false,
    schedule_cron: null,
    robots_ok: false,
    notes: null,
  // deno-lint-ignore no-explicit-any
  } as any;
  const logs: string[] = [];
  const logger = {
    info: (m: string, e?: Record<string, unknown>) => logs.push("i " + m + " " + JSON.stringify(e ?? {})),
    warn: (m: string, e?: Record<string, unknown>) => logs.push("w " + m + " " + JSON.stringify(e ?? {})),
    error: (m: string, e?: Record<string, unknown>) => logs.push("e " + m + " " + JSON.stringify(e ?? {})),
  };
  const events = await laTermicaAdapter.fetchEvents({ source, dryRun: true, logger });
  const report = validateEvents("la-termica", events);
  console.log(formatReport(report));
  console.log(`la-termica: emitted ${events.length} events`);
  // Hard gate: adapter must never emit hard errors, regardless of live count.
  assertEquals(
    report.errors.length,
    0,
    `la-termica must emit zero data-quality errors, got: ${report.errors.slice(0, 3).map((e) => e.code).join(", ")}`,
  );
});

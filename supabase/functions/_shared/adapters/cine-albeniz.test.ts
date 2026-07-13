import { cineAlbenizAdapter } from "./cine-albeniz.ts";
import { runAdapterHarness } from "./lib/harness.ts";

Deno.test("cine-albeniz: dry-run harness", async () => {
  await runAdapterHarness(cineAlbenizAdapter, "https://cinealbeniz.com/");
});

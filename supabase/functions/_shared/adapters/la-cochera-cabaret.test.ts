import { laCocheraCabaretAdapter } from "./la-cochera-cabaret.ts";
import { runAdapterHarness } from "./lib/harness.ts";

Deno.test("la-cochera-cabaret: dry-run harness", async () => {
  await runAdapterHarness(laCocheraCabaretAdapter, "https://www.lacocheracabaret.com/");
});

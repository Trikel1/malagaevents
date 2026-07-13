import { mvaAdapter } from "./mva.ts";
import { runAdapterHarness } from "./lib/harness.ts";

Deno.test("mva: dry-run harness", async () => {
  await runAdapterHarness(mvaAdapter, "https://www.malaga.es/mva/");
});

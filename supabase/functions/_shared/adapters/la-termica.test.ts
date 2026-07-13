import { laTermicaAdapter } from "./la-termica.ts";
import { runAdapterHarness } from "./lib/harness.ts";

Deno.test("la-termica: dry-run harness", async () => {
  await runAdapterHarness(laTermicaAdapter, "https://www.latermicamalaga.com/");
});

import { salaTrincheraAdapter } from "./sala-trinchera.ts";
import { runAdapterHarness } from "./lib/harness.ts";

Deno.test("sala-trinchera: dry-run harness", async () => {
  await runAdapterHarness(salaTrincheraAdapter, "https://salatrinchera.com/");
});

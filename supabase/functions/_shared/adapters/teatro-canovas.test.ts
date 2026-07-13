import { teatroCanovasAdapter } from "./teatro-canovas.ts";
import { runAdapterHarness } from "./lib/harness.ts";

Deno.test("teatro-canovas: dry-run harness", async () => {
  await runAdapterHarness(
    teatroCanovasAdapter,
    "https://www.juntadeandalucia.es/cultura/aaiicc/teatros/teatro-canovas",
  );
});

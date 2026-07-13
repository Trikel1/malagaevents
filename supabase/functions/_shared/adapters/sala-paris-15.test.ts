import { salaParis15Adapter } from "./sala-paris-15.ts";
import { runAdapterHarness } from "./lib/harness.ts";

Deno.test("sala-paris-15: dry-run harness", async () => {
  await runAdapterHarness(salaParis15Adapter, "https://www.paris15.es/");
});

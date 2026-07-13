import { museoThyssenAdapter } from "./museo-thyssen.ts";
import { runAdapterHarness } from "./lib/harness.ts";

Deno.test("museo-thyssen: dry-run harness", async () => {
  await runAdapterHarness(museoThyssenAdapter, "https://www.carmenthyssenmalaga.org/");
});

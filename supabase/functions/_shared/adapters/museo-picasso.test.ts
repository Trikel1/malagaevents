import { museoPicassoAdapter } from "./museo-picasso.ts";
import { runAdapterHarness } from "./lib/harness.ts";

Deno.test("museo-picasso: dry-run harness", async () => {
  await runAdapterHarness(museoPicassoAdapter, "https://www.museopicassomalaga.org/");
});

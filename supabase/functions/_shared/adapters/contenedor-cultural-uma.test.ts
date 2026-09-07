import { contenedorCulturalUmaAdapter } from "./contenedor-cultural-uma.ts";
import { runAdapterHarness } from "./lib/harness.ts";

Deno.test("contenedor-cultural-uma: dry-run harness", async () => {
  await runAdapterHarness(
    contenedorCulturalUmaAdapter,
    "https://www.uma.es/contenedorcultural/",
  );
});

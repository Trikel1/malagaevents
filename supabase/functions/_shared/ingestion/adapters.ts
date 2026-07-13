// Adapter registry. Adapters are pure functions from EventSourceRow -> CanonicalEvent[].
// Phase 2A ships ONE placeholder adapter (ayto-malaga) that returns []
// so the architecture can be exercised end-to-end without scraping.

import type { SourceAdapter } from "./types.ts";
import { aytoMalagaAdapter } from "../adapters/ayto-malaga.ts";
import { aytoMalagaCsvAdapter } from "../adapters/ayto-malaga-csv.ts";
import { teatroCervantesAdapter } from "../adapters/teatro-cervantes.ts";
import { teatroSohoAdapter } from "../adapters/teatro-soho.ts";
import { teatroCanovasAdapter } from "../adapters/teatro-canovas.ts";
import { laTermicaAdapter } from "../adapters/la-termica.ts";
import { mvaAdapter } from "../adapters/mva.ts";
import { museoPicassoAdapter } from "../adapters/museo-picasso.ts";
import { museoThyssenAdapter } from "../adapters/museo-thyssen.ts";
import { salaTrincheraAdapter } from "../adapters/sala-trinchera.ts";
import { salaParis15Adapter } from "../adapters/sala-paris-15.ts";
import { laCocheraCabaretAdapter } from "../adapters/la-cochera-cabaret.ts";
import { contenedorCulturalUmaAdapter } from "../adapters/contenedor-cultural-uma.ts";
import { cineAlbenizAdapter } from "../adapters/cine-albeniz.ts";

const REGISTRY = new Map<string, SourceAdapter>();

function register(adapter: SourceAdapter) {
  REGISTRY.set(adapter.key, adapter);
}

register(aytoMalagaAdapter);
register(teatroCervantesAdapter);
register(teatroSohoAdapter);
register(teatroCanovasAdapter);
register(laTermicaAdapter);
register(mvaAdapter);
register(museoPicassoAdapter);
register(museoThyssenAdapter);
register(salaTrincheraAdapter);
register(salaParis15Adapter);
register(laCocheraCabaretAdapter);
register(contenedorCulturalUmaAdapter);
register(cineAlbenizAdapter);

export function getAdapter(key: string | null | undefined): SourceAdapter | null {
  if (!key) return null;
  return REGISTRY.get(key) ?? null;
}

export function listAdapterKeys(): string[] {
  return Array.from(REGISTRY.keys());
}

// Adapter registry. Adapters are pure functions from EventSourceRow -> CanonicalEvent[].
// Phase 2A ships ONE placeholder adapter (ayto-malaga) that returns []
// so the architecture can be exercised end-to-end without scraping.

import type { SourceAdapter } from "./types.ts";
import { aytoMalagaAdapter } from "../adapters/ayto-malaga.ts";
import { teatroCervantesAdapter } from "../adapters/teatro-cervantes.ts";
import { teatroSohoAdapter } from "../adapters/teatro-soho.ts";

const REGISTRY = new Map<string, SourceAdapter>();

function register(adapter: SourceAdapter) {
  REGISTRY.set(adapter.key, adapter);
}

register(aytoMalagaAdapter);
register(teatroCervantesAdapter);
register(teatroSohoAdapter);

export function getAdapter(key: string | null | undefined): SourceAdapter | null {
  if (!key) return null;
  return REGISTRY.get(key) ?? null;
}

export function listAdapterKeys(): string[] {
  return Array.from(REGISTRY.keys());
}

// Locality alias resolver — READ ONLY.
// If the alias table has a match, returns { locationId, municipioSlug }.
// Never creates localities automatically in Phase 2A.

import { normalizeLocality } from "./normalize.ts";

type MinimalClient = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
      };
    };
  };
};

export type ResolvedLocality = {
  locationId: string | null;
  municipioSlug: string | null;
};

export async function resolveLocalityAlias(
  supabase: MinimalClient,
  locality: string | null | undefined,
): Promise<ResolvedLocality> {
  if (!locality) return { locationId: null, municipioSlug: null };
  const aliasNormalized = normalizeLocality(locality);
  if (!aliasNormalized) return { locationId: null, municipioSlug: null };

  const { data, error } = await supabase
    .from("locality_aliases")
    .select("location_id, municipio_slug")
    .eq("alias_normalized", aliasNormalized)
    .maybeSingle();

  if (error || !data) return { locationId: null, municipioSlug: null };
  const row = data as { location_id: string | null; municipio_slug: string | null };
  return { locationId: row.location_id, municipioSlug: row.municipio_slug };
}

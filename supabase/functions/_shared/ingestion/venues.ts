// Venue alias resolver — READ ONLY.
// If the alias table has a match, returns { venueId, canonicalName }.
// Never creates venues automatically in Phase 2A.

import { normalizeVenueName } from "./normalize.ts";

type MinimalClient = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
      };
    };
  };
};

export type ResolvedVenue = {
  venueId: string | null;
  canonicalName: string | null;
};

export async function resolveVenueAlias(
  supabase: MinimalClient,
  venueName: string | null | undefined,
): Promise<ResolvedVenue> {
  if (!venueName) return { venueId: null, canonicalName: null };
  const aliasNormalized = normalizeVenueName(venueName);
  if (!aliasNormalized) return { venueId: null, canonicalName: null };

  const { data, error } = await supabase
    .from("venue_aliases")
    .select("venue_id, canonical_name")
    .eq("alias_normalized", aliasNormalized)
    .maybeSingle();

  if (error || !data) return { venueId: null, canonicalName: null };
  const row = data as { venue_id: string | null; canonical_name: string | null };
  return { venueId: row.venue_id, canonicalName: row.canonical_name };
}

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Municipality {
  id: string;
  ine_code: string;
  name: string;
  slug: string;
  comarca: string;
  latitude: number | null;
  longitude: number | null;
  active: boolean;
}

export interface MunicipalityAlias {
  id: string;
  municipality_id: string;
  alias: string;
  alias_normalized: string;
  alias_type: string;
}

/** All active Málaga municipalities, ordered by name. */
export const useMunicipalities = () => {
  return useQuery({
    queryKey: ['municipalities'],
    staleTime: 1000 * 60 * 60,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('municipalities' as never)
        .select('*')
        .eq('active', true)
        .order('name', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Municipality[];
    },
  });
};

/** All aliases (used for accent-insensitive search & núcleo resolution). */
export const useMunicipalityAliases = () => {
  return useQuery({
    queryKey: ['municipality-aliases'],
    staleTime: 1000 * 60 * 60,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('municipality_aliases' as never)
        .select('*');
      if (error) throw error;
      return (data ?? []) as unknown as MunicipalityAlias[];
    },
  });
};

export const useMunicipalityBySlug = (slug: string | undefined) => {
  return useQuery({
    queryKey: ['municipality', slug],
    enabled: !!slug,
    queryFn: async () => {
      if (!slug) return null;
      const { data, error } = await supabase
        .from('municipalities' as never)
        .select('*')
        .eq('slug', slug)
        .eq('active', true)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as Municipality | null;
    },
  });
};

/**
 * Accent-insensitive local filter combining name + comarca + aliases.
 * The list of municipalities is tiny (103), so client-side filtering is
 * cheaper than an RPC round-trip.
 */
export function filterMunicipalities(
  query: string,
  municipalities: Municipality[],
  aliases: MunicipalityAlias[],
): Municipality[] {
  const q = query
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (!q) return municipalities;

  const aliasHits = new Set(
    aliases
      .filter((a) => a.alias_normalized.includes(q))
      .map((a) => a.municipality_id),
  );

  const norm = (s: string) =>
    s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  return municipalities.filter(
    (m) =>
      norm(m.name).includes(q) ||
      norm(m.comarca).includes(q) ||
      aliasHits.has(m.id),
  );
}

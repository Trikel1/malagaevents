import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { SportsEntity, SportsEntityType } from '@/types/sportsEntities';

/**
 * Fetch normalized sports entities from `public.sports_entities`.
 * Type is cast because the generated types are refreshed lazily.
 */
async function fetchSportsEntities(
  entityType?: SportsEntityType,
): Promise<SportsEntity[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = (supabase as any)
    .from('sports_entities')
    .select('*')
    .in('status', ['verified', 'needs_review'])
    .order('entity_type', { ascending: true })
    .order('name', { ascending: true });

  if (entityType) query = query.eq('entity_type', entityType);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as SportsEntity[];
}

export function useSportsEntities(entityType?: SportsEntityType) {
  return useQuery({
    queryKey: ['sports-entities', entityType ?? 'all'],
    queryFn: () => fetchSportsEntities(entityType),
    staleTime: 5 * 60_000,
  });
}

/** Convenience: only the official sources. */
export function useSportsOfficialSources() {
  return useSportsEntities('source');
}

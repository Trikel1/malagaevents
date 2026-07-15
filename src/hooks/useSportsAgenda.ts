import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatInTimeZone } from 'date-fns-tz';
import type { SportsEntity } from '@/types/sportsEntities';

const TIMEZONE = 'Europe/Madrid';

export type AgendaWindow = 'today' | '7d' | '30d' | 'all' | 'past';

function todayMadrid(): string {
  return formatInTimeZone(new Date(), TIMEZONE, 'yyyy-MM-dd');
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export interface AgendaFilters {
  window: AgendaWindow;
  sport?: string;
  type?: 'match' | 'tournament' | 'activity' | 'all';
}

/**
 * Fetch verified agenda entries (matches, tournaments, activities with a
 * concrete date_start). Municipal category placeholders — activities without
 * date_start — are excluded so the agenda never surfaces them as events.
 */
async function fetchAgenda(filters: AgendaFilters): Promise<SportsEntity[]> {
  const today = todayMadrid();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = (supabase as any)
    .from('sports_entities')
    .select('*')
    .in('entity_type', ['match', 'tournament', 'activity'])
    .not('date_start', 'is', null)
    .eq('status', 'verified')
    .order('date_start', { ascending: filters.window !== 'past' });

  if (filters.window === 'today') {
    q = q.eq('date_start', today);
  } else if (filters.window === '7d') {
    q = q.gte('date_start', today).lte('date_start', addDays(today, 7));
  } else if (filters.window === '30d') {
    q = q.gte('date_start', today).lte('date_start', addDays(today, 30));
  } else if (filters.window === 'past') {
    q = q.lt('date_start', today);
  } else {
    q = q.gte('date_start', today);
  }

  if (filters.sport && filters.sport !== 'all') q = q.eq('sport', filters.sport);
  if (filters.type && filters.type !== 'all') q = q.eq('entity_type', filters.type);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as SportsEntity[];
}

export function useSportsAgenda(filters: AgendaFilters) {
  return useQuery({
    queryKey: ['sports-agenda', filters],
    queryFn: () => fetchAgenda(filters),
    staleTime: 60_000,
  });
}

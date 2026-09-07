import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatInTimeZone } from 'date-fns-tz';
import type { SportsEntity } from '@/types/sportsEntities';
import {
  toAgendaEntity,
  mergeAgenda,
  sortAgenda,
  type SportsEventRow,
} from '@/lib/sportsAgendaMerge';


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
 *
 * Audit 2026-09-07: the agenda also merges rows synced into `sports_events`
 * that are `confirmed` and carry a verifiable source, which were previously
 * invisible to the public agenda.
 */
async function fetchAgenda(filters: AgendaFilters): Promise<SportsEntity[]> {
  const today = todayMadrid();
  const ascending = filters.window !== 'past';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = (supabase as any)
    .from('sports_entities')
    .select('*')
    .in('entity_type', ['match', 'tournament', 'activity'])
    .not('date_start', 'is', null)
    .eq('status', 'verified')
    .order('date_start', { ascending });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let s: any = (supabase as any)
    .from('sports_events')
    .select(
      'id,title,sport_category,sport_subcategory,competition,start_datetime,end_datetime,venue_name,city,address,price_info,tickets_url,registration_url,organizer_name,source_url,canonical_url,source_name,last_seen_at,status,created_at,updated_at'
    )
    .eq('status', 'confirmed')
    .not('source_url', 'is', null)
    .order('start_date', { ascending })
    .limit(300);

  if (filters.window === 'today') {
    q = q.eq('date_start', today);
    s = s.eq('start_date', today);
  } else if (filters.window === '7d') {
    q = q.gte('date_start', today).lte('date_start', addDays(today, 7));
    s = s.gte('start_date', today).lte('start_date', addDays(today, 7));
  } else if (filters.window === '30d') {
    q = q.gte('date_start', today).lte('date_start', addDays(today, 30));
    s = s.gte('start_date', today).lte('start_date', addDays(today, 30));
  } else if (filters.window === 'past') {
    q = q.lt('date_start', today);
    s = s.lt('start_date', today);
  } else {
    q = q.gte('date_start', today);
    s = s.gte('start_date', today);
  }

  if (filters.sport && filters.sport !== 'all') {
    q = q.eq('sport', filters.sport);
  }
  if (filters.type && filters.type !== 'all') {
    q = q.eq('entity_type', filters.type);
  }
  // Synced rows get their discipline and entity type from the shared
  // eligibility rules (the stored `sport_category` is often "other"), so those
  // two filters are applied after normalization instead of in SQL.

  const [curatedRes, syncedRes] = await Promise.all([q, s ?? Promise.resolve({ data: [], error: null })]);
  if (curatedRes.error) throw curatedRes.error;

  const curated = (curatedRes.data ?? []) as SportsEntity[];
  // A failure on the synced side must not blank the curated agenda.
  const syncedRows = syncedRes?.error ? [] : ((syncedRes?.data ?? []) as SportsEventRow[]);
  const synced = syncedRows
    .map(toAgendaEntity)
    .filter((e): e is SportsEntity => e !== null)
    .filter((e) => (filters.sport && filters.sport !== 'all' ? e.sport === filters.sport : true))
    .filter((e) => (filters.type && filters.type !== 'all' ? e.entity_type === filters.type : true));

  return sortAgenda(mergeAgenda(curated, synced), ascending);
}



export function useSportsAgenda(filters: AgendaFilters) {
  return useQuery({
    queryKey: ['sports-agenda', filters],
    queryFn: () => fetchAgenda(filters),
    staleTime: 60_000,
  });
}

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { SportsEntity } from '@/types/sportsEntities';

export type CalendarScope = 'federation' | 'club';

export interface CalendarSource {
  id: string;
  name: string;
  shortName: string;
  sport: string;
  scope: CalendarScope;
  officialUrl: string;
  lastChecked: string | null;
  /**
   * 'linked'   → we only expose the official link (no reliable public feed).
   * 'pending'  → adapter planned but not yet emitting matches.
   */
  syncState: 'linked' | 'pending';
}

const SPORT_LABEL: Record<string, string> = {
  futbol: 'Fútbol',
  baloncesto: 'Baloncesto',
  balonmano: 'Balonmano',
  voleibol: 'Voleibol',
  badminton: 'Bádminton',
};

function shortNameFor(name: string): string {
  // Prefer parenthesised acronym e.g. "Federación Andaluza de Baloncesto (FAB)"
  const paren = name.match(/\(([^)]+)\)/);
  if (paren) return paren[1];
  if (/RFAF/i.test(name)) return 'RFAF';
  if (/Málaga CF/i.test(name)) return 'Málaga CF';
  if (/Club Balonmano Málaga/i.test(name)) return 'Club BM Málaga';
  if (/Federación Andaluza de Balonmano/i.test(name)) return 'FAndBM';
  if (/Federación Andaluza de Voleibol/i.test(name)) return 'FAVoley';
  if (/Bádminton/i.test(name)) return 'Bádminton Andalucía';
  return name;
}

function scopeFor(name: string): CalendarScope {
  return /Federación|RFAF/i.test(name) ? 'federation' : 'club';
}

async function fetchCalendarSources(): Promise<CalendarSource[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('sports_entities')
    .select('*')
    .eq('entity_type', 'source')
    .in('status', ['verified', 'needs_review'])
    .not('sport', 'is', null);

  if (error) throw error;

  const rows = (data ?? []) as SportsEntity[];
  return rows
    .map<CalendarSource>((r) => ({
      id: r.id,
      name: r.name,
      shortName: shortNameFor(r.name),
      sport: r.sport ? SPORT_LABEL[r.sport] ?? r.sport : '—',
      scope: scopeFor(r.name),
      officialUrl: r.official_url || r.source_url || '#',
      lastChecked: r.source_last_checked ?? null,
      // No public stable feed among the current set — surfaced as official link only.
      syncState: 'linked',
    }))
    .sort((a, b) => {
      if (a.scope !== b.scope) return a.scope === 'federation' ? -1 : 1;
      return a.shortName.localeCompare(b.shortName, 'es');
    });
}

export function useSportsCalendarSources() {
  return useQuery({
    queryKey: ['sports-calendar-sources'],
    queryFn: fetchCalendarSources,
    staleTime: 10 * 60_000,
  });
}

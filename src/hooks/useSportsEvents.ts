import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatInTimeZone } from 'date-fns-tz';
import { addDays } from 'date-fns';
import type { SportEvent } from '@/types/sports';
import type { SportVenue } from '@/types/venues-sports';

const TIMEZONE = 'Europe/Madrid';

function todayMadrid(): string {
  return formatInTimeZone(new Date(), TIMEZONE, 'yyyy-MM-dd');
}

function getMadridDate(d: Date): string {
  return formatInTimeZone(d, TIMEZONE, 'yyyy-MM-dd');
}

/** Get this/next weekend (Fri-Sun) dates in Madrid TZ */
function getWeekendDates(): string[] {
  const now = new Date();
  const today = new Date(todayMadrid() + 'T12:00:00'); // noon to avoid DST edge
  const dayOfWeek = today.getDay(); // 0=Sun
  let fri: Date;
  if (dayOfWeek === 5) fri = today;
  else if (dayOfWeek === 6) fri = addDays(today, -1);
  else if (dayOfWeek === 0) fri = addDays(today, -2);
  else fri = addDays(today, 5 - dayOfWeek);

  return [
    getMadridDate(fri),
    getMadridDate(addDays(fri, 1)),
    getMadridDate(addDays(fri, 2)),
  ];
}

interface DbSportsEvent {
  id: string;
  title: string;
  sport_category: string;
  teams: string | null;
  competition: string | null;
  start_datetime: string;
  start_date: string;
  venue_name: string;
  city: string;
  tickets_url: string | null;
  image_url: string | null;
}

function mapToSportEvent(row: DbSportsEvent): SportEvent {
  return {
    id: row.id,
    sport: row.sport_category,
    title: row.title,
    teams: row.teams ?? undefined,
    competition: row.competition ?? '',
    start_at: row.start_datetime,
    venue: row.venue_name,
    city: row.city,
    ticketsUrl: row.tickets_url ?? undefined,
    imageUrl: row.image_url ?? undefined,
  };
}

export interface SportsEventsFilters {
  fromDate?: string; // YYYY-MM-DD
  toDate?: string;   // YYYY-MM-DD
  categories?: string[];
  venueNames?: string[];
  limit?: number;
}

async function fetchSportsEvents(filters: SportsEventsFilters): Promise<SportEvent[]> {
  let query = supabase
    .from('sports_events')
    .select('id, title, sport_category, teams, competition, start_datetime, start_date, venue_name, city, tickets_url, image_url')
    .eq('status', 'scheduled')
    .order('start_datetime', { ascending: true });

  if (filters.fromDate) {
    query = query.gte('start_date', filters.fromDate);
  }
  if (filters.toDate) {
    query = query.lte('start_date', filters.toDate);
  }
  if (filters.categories?.length) {
    query = query.in('sport_category', filters.categories);
  }
  if (filters.venueNames?.length) {
    query = query.in('venue_name', filters.venueNames);
  }
  if (filters.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(mapToSportEvent);
}

export function useSportsEvents(filters: SportsEventsFilters) {
  return useQuery({
    queryKey: ['sports-events', filters],
    queryFn: () => fetchSportsEvents(filters),
    staleTime: 60_000,
  });
}

export function useSportsEventsToday() {
  const today = todayMadrid();
  return useSportsEvents({ fromDate: today, toDate: today });
}

export function useSportsEventsWeekend() {
  const dates = getWeekendDates();
  return useSportsEvents({ fromDate: dates[0], toDate: dates[2] });
}

export function useSportsEventsByDay(date: string) {
  return useSportsEvents({ fromDate: date, toDate: date });
}

async function fetchSportsVenues(): Promise<SportVenue[]> {
  const { data, error } = await supabase
    .from('sports_venues')
    .select('*')
    .order('name');
  if (error) throw error;
  return (data || []).map(v => ({
    id: v.id,
    name: v.name,
    sports: v.sports as any,
    city: v.city,
    address: v.address ?? undefined,
    lat: v.lat ? Number(v.lat) : undefined,
    lng: v.lng ? Number(v.lng) : undefined,
  }));
}

export function useSportsVenues() {
  return useQuery({
    queryKey: ['sports-venues'],
    queryFn: fetchSportsVenues,
    staleTime: 5 * 60_000,
  });
}

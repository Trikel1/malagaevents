import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Event } from '@/types';
import type { EventFilters } from '@/components/events/FilterDrawer';
import {
  mergeCalendarEntries,
  groupCalendarEntries,
  type CalendarEntry,
} from '@/lib/calendarEntries';


interface EventOccurrence {
  id: string;
  event_id: string;
  start_datetime: string;
  end_datetime?: string;
  buy_url?: string;
  sold_out?: boolean;
  event?: Event;
}


interface UseEventsOptions {
  filters?: EventFilters;
  searchQuery?: string;
  limit?: number;
  todayOnly?: boolean;
  weekendOnly?: boolean;
  venueIds?: string[];
  locationIds?: string[];
  page?: number;
  pageSize?: number;
}

// Normalize search text (remove accents for Spanish)
const normalizeSearchText = (text: string): string => {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
};

const EVENT_LIST_FIELDS =
  'id,title,category,start_at,venue_name,location_normalized,province,image_url,is_free,tags,venue_id,location_id, venues(id,name,lat,lng), locations(id,name)';

const fetchEvents = async (
  options: UseEventsOptions,
  signal?: AbortSignal,
): Promise<{ events: Event[]; count: number }> => {
  let query = supabase
    .from('events')
    .select(`${EVENT_LIST_FIELDS}`, { count: 'exact' })
    .eq('status', 'published')
    .order('start_at', { ascending: true });

  // Date filters - use Europe/Madrid timezone
  const now = new Date();
  
  if (options.todayOnly) {
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    query = query
      .gte('start_at', todayStart.toISOString())
      .lt('start_at', todayEnd.toISOString());
  } else if (options.weekendOnly) {
    // "Este finde" logic with day exclusion based on current day
    // Uses Europe/Madrid timezone logic
    const dayOfWeek = now.getDay(); // 0=Sunday, 1=Monday, ..., 5=Friday, 6=Saturday
    
    let weekendStart: Date;
    let weekendEnd: Date;
    
    if (dayOfWeek === 0) {
      // Sunday: only show Sunday (today)
      weekendStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      weekendEnd = new Date(weekendStart.getTime() + 24 * 60 * 60 * 1000); // End of Sunday
    } else if (dayOfWeek === 6) {
      // Saturday: show Saturday (today) + Sunday
      weekendStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      weekendEnd = new Date(weekendStart.getTime() + 2 * 24 * 60 * 60 * 1000); // End of Sunday
    } else if (dayOfWeek === 5) {
      // Friday: show Friday (today) + Saturday + Sunday
      weekendStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      weekendEnd = new Date(weekendStart.getTime() + 3 * 24 * 60 * 60 * 1000); // End of Sunday
    } else {
      // Monday-Thursday: show next Friday + Saturday + Sunday
      const daysUntilFriday = (5 - dayOfWeek + 7) % 7;
      weekendStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilFriday);
      weekendEnd = new Date(weekendStart.getTime() + 3 * 24 * 60 * 60 * 1000); // End of Sunday
    }
    
    query = query
      .gte('start_at', weekendStart.toISOString())
      .lt('start_at', weekendEnd.toISOString());
  } else if (options.filters?.dateFrom || options.filters?.dateTo) {
    if (options.filters.dateFrom) {
      query = query.gte('start_at', options.filters.dateFrom.toISOString());
    }
    if (options.filters.dateTo) {
      const endOfDay = new Date(options.filters.dateTo);
      endOfDay.setHours(23, 59, 59, 999);
      query = query.lte('start_at', endOfDay.toISOString());
    }
  } else {
    // Default: only future events
    query = query.gte('start_at', now.toISOString());
  }

  // Category filter
  if (options.filters?.categories && options.filters.categories.length > 0) {
    query = query.in('category', options.filters.categories);
  }

  // Free filter
  if (options.filters?.isFree) {
    query = query.eq('is_free', true);
  }

  // Venue filter
  if (options.venueIds && options.venueIds.length > 0) {
    query = query.in('venue_id', options.venueIds);
  }

  // Location filter
  if (options.locationIds && options.locationIds.length > 0) {
    query = query.in('location_id', options.locationIds);
  }

  // Search query - use normalized search for accent-insensitive matching
  if (options.searchQuery && options.searchQuery.trim()) {
    const normalizedQuery = normalizeSearchText(options.searchQuery);
    // Use ilike with the original query and also try the normalized version
    query = query.or(
      `title.ilike.%${options.searchQuery}%,` +
      `title_normalized.ilike.%${normalizedQuery}%,` +
      `venue_name.ilike.%${options.searchQuery}%,` +
      `venue_name_normalized.ilike.%${normalizedQuery}%,` +
      `description.ilike.%${options.searchQuery}%`
    );
  }

  // Pagination
  const page = options.page || 0;
  const pageSize = options.pageSize || options.limit || 20;
  const from = page * pageSize;
  const to = from + pageSize - 1;
  
  query = query.range(from, to);

  if (signal) {
    query = (query as any).abortSignal(signal);
  }

  const { data, error, count } = await query;

  if (error) throw error;
  
  // Map the joined data
  const events = (data || []).map((item: any) => ({
    ...item,
    venue: item.venues || undefined,
    location: item.locations || undefined,
  })) as Event[];

  return { events, count: count || 0 };
};

export const useEvents = (options: UseEventsOptions = {}) => {
  return useQuery({
    queryKey: ['events', options],
    queryFn: ({ signal }) => fetchEvents(options, signal),
    select: (data) => data.events,
  });
};

export const useEventsPaginated = (options: UseEventsOptions = {}) => {
  return useQuery({
    queryKey: ['events-paginated', options],
    queryFn: ({ signal }) => fetchEvents(options, signal),
  });
};

export const useEvent = (id: string | undefined) => {
  return useQuery({
    queryKey: ['event', id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from('events')
        .select('*, venues(*), locations(*)')
        .eq('id', id)
        .eq('status', 'published')
        .maybeSingle();

      if (error) throw error;
      
      if (!data) return null;
      
      return {
        ...data,
        venue: data.venues || undefined,
        location: data.locations || undefined,
      } as Event;
    },
    enabled: !!id,
  });
};

export const useSimilarEvents = (event: Event | null | undefined, limit = 6) => {
  return useQuery({
    queryKey: ['similar-events', event?.id, event?.category, event?.location_id],
    queryFn: async () => {
      if (!event) return [];

      let query = supabase
        .from('events')
        .select('*, venues(*), locations(*)')
        .eq('status', 'published')
        .neq('id', event.id)
        .gte('start_at', new Date().toISOString())
        .order('start_at', { ascending: true })
        .limit(limit);

      if (event.location_id) {
        query = query.eq('location_id', event.location_id);
      } else if (event.category) {
        query = query.eq('category', event.category);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      return (data || []).map((item: any) => ({
        ...item,
        venue: item.venues || undefined,
        location: item.locations || undefined,
      })) as Event[];
    },
    enabled: !!event,
  });
};

// Hook for calendar - fetches occurrences AND published events in a date range
// and merges them so no published event is missing from the calendar.
export const useEventOccurrences = (dateFrom: Date, dateTo: Date, filters?: {
  venueIds?: string[];
  locationIds?: string[];
  searchQuery?: string;
}) => {
  return useQuery({
    queryKey: [
      'event-occurrences',
      dateFrom.toISOString(),
      dateTo.toISOString(),
      filters,
    ],
    staleTime: 60_000,
    queryFn: async ({ signal }) => {
      // 1) Real occurrences in range (joined with their event)
      let occQuery = supabase
        .from('event_occurrences')
        .select(`
          id,
          event_id,
          start_datetime,
          end_datetime,
          buy_url,
          sold_out,
          events!inner(
            id,
            title,
            description,
            category,
            start_at,
            end_at,
            venue_name,
            venue_name_normalized,
            venue_normalized,
            address,
            venue_id,
            location_id,
            location_normalized,
            province,
            image_url,
            is_free,
            price_info,
            ticket_url,
            tags,
            status,
            source_type,
            venues(*),
            locations(id,name,normalized_name,province,country)
          )
        `)
        .gte('start_datetime', dateFrom.toISOString())
        .lte('start_datetime', dateTo.toISOString())
        .eq('events.status', 'published')
        .order('start_datetime', { ascending: true });

      if (filters?.venueIds?.length) {
        occQuery = occQuery.in('events.venue_id', filters.venueIds);
      }
      if (filters?.locationIds?.length) {
        occQuery = occQuery.in('events.location_id', filters.locationIds);
      }

      // 2) Published events whose start_at falls inside the same range
      let evQuery = supabase
        .from('events')
        .select(`
          id,
          title,
          description,
          category,
          start_at,
          end_at,
          venue_name,
          venue_name_normalized,
          venue_normalized,
          address,
          venue_id,
          location_id,
          location_normalized,
          province,
          image_url,
          is_free,
          price_info,
          ticket_url,
          tags,
          status,
          source_type,
          venues(id,name,lat,lng),
          locations(id,name)
        `)
        .eq('status', 'published')
        .gte('start_at', dateFrom.toISOString())
        .lte('start_at', dateTo.toISOString())
        .order('start_at', { ascending: true });

      if (filters?.venueIds?.length) {
        evQuery = evQuery.in('venue_id', filters.venueIds);
      }
      if (filters?.locationIds?.length) {
        evQuery = evQuery.in('location_id', filters.locationIds);
      }

      if (signal) {
        occQuery = (occQuery as any).abortSignal(signal);
        evQuery = (evQuery as any).abortSignal(signal);
      }

      const [occRes, evRes] = await Promise.all([occQuery, evQuery]);
      if (occRes.error) throw occRes.error;
      if (evRes.error) throw evRes.error;

      const occurrences: EventOccurrence[] = (occRes.data || []).map((item: any) => ({
        id: item.id,
        event_id: item.event_id,
        start_datetime: item.start_datetime,
        end_datetime: item.end_datetime,
        buy_url: item.buy_url,
        sold_out: item.sold_out,
        event: item.events
          ? {
              ...item.events,
              venue: item.events.venues || undefined,
              location: item.events.locations || undefined,
            }
          : undefined,
      }));

      const events: Event[] = (evRes.data || []).map((item: any) => ({
        ...item,
        venue: item.venues || undefined,
        location: item.locations || undefined,
      })) as Event[];

      return mergeCalendarEntries(occurrences, events);
    },
  });
};

// Get occurrences grouped by date for calendar view
export const useCalendarOccurrences = (dateFrom: Date, dateTo: Date) => {
  const { data: occurrences, ...rest } = useEventOccurrences(dateFrom, dateTo);
  const entries: CalendarEntry[] = occurrences || [];
  const groupedByDate = groupCalendarEntries(entries);
  // Preserve grouping key contract via Madrid TZ helper
  void getMadridDateKey;

  return {
    ...rest,
    data: groupedByDate,
    occurrences: entries,
  };
};

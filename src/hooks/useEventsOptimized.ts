import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Event, EventOccurrence } from '@/types';
import type { EventFilters } from '@/components/events/FilterDrawer';

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

// Generate stable query key for caching
const generateQueryKey = (options: UseEventsOptions) => {
  return [
    'events-optimized',
    options.searchQuery || '',
    options.filters?.categories?.join(',') || '',
    options.filters?.isFree || false,
    options.filters?.dateFrom?.toISOString() || '',
    options.filters?.dateTo?.toISOString() || '',
    options.todayOnly || false,
    options.weekendOnly || false,
    options.venueIds?.join(',') || '',
    options.locationIds?.join(',') || '',
    options.page || 0,
    options.pageSize || 20,
  ];
};

const fetchEvents = async (
  options: UseEventsOptions,
  signal?: AbortSignal
): Promise<{ events: Event[]; count: number }> => {
  // Check if request was cancelled before starting
  if (signal?.aborted) {
    throw new DOMException('Request cancelled', 'AbortError');
  }

  let query = supabase
    .from('events')
    .select('*, venues(*), locations(*)', { count: 'exact' })
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
    const dayOfWeek = now.getDay();
    const daysUntilSaturday = (6 - dayOfWeek + 7) % 7 || 7;
    const weekendStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilSaturday);
    const weekendEnd = new Date(weekendStart.getTime() + 2 * 24 * 60 * 60 * 1000);
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

  // Check cancellation before executing
  if (signal?.aborted) {
    throw new DOMException('Request cancelled', 'AbortError');
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

/**
 * Optimized events hook with request cancellation and stable caching
 */
export const useEventsOptimized = (options: UseEventsOptions = {}) => {
  const abortControllerRef = useRef<AbortController | null>(null);
  const queryClient = useQueryClient();

  // Cancel previous request when options change
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [JSON.stringify(generateQueryKey(options))]);

  return useQuery({
    queryKey: generateQueryKey(options),
    queryFn: async ({ signal }) => {
      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      abortControllerRef.current = new AbortController();
      
      try {
        const result = await fetchEvents(options, signal);
        return result;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          // Return empty result for cancelled requests
          return { events: [], count: 0 };
        }
        throw error;
      }
    },
    select: (data) => data.events,
    staleTime: 30000, // Cache for 30 seconds
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    retry: (failureCount, error) => {
      // Don't retry on abort
      if (error instanceof DOMException && error.name === 'AbortError') {
        return false;
      }
      return failureCount < 2;
    },
  });
};

/**
 * Paginated events with total count
 */
export const useEventsPaginatedOptimized = (options: UseEventsOptions = {}) => {
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [JSON.stringify(generateQueryKey(options))]);

  return useQuery({
    queryKey: [...generateQueryKey(options), 'paginated'],
    queryFn: async ({ signal }) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
      
      try {
        return await fetchEvents(options, signal);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return { events: [], count: 0 };
        }
        throw error;
      }
    },
    staleTime: 30000,
    gcTime: 5 * 60 * 1000,
  });
};

/**
 * Calendar occurrences with optimized fetching
 */
export const useCalendarOccurrencesOptimized = (
  dateFrom: Date, 
  dateTo: Date,
  filters?: {
    venueIds?: string[];
    locationIds?: string[];
  }
) => {
  return useQuery({
    queryKey: ['calendar-occurrences', dateFrom.toISOString(), dateTo.toISOString(), filters],
    queryFn: async () => {
      let query = supabase
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
            category,
            venue_name,
            venue_id,
            location_id,
            image_url,
            is_free,
            status,
            event_type,
            venues(*),
            locations(*)
          )
        `)
        .gte('start_datetime', dateFrom.toISOString())
        .lte('start_datetime', dateTo.toISOString())
        .eq('events.status', 'published')
        .order('start_datetime', { ascending: true });

      if (filters?.venueIds && filters.venueIds.length > 0) {
        query = query.in('events.venue_id', filters.venueIds);
      }

      if (filters?.locationIds && filters.locationIds.length > 0) {
        query = query.in('events.location_id', filters.locationIds);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Group by date for calendar
      const occurrences = (data || []).map((item: any) => ({
        id: item.id,
        event_id: item.event_id,
        start_datetime: item.start_datetime,
        end_datetime: item.end_datetime,
        buy_url: item.buy_url,
        sold_out: item.sold_out,
        event: item.events ? {
          ...item.events,
          venue: item.events.venues || undefined,
          location: item.events.locations || undefined,
        } : undefined,
      })) as EventOccurrence[];

      // Group by date
      const groupedByDate = occurrences.reduce((acc, occ) => {
        const dateKey = new Date(occ.start_datetime).toISOString().split('T')[0];
        if (!acc[dateKey]) {
          acc[dateKey] = [];
        }
        acc[dateKey].push(occ);
        return acc;
      }, {} as Record<string, EventOccurrence[]>);

      return { occurrences, groupedByDate };
    },
    staleTime: 60000, // Cache for 1 minute
    gcTime: 5 * 60 * 1000,
  });
};

import { useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
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
  enabled?: boolean;
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
    options.filters?.datePreset || '',
    options.filters?.withTickets || false,
    options.filters?.familyKids || false,
    options.filters?.ageRange || '',
    options.filters?.isOutdoor || false,
    options.todayOnly || false,
    options.weekendOnly || false,
    options.venueIds?.join(',') || '',
    options.locationIds?.join(',') || '',
    options.page || 0,
    options.pageSize || 20,
  ];
};

// Compute a [start, end) UTC range for a preset in Europe/Madrid-ish local time
const computePresetRange = (preset: NonNullable<EventFilters['datePreset']>, now: Date): [Date, Date] => {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = (n: number) => new Date(startOfToday.getTime() + n * 86400000);
  switch (preset) {
    case 'today':
      return [startOfToday, day(1)];
    case 'tomorrow':
      return [day(1), day(2)];
    case 'thisWeek':
      return [startOfToday, day(7)];
    case 'next30':
      return [startOfToday, day(30)];
    case 'weekend': {
      const dow = now.getDay();
      if (dow === 0) return [startOfToday, day(1)]; // Sun
      if (dow === 6) return [startOfToday, day(2)]; // Sat -> Sat+Sun
      if (dow === 5) return [startOfToday, day(3)]; // Fri -> Fri+Sat+Sun
      const daysUntilFri = (5 - dow + 7) % 7;
      return [day(daysUntilFri), day(daysUntilFri + 3)];
    }
  }
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

  // Date filters - Europe/Madrid-approx local time
  const now = new Date();
  const presetFromFilters = options.filters?.datePreset;
  const legacyPreset: EventFilters['datePreset'] | undefined = options.todayOnly
    ? 'today'
    : options.weekendOnly
      ? 'weekend'
      : undefined;
  const activePreset = presetFromFilters ?? legacyPreset;

  if (activePreset) {
    const [start, end] = computePresetRange(activePreset, now);
    query = query.gte('start_at', start.toISOString()).lt('start_at', end.toISOString());
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

  // Category filter — expand certain categories to also match event_type
  // (Fase 3B-1: category/event_type divergence is temporary until 3B-2).
  if (options.filters?.categories && options.filters.categories.length > 0) {
    const selected = options.filters.categories as string[];
    const typeExpansion: Record<string, string[]> = {
      festivals: ['festival'],
      exhibitions: ['exhibitions', 'museum'],
      kids: ['kids'],
      music: ['music'],
      theater: ['theater'],
    };
    const extraTypes = Array.from(
      new Set(selected.flatMap((c) => typeExpansion[c] ?? [])),
    );
    if (extraTypes.length > 0) {
      const catList = selected.join(',');
      const typeList = extraTypes.join(',');
      query = query.or(`category.in.(${catList}),event_type.in.(${typeList})`);
    } else {
      query = query.in('category', selected);
    }
  }

  // Free filter
  if (options.filters?.isFree) {
    query = query.eq('is_free', true);
  }

  // With tickets — ticket_url OR buy_url not null
  if (options.filters?.withTickets) {
    query = query.or('ticket_url.not.is.null,buy_url.not.is.null');
  }

  // Family / Kids — prefer real columns (is_family_friendly, audience) populated
  // by backfill_event_family_flags(), with heuristic fallback for gaps.
  if (options.filters?.familyKids) {
    const patterns = [
      'infantil',
      'familiar',
      'familia',
      'ninos',
      'ninas',
      'peques',
      'cuento',
      'cuentacuentos',
      'titeres',
      'marionetas',
      'cantajuego',
      'cantojuego',
    ];
    const clauses = [
      'is_family_friendly.is.true',
      'audience.eq.kids',
      'audience.eq.family',
      'category.eq.kids',
      'event_type.eq.kids',
      ...patterns.map((p) => `title_normalized.ilike.%${p}%`),
    ];
    query = query.or(clauses.join(','));
  }

  // Age range — conservative: use age_min/age_max columns.
  // 0-3: age_min<=3 OR (age_min IS NULL AND title contains bebe/peques/infantil)
  // 4-8: age_min<=8 AND (age_max IS NULL OR age_max>=4)
  // 9-12: age_min<=12 AND (age_max IS NULL OR age_max>=9)
  if (options.filters?.ageRange) {
    const range = options.filters.ageRange;
    if (range === '0-3') {
      const infantPatterns = ['bebe', 'bebes', 'peques', 'infantil'];
      const clauses = [
        'age_min.lte.3',
        ...infantPatterns.map((p) => `title_normalized.ilike.%${p}%`),
      ];
      query = query.or(clauses.join(','));
    } else if (range === '4-8') {
      query = query
        .lte('age_min', 8)
        .or('age_max.is.null,age_max.gte.4');
    } else if (range === '9-12') {
      query = query
        .lte('age_min', 12)
        .or('age_max.is.null,age_max.gte.9');
    }
  }

  // Outdoor
  if (options.filters?.isOutdoor) {
    query = query.eq('is_outdoor', true);
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

      // Group by date using Europe/Madrid timezone
      const groupedByDate = occurrences.reduce((acc, occ) => {
        const occDate = new Date(occ.start_datetime);
        const dateKey = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Europe/Madrid',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(occDate);
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

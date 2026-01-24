import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Event } from '@/types';
import type { EventFilters } from '@/components/events/FilterDrawer';

interface UseEventsOptions {
  filters?: EventFilters;
  searchQuery?: string;
  limit?: number;
  todayOnly?: boolean;
  weekendOnly?: boolean;
}

const fetchEvents = async (options: UseEventsOptions): Promise<Event[]> => {
  let query = supabase
    .from('events')
    .select('*')
    .eq('status', 'published')
    .order('start_at', { ascending: true });

  // Date filters
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

  // Search query
  if (options.searchQuery) {
    query = query.or(`title.ilike.%${options.searchQuery}%,venue_name.ilike.%${options.searchQuery}%,description.ilike.%${options.searchQuery}%`);
  }

  // Limit
  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) throw error;
  
  return (data || []) as Event[];
};

export const useEvents = (options: UseEventsOptions = {}) => {
  return useQuery({
    queryKey: ['events', options],
    queryFn: () => fetchEvents(options),
  });
};

export const useEvent = (id: string | undefined) => {
  return useQuery({
    queryKey: ['event', id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', id)
        .eq('status', 'published')
        .maybeSingle();

      if (error) throw error;
      return data as Event | null;
    },
    enabled: !!id,
  });
};

export const useSimilarEvents = (event: Event | null | undefined, limit = 6) => {
  return useQuery({
    queryKey: ['similar-events', event?.id, event?.category],
    queryFn: async () => {
      if (!event) return [];

      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('status', 'published')
        .eq('category', event.category)
        .neq('id', event.id)
        .gte('start_at', new Date().toISOString())
        .order('start_at', { ascending: true })
        .limit(limit);

      if (error) throw error;
      return (data || []) as Event[];
    },
    enabled: !!event,
  });
};

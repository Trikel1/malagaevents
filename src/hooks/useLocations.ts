import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Location } from '@/types';

export const useLocations = (searchQuery?: string, includeDisabled = false) => {
  return useQuery({
    queryKey: ['locations', searchQuery, includeDisabled],
    queryFn: async () => {
      let query = supabase
        .from('locations')
        .select('*')
        .order('name', { ascending: true });

      if (!includeDisabled) {
        query = query.eq('is_enabled', true);
      }

      if (searchQuery) {
        query = query.ilike('name', `%${searchQuery}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as Location[];
    },
  });
};

export const useLocation = (id: string | undefined) => {
  return useQuery({
    queryKey: ['location', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return data as Location | null;
    },
    enabled: !!id,
  });
};

// Get locations that have events
export const useLocationsWithEvents = () => {
  return useQuery({
    queryKey: ['locations-with-events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('locations')
        .select(`
          *,
          events!inner(id)
        `)
        .eq('is_enabled', true)
        .order('name', { ascending: true });

      if (error) throw error;
      
      // Dedupe and return unique locations
      const uniqueLocations = (data || []).reduce((acc: Location[], item: any) => {
        if (!acc.find(l => l.id === item.id)) {
          const { events, ...location } = item;
          acc.push(location as Location);
        }
        return acc;
      }, []);

      return uniqueLocations;
    },
  });
};

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Venue } from '@/types';

export const useVenues = (searchQuery?: string) => {
  return useQuery({
    queryKey: ['venues', searchQuery],
    queryFn: async () => {
      let query = supabase
        .from('venues')
        .select('*')
        .order('name', { ascending: true });

      if (searchQuery) {
        query = query.ilike('name', `%${searchQuery}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as Venue[];
    },
  });
};

export const useVenue = (id: string | undefined) => {
  return useQuery({
    queryKey: ['venue', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('venues')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return data as Venue | null;
    },
    enabled: !!id,
  });
};

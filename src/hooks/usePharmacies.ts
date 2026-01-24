import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Pharmacy } from '@/types';
import { format } from 'date-fns';

export const usePharmacies = (date: Date) => {
  const dateStr = format(date, 'yyyy-MM-dd');
  
  return useQuery({
    queryKey: ['pharmacies', dateStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pharmacies_guard')
        .select('*')
        .lte('date_from', dateStr)
        .gte('date_to', dateStr)
        .order('name', { ascending: true });

      if (error) throw error;
      return (data || []) as Pharmacy[];
    },
  });
};

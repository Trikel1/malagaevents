import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Pharmacy } from '@/types';
import { format } from 'date-fns';

// Get pharmacies on duty for a specific date
export const usePharmaciesOnDuty = (date: Date) => {
  const dateStr = format(date, 'yyyy-MM-dd');
  
  return useQuery({
    queryKey: ['pharmacies', 'duty', dateStr],
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

// Get all unique pharmacies (distinct by name)
export const useAllPharmacies = () => {
  return useQuery({
    queryKey: ['pharmacies', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pharmacies_guard')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      
      // Get unique pharmacies by name (taking the most recent entry)
      const pharmacyMap = new Map<string, Pharmacy>();
      (data || []).forEach((p: Pharmacy) => {
        if (!pharmacyMap.has(p.name)) {
          pharmacyMap.set(p.name, p);
        }
      });
      
      return Array.from(pharmacyMap.values());
    },
  });
};

// Legacy export for backwards compatibility
export const usePharmacies = usePharmaciesOnDuty;

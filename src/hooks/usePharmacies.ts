import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Pharmacy } from '@/types';
import { format } from 'date-fns';

// Directory pharmacy type (from pharmacies_directory table)
export interface PharmacyDirectory {
  id: string;
  name: string;
  address: string;
  municipality: string;
  province: string;
  phone: string | null;
  lat: number | null;
  lng: number | null;
  dedupe_key: string | null;
  source_ref: string | null;
  created_at: string;
  updated_at: string;
}

// Get pharmacies on duty for a specific date (optionally filtered by municipality)
export const usePharmaciesOnDuty = (date: Date, municipality?: string) => {
  const dateStr = format(date, 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['pharmacies', 'duty', dateStr, municipality ?? 'all'],
    queryFn: async () => {
      let q = supabase
        .from('pharmacies_guard')
        .select('*')
        .lte('date_from', dateStr)
        .gte('date_to', dateStr)
        .order('name', { ascending: true });
      if (municipality) q = q.eq('municipality', municipality);

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as (Pharmacy & { municipality?: string })[];
    },
  });
};

// Get all pharmacies from the province directory
export const usePharmacyDirectory = (municipality?: string) => {
  return useQuery({
    queryKey: ['pharmacies', 'directory', municipality],
    queryFn: async () => {
      let query = (supabase as any)
        .from('pharmacies_directory')
        .select('*')
        .order('municipality', { ascending: true })
        .order('name', { ascending: true });

      if (municipality) {
        query = query.eq('municipality', municipality);
      }

      const { data, error } = await query;

      if (error) {
        console.warn('pharmacies_directory query failed, falling back to pharmacies_guard:', error);
        // Fallback to pharmacies_guard unique entries
        const { data: fallback, error: fbError } = await supabase
          .from('pharmacies_guard')
          .select('*')
          .order('name', { ascending: true });
        
        if (fbError) throw fbError;
        
        const pharmacyMap = new Map<string, any>();
        (fallback || []).forEach((p: any) => {
          if (!pharmacyMap.has(p.name)) {
            pharmacyMap.set(p.name, p);
          }
        });
        return Array.from(pharmacyMap.values()) as PharmacyDirectory[];
      }

      return (data || []) as PharmacyDirectory[];
    },
  });
};

// Get unique municipalities from directory
export const usePharmacyMunicipalities = () => {
  return useQuery({
    queryKey: ['pharmacies', 'municipalities'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('pharmacies_directory')
        .select('municipality')
        .order('municipality', { ascending: true });

      if (error) {
        console.warn('municipalities query failed:', error);
        return ['Málaga'];
      }

      const unique = [...new Set((data || []).map((d: any) => d.municipality as string))];
      return unique.length > 0 ? unique : ['Málaga'];
    },
  });
};

// Get all unique pharmacies (legacy - from pharmacies_guard)
export const useAllPharmacies = () => {
  return useQuery({
    queryKey: ['pharmacies', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pharmacies_guard')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      
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

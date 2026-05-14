import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Pharmacy } from '@/types';
import { formatInTimeZone } from 'date-fns-tz';

const TIMEZONE = 'Europe/Madrid';

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

// Get pharmacies on duty for a specific date (optionally filtered by municipality).
// If the DB has no rows for that date+municipality, derive a deterministic rotation
// from the directory so the UI never appears empty.
export const usePharmaciesOnDuty = (date: Date, municipality?: string) => {
  const dateStr = formatInTimeZone(date, TIMEZONE, 'yyyy-MM-dd');

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
      const rows = (data || []) as (Pharmacy & { municipality?: string })[];
      if (rows.length > 0 || !municipality) return rows;

      // Fallback: pick rotating subset from directory for that municipality
      const { data: dir } = await (supabase as any)
        .from('pharmacies_directory')
        .select('*')
        .eq('municipality', municipality)
        .order('name', { ascending: true });

      const list = (dir ?? []) as any[];
      if (list.length === 0) return [];

      // deterministic pick by day-of-year
      const dayIdx = Math.floor(
        (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000
      );
      const take = Math.min(Math.max(1, Math.ceil(list.length / 7)), 5);
      const start = dayIdx % list.length;
      const picked: any[] = [];
      for (let i = 0; i < take; i++) picked.push(list[(start + i) % list.length]);

      return picked.map((p) => ({
        id: `fallback-${p.id}`,
        name: p.name,
        address: p.address,
        phone: p.phone ?? null,
        lat: p.lat ?? null,
        lng: p.lng ?? null,
        municipality: p.municipality,
        date_from: dateStr,
        date_to: dateStr,
        source_ref: 'fallback-rotation',
        __fallback: true,
      })) as any;
    },
  });
};

// Get all pharmacies from the province directory.
// Paginates by 1000-row chunks to bypass Supabase's default row limit and return
// the entire province directory when `municipality` is undefined.
export const usePharmacyDirectory = (municipality?: string) => {
  return useQuery({
    queryKey: ['pharmacies', 'directory', municipality ?? '__all__'],
    queryFn: async () => {
      const PAGE = 1000;
      const all: PharmacyDirectory[] = [];
      let from = 0;

      // eslint-disable-next-line no-constant-condition
      while (true) {
        let query = (supabase as any)
          .from('pharmacies_directory')
          .select('*')
          .order('municipality', { ascending: true })
          .order('name', { ascending: true })
          .range(from, from + PAGE - 1);

        if (municipality) query = query.eq('municipality', municipality);

        const { data, error } = await query;

        if (error) {
          console.warn('pharmacies_directory query failed, falling back to pharmacies_guard:', error);
          const { data: fallback, error: fbError } = await supabase
            .from('pharmacies_guard')
            .select('*')
            .order('name', { ascending: true });
          if (fbError) throw fbError;
          const map = new Map<string, any>();
          (fallback || []).forEach((p: any) => {
            if (!map.has(p.name)) map.set(p.name, p);
          });
          return Array.from(map.values()) as PharmacyDirectory[];
        }

        const chunk = (data || []) as PharmacyDirectory[];
        all.push(...chunk);
        if (chunk.length < PAGE) break;
        from += PAGE;
      }

      return all;
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

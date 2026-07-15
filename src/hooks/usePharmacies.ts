import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Pharmacy } from '@/types';
import { formatInTimeZone } from 'date-fns-tz';

const TIMEZONE = 'Europe/Madrid';

// Whitelist of official sources that can back a "de guardia" row. Anything
// outside of this list is treated as unverified and hidden from the UI, even
// if it slipped past the DB trigger. Defense in depth.
const OFFICIAL_GUARD_SOURCES = [
  'farmaciasguardia.farmaceuticos.com',
  'farmaceuticos.com',
  'icofma.es',
  'cofmalaga.com',
  'cgcof.es',
];

export const isOfficialGuardSource = (source?: string | null): boolean => {
  if (!source) return false;
  const s = source.toLowerCase();
  return OFFICIAL_GUARD_SOURCES.some((allowed) => s.includes(allowed));
};

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
// Returns ONLY rows that come from a verifiable official source. If no
// official rows exist for that date+municipality, returns an empty list —
// this app must never fabricate a duty rotation.
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
      const rows = (data || []) as (Pharmacy & { municipality?: string; source_ref?: string | null })[];
      // Client-side whitelist filter — defense in depth against any legacy
      // row that might still be present in the table.
      return rows.filter((r) => isOfficialGuardSource(r.source_ref));
    },
  });
};

// Last successful pharmacies-guard sync attempt against the official source.
export interface PharmacyGuardSyncStatus {
  status?: string;
  guardia_source?: string;
  guardia_inserted?: number;
  directory_source?: string;
  directory_upserted?: number;
  errors?: string[];
  updated_at?: string;
}

export const usePharmacyGuardSyncStatus = () => {
  return useQuery({
    queryKey: ['pharmacies', 'sync-status'],
    queryFn: async (): Promise<PharmacyGuardSyncStatus | null> => {
      const { data, error } = await (supabase as any)
        .from('app_config')
        .select('value')
        .eq('key', 'pharmacies_guard_last_sync')
        .maybeSingle();
      if (error || !data) return null;
      return (data.value as PharmacyGuardSyncStatus) ?? null;
    },
    staleTime: 60_000,
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

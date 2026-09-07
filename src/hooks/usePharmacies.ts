import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Pharmacy } from '@/types';
import { formatInTimeZone } from 'date-fns-tz';
import { matchesMunicipality } from '@/lib/pharmacyMunicipality';

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

export interface GuardRow extends Omit<Pharmacy, 'date_from' | 'date_to' | 'updated_at'> {
  municipality?: string | null;
  source_ref?: string | null;
  date_from?: string;
  date_to?: string;
  updated_at?: string;
}

export interface DutyResult {
  /** Duty rows from an official source, already filtered by municipality. */
  rows: GuardRow[];
  /** The calendar day (Europe/Madrid) the rows were published for. */
  sourceDate: string;
  /** The day the user asked for. */
  requestedDate: string;
  /**
   * True when `rows` come from the previous calendar day because the source
   * has not published the requested day yet. Shifts commonly run past
   * midnight, so these are shown — clearly labelled, never as "today's".
   */
  isPreviousDay: boolean;
  /** Official rows exist for that date, but none in the chosen municipality. */
  hasProvinceDataForDate: boolean;
}

const previousDay = (iso: string): string => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

// Get pharmacies on duty for a specific date (optionally filtered by municipality).
// Returns ONLY rows that come from a verifiable official source. If no
// official rows exist for that date+municipality, returns an empty list —
// this app must never fabricate a duty rotation.
//
// The municipality filter is applied in memory through the shared catalog
// matcher: the official portal spells towns without accents ("Velez-Malaga"),
// so an SQL equality filter against the UI's display name silently returned
// nothing. See src/lib/pharmacyMunicipality.ts.
export const usePharmaciesOnDuty = (date: Date, municipality?: string) => {
  const dateStr = formatInTimeZone(date, TIMEZONE, 'yyyy-MM-dd');
  const todayStr = formatInTimeZone(new Date(), TIMEZONE, 'yyyy-MM-dd');
  const isToday = dateStr === todayStr;

  return useQuery({
    queryKey: ['pharmacies', 'duty', dateStr, municipality ?? 'all', isToday],
    queryFn: async (): Promise<DutyResult> => {
      const fetchDay = async (day: string): Promise<GuardRow[]> => {
        const { data, error } = await supabase
          .from('pharmacies_guard')
          .select('*')
          .lte('date_from', day)
          .gte('date_to', day)
          .order('name', { ascending: true });
        if (error) throw error;
        // Client-side whitelist filter — defense in depth against any legacy
        // row that might still be present in the table.
        return ((data || []) as GuardRow[]).filter((r) => isOfficialGuardSource(r.source_ref));
      };

      const byMunicipality = (rows: GuardRow[]) =>
        municipality ? rows.filter((r) => matchesMunicipality(r.municipality, municipality)) : rows;

      const sameDay = await fetchDay(dateStr);
      if (sameDay.length > 0) {
        return {
          rows: byMunicipality(sameDay),
          sourceDate: dateStr,
          requestedDate: dateStr,
          isPreviousDay: false,
          hasProvinceDataForDate: true,
        };
      }

      // Nothing published for the requested day. For *today* only, fall back to
      // the previous day's published rota: the official sync runs in the early
      // morning, so between midnight and the sync there is a real gap, and the
      // shift on the street is still the previous day's. Never for past or
      // future dates.
      if (isToday) {
        const prev = previousDay(dateStr);
        const prevRows = await fetchDay(prev);
        if (prevRows.length > 0) {
          return {
            rows: byMunicipality(prevRows),
            sourceDate: prev,
            requestedDate: dateStr,
            isPreviousDay: true,
            hasProvinceDataForDate: false,
          };
        }
      }

      return {
        rows: [],
        sourceDate: dateStr,
        requestedDate: dateStr,
        isPreviousDay: false,
        hasProvinceDataForDate: false,
      };
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
//
// The municipality filter runs in memory through the shared catalog matcher:
// pharmacies_directory holds accent variants of the same town ("Benalmadena"
// / "Benalmádena") plus localities ("Torre del Mar", "Arroyo de la Miel"), so
// an SQL equality filter dropped real rows.
export const usePharmacyDirectory = (municipality?: string) => {
  return useQuery({
    queryKey: ['pharmacies', 'directory', municipality ?? '__all__'],
    queryFn: async () => {
      const PAGE = 1000;
      const all: PharmacyDirectory[] = [];
      let from = 0;

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const query = (supabase as any)
          .from('pharmacies_directory')
          .select('*')
          .order('municipality', { ascending: true })
          .order('name', { ascending: true })
          .range(from, from + PAGE - 1);

        const { data, error } = await query;

        if (error) throw error;

        const chunk = (data || []) as PharmacyDirectory[];
        all.push(...chunk);
        if (chunk.length < PAGE) break;
        from += PAGE;
      }

      if (!municipality) return all;
      return all.filter((p) => matchesMunicipality(p.municipality, municipality));
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

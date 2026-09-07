import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { evaluateSportsEligibility } from '@/lib/sportsEligibility';

export interface SportsEventDetail {
  id: string;
  title: string;
  sport_category: string;
  sport_subcategory: string | null;
  competition: string | null;
  teams: string | null;
  start_datetime: string;
  end_datetime: string | null;
  venue_name: string;
  city: string;
  address: string | null;
  price_info: string | null;
  tickets_url: string | null;
  registration_url: string | null;
  image_url: string | null;
  source_url: string | null;
  canonical_url: string | null;
  source_name: string | null;
  status: string;
  organizer_name: string | null;
  updated_at: string | null;
  last_seen_at: string | null;
  /** Location trust from the shared eligibility rule; never assumed. */
  locationVerified: boolean;
}

export function useSportsEvent(id: string | undefined) {
  return useQuery({
    queryKey: ['sports-event', id],
    enabled: Boolean(id),
    queryFn: async (): Promise<SportsEventDetail | null> => {
      const { data, error } = await supabase
        .from('sports_events')
        .select(
          'id, title, sport_category, sport_subcategory, competition, teams, start_datetime, end_datetime, venue_name, city, address, price_info, tickets_url, registration_url, image_url, source_url, canonical_url, source_name, status, organizer_name, updated_at, last_seen_at',
        )
        .eq('id', id!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;

      const verdict = evaluateSportsEligibility(data as any);
      return {
        ...(data as any),
        locationVerified: verdict.tier === 'verified',
      } as SportsEventDetail;
    },
  });
}

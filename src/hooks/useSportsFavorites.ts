import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

/**
 * Sports favourites live in their own table: cultural favourites point at
 * `events` and the two datasets stay strictly isolated.
 */
export function useSportsFavoriteIds() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['sports-favorites', user?.id],
    queryFn: async () => {
      if (!user) return [] as string[];
      const { data, error } = await supabase
        .from('sports_favorites')
        .select('sports_event_id')
        .eq('user_id', user.id);
      if (error) throw error;
      return (data ?? []).map((r) => r.sports_event_id as string);
    },
    enabled: !!user,
  });
}

export function useToggleSportsFavorite() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ eventId, isFavorite }: { eventId: string; isFavorite: boolean }) => {
      if (!user) throw new Error('not-authenticated');
      if (isFavorite) {
        const { error } = await supabase
          .from('sports_favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('sports_event_id', eventId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('sports_favorites')
          .insert({ user_id: user.id, sports_event_id: eventId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sports-favorites'] });
      queryClient.invalidateQueries({ queryKey: ['sports-favorite-events'] });
    },
    onError: () => {
      toast({ title: 'No se pudo guardar', variant: 'destructive' });
    },
  });
}

/** The saved sports events themselves, for the profile / saved list. */
export function useSportsFavoriteEvents(enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['sports-favorite-events', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('sports_favorites')
        .select('sports_event_id, sports_events:sports_event_id (*)')
        .eq('user_id', user.id);
      if (error) throw error;
      return (data ?? []).map((row: any) => row.sports_events).filter(Boolean);
    },
    enabled: !!user && enabled,
  });
}

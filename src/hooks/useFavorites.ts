import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import type { Favorite } from '@/types';

export const useFavorites = () => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['favorites', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('favorites')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;
      return (data || []) as Favorite[];
    },
    enabled: !!user,
  });
};

export const useFavoriteEvents = () => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['favorite-events', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('favorites')
        .select(`
          id,
          event_id,
          events:event_id (*)
        `)
        .eq('user_id', user.id);

      if (error) throw error;
      
      // Extract events from the join
      return (data || [])
        .map((f: any) => f.events)
        .filter(Boolean);
    },
    enabled: !!user,
  });
};

export const useIsFavorite = (eventId: string) => {
  const { data: favorites } = useFavorites();
  return favorites?.some((f) => f.event_id === eventId) ?? false;
};

export const useToggleFavorite = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ eventId, isFavorite }: { eventId: string; isFavorite: boolean }) => {
      if (!user) throw new Error('Not authenticated');

      if (isFavorite) {
        // Remove favorite
        const { error } = await supabase
          .from('favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('event_id', eventId);

        if (error) throw error;
      } else {
        // Add favorite
        const { error } = await supabase
          .from('favorites')
          .insert({ user_id: user.id, event_id: eventId });

        if (error) throw error;
      }
    },
    onSuccess: (_, { isFavorite }) => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
      queryClient.invalidateQueries({ queryKey: ['favorite-events'] });
      
      toast({
        title: isFavorite ? 'Eliminado de favoritos' : 'Añadido a favoritos',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

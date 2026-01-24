import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import type { Ticket } from '@/types';

export const useTickets = () => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['tickets', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .eq('user_id', user.id)
        .order('event_date', { ascending: false, nullsFirst: false });

      if (error) throw error;
      return (data || []) as Ticket[];
    },
    enabled: !!user,
  });
};

export const useCreateTicket = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (ticket: {
      title: string;
      note?: string;
      qr_text?: string;
      event_date?: string;
      event_id?: string;
      file?: File;
    }) => {
      if (!user) throw new Error('Not authenticated');

      let file_path: string | undefined;

      // Upload file if provided
      if (ticket.file) {
        const fileExt = ticket.file.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('tickets')
          .upload(fileName, ticket.file);

        if (uploadError) throw uploadError;
        file_path = fileName;
      }

      // Insert ticket record
      const { data, error } = await supabase
        .from('tickets')
        .insert({
          user_id: user.id,
          title: ticket.title,
          note: ticket.note || null,
          qr_text: ticket.qr_text || null,
          event_date: ticket.event_date || null,
          event_id: ticket.event_id || null,
          file_path: file_path || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Ticket;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      toast({
        title: 'Entrada guardada',
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

export const useDeleteTicket = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (ticket: Ticket) => {
      if (!user) throw new Error('Not authenticated');

      // Delete file from storage if exists
      if (ticket.file_path) {
        await supabase.storage
          .from('tickets')
          .remove([ticket.file_path]);
      }

      // Delete ticket record
      const { error } = await supabase
        .from('tickets')
        .delete()
        .eq('id', ticket.id)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      toast({
        title: 'Entrada eliminada',
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

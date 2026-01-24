import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';

export interface ScrapingSource {
  id: string;
  name: string;
  url: string;
  category: string;
  is_active: boolean;
  last_scraped_at: string | null;
  events_found: number;
  created_at: string;
  updated_at: string;
}

export interface PendingEvent {
  id: string;
  title: string;
  description: string;
  category: string;
  start_at: string;
  venue_name: string;
  address: string;
  status: string;
  source_type: string;
  created_at: string;
}

export interface EventSubmission {
  id: string;
  event_id: string;
  submitter_email: string;
  captcha_passed: boolean;
  email_verified: boolean;
  created_at: string;
}

export const useIsAdmin = () => {
  const { user } = useAuthContext();
  
  return useQuery({
    queryKey: ['is-admin', user?.id],
    queryFn: async () => {
      if (!user) return false;
      
      const { data, error } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: 'admin',
      });
      
      if (error) {
        console.error('Error checking admin role:', error);
        return false;
      }
      
      return data === true;
    },
    enabled: !!user,
  });
};

export const usePendingEvents = () => {
  return useQuery({
    queryKey: ['pending-events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as PendingEvent[];
    },
  });
};

export const useAllEvents = (status?: string) => {
  return useQuery({
    queryKey: ['admin-events', status],
    queryFn: async () => {
      let query = supabase
        .from('events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (status) {
        query = query.eq('status', status);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as PendingEvent[];
    },
  });
};

export const useEventSubmissions = () => {
  return useQuery({
    queryKey: ['event-submissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_submissions')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as EventSubmission[];
    },
  });
};

export const useScrapingSources = () => {
  return useQuery({
    queryKey: ['scraping-sources'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scraping_sources')
        .select('*')
        .order('name', { ascending: true });
      
      if (error) throw error;
      return data as ScrapingSource[];
    },
  });
};

export const useApproveEvent = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase
        .from('events')
        .update({ status: 'published' })
        .eq('id', eventId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-events'] });
      queryClient.invalidateQueries({ queryKey: ['admin-events'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
};

export const useRejectEvent = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase
        .from('events')
        .update({ status: 'rejected' })
        .eq('id', eventId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-events'] });
      queryClient.invalidateQueries({ queryKey: ['admin-events'] });
    },
  });
};

export const useDeleteEvent = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', eventId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-events'] });
      queryClient.invalidateQueries({ queryKey: ['admin-events'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
};

export const useToggleSource = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('scraping_sources')
        .update({ is_active, updated_at: new Date().toISOString() })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scraping-sources'] });
    },
  });
};

export const useAddSource = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (source: { name: string; url: string; category: string }) => {
      const { error } = await supabase
        .from('scraping_sources')
        .insert(source);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scraping-sources'] });
    },
  });
};

export const useDeleteSource = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('scraping_sources')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scraping-sources'] });
    },
  });
};

export const useRunScraping = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('sync-events', {
        body: {},
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scraping-sources'] });
      queryClient.invalidateQueries({ queryKey: ['admin-events'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['events-optimized'] });
      queryClient.invalidateQueries({ queryKey: ['sync-stats'] });
    },
  });
};

export const useAdminStats = () => {
  return useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const [eventsRes, pendingRes, sourcesRes, syncRunsRes] = await Promise.all([
        supabase.from('events').select('id', { count: 'exact', head: true }).eq('status', 'published'),
        supabase.from('events').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('sources_config').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('sync_runs').select('finished_at').order('finished_at', { ascending: false }).limit(1),
      ]);
      
      return {
        totalEvents: eventsRes.count || 0,
        pendingEvents: pendingRes.count || 0,
        activeSources: sourcesRes.count || 0,
        lastSyncAt: syncRunsRes.data?.[0]?.finished_at || null,
      };
    },
    refetchInterval: 30000,
  });
};

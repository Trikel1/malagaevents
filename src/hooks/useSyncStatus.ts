import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SyncRun {
  id: string;
  source: string;
  started_at: string;
  finished_at: string | null;
  status: 'running' | 'completed' | 'failed';
  inserted: number;
  updated: number;
  skipped: number;
  errors: number;
  occurrences_created: number;
  events_archived: number;
  error_details: any;
  created_at: string;
}

export interface SourceConfig {
  id: string;
  name: string;
  slug: string;
  domain: string;
  chosen_entrypoint: string | null;
  fallback_entrypoint: string | null;
  entrypoints_detected: string[];
  discovery_confidence: number;
  is_active: boolean;
  last_discovery_at: string | null;
  last_sync_at: string | null;
  event_type: string;
  category: string;
  default_venue: string | null;
  default_location: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SyncStats {
  totalEvents: number;
  publishedEvents: number;
  archivedEvents: number;
  activeSources: number;
  degradedSources: number;
  lastSyncAt: string | null;
  recentSyncs: SyncRun[];
}

/**
 * Get sync status and stats for admin dashboard
 */
export const useSyncStats = () => {
  return useQuery({
    queryKey: ['sync-stats'],
    queryFn: async (): Promise<SyncStats> => {
      const [
        totalEventsRes,
        publishedEventsRes,
        archivedEventsRes,
        activeSourcesRes,
        recentSyncsRes,
      ] = await Promise.all([
        supabase.from('events').select('id', { count: 'exact', head: true }),
        supabase.from('events').select('id', { count: 'exact', head: true }).eq('status', 'published'),
        supabase.from('events').select('id', { count: 'exact', head: true }).eq('status', 'archived'),
        supabase.from('sources_config').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('sync_runs').select('*').order('started_at', { ascending: false }).limit(10),
      ]);

      // Count sources with recent failures (degraded)
      const { data: recentFails } = await supabase
        .from('sync_runs')
        .select('source')
        .eq('status', 'failed')
        .gte('started_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      const degradedSources = new Set(recentFails?.map(r => r.source) || []).size;

      // Get last successful sync
      const lastSyncAt = recentSyncsRes.data?.[0]?.finished_at || null;

      return {
        totalEvents: totalEventsRes.count || 0,
        publishedEvents: publishedEventsRes.count || 0,
        archivedEvents: archivedEventsRes.count || 0,
        activeSources: activeSourcesRes.count || 0,
        degradedSources,
        lastSyncAt,
        recentSyncs: (recentSyncsRes.data || []) as SyncRun[],
      };
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });
};

/**
 * Get all source configurations
 */
export const useSourcesConfig = () => {
  return useQuery({
    queryKey: ['sources-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sources_config')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      return data as SourceConfig[];
    },
  });
};

/**
 * Get sync runs with filtering
 */
export const useSyncRuns = (options?: {
  source?: string;
  status?: string;
  limit?: number;
}) => {
  return useQuery({
    queryKey: ['sync-runs', options],
    queryFn: async () => {
      let query = supabase
        .from('sync_runs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(options?.limit || 50);

      if (options?.source) {
        query = query.eq('source', options.source);
      }
      if (options?.status) {
        query = query.eq('status', options.status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as SyncRun[];
    },
  });
};

/**
 * Trigger full sync
 */
export const useRunFullSync = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (options?: { sources?: string[]; discover?: boolean }) => {
      const { data, error } = await supabase.functions.invoke('sync-events', {
        body: options || {},
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sync-stats'] });
      queryClient.invalidateQueries({ queryKey: ['sync-runs'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['events-optimized'] });
    },
  });
};

/**
 * Trigger discovery for sources
 */
export const useRunDiscovery = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (domains?: string[]) => {
      const { data, error } = await supabase.functions.invoke('discover-sources', {
        body: domains ? { domains } : {},
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources-config'] });
    },
  });
};

/**
 * Toggle source active status
 */
export const useToggleSourceActive = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ slug, isActive }: { slug: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('sources_config')
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq('slug', slug);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources-config'] });
      queryClient.invalidateQueries({ queryKey: ['sync-stats'] });
    },
  });
};

/**
 * Get source health status
 */
export const useSourceHealth = (slug: string) => {
  return useQuery({
    queryKey: ['source-health', slug],
    queryFn: async () => {
      // Get last 5 sync runs for this source
      const { data: runs } = await supabase
        .from('sync_runs')
        .select('*')
        .eq('source', slug)
        .order('started_at', { ascending: false })
        .limit(5);

      if (!runs || runs.length === 0) {
        return { status: 'unknown', message: 'No sync history', consecutiveFailures: 0 };
      }

      // Count consecutive failures
      let consecutiveFailures = 0;
      for (const run of runs) {
        if (run.status === 'failed') {
          consecutiveFailures++;
        } else {
          break;
        }
      }

      if (consecutiveFailures >= 3) {
        return { status: 'degraded', message: `${consecutiveFailures} consecutive failures`, consecutiveFailures };
      }

      if (runs[0].status === 'failed') {
        return { status: 'warning', message: 'Last sync failed', consecutiveFailures };
      }

      return { status: 'healthy', message: 'Operating normally', consecutiveFailures: 0 };
    },
    enabled: !!slug,
  });
};

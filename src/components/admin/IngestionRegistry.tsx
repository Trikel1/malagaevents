import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Database,
  MapPin,
  ShieldCheck,
  Building2,
  Play,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

// Real schema (Phase 2A) — do NOT reference columns that don't exist.
type EventSource = {
  id: string;
  slug: string;
  name: string;
  kind: string | null;
  base_url: string | null;
  adapter_key: string | null;
  locality_slug: string | null;
  category_hints: string[] | null;
  priority: number | null;
  enabled: boolean;
  schedule_cron: string | null;
  robots_ok: boolean;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type EventSourceRun = {
  id: string;
  source_id: string;
  started_at: string;
  finished_at: string | null;
  status: string | null;
  inserted: number | null;
  updated: number | null;
  skipped_dupes: number | null;
  errors: number | null;
  duration_ms: number | null;
  meta: Record<string, unknown> | null;
};

type IngestionError = {
  id: string;
  source_id: string | null;
  run_id: string | null;
  stage: string | null;
  message: string | null;
  payload_sample: unknown;
  created_at: string;
};

const fmt = (d: string | null | undefined) =>
  d ? format(new Date(d), "d MMM yyyy, HH:mm", { locale: es }) : '—';

const statusBadge = (status: string | null | undefined) => {
  switch (status) {
    case 'success':
      return <Badge className="bg-emerald-600 hover:bg-emerald-600">OK</Badge>;
    case 'partial':
      return <Badge className="bg-amber-600 hover:bg-amber-600">Parcial</Badge>;
    case 'running':
      return <Badge className="bg-blue-600 hover:bg-blue-600">En curso</Badge>;
    case 'error':
      return <Badge variant="destructive">Error</Badge>;
    default:
      return <Badge variant="outline">{status ?? '—'}</Badge>;
  }
};

const truncate = (v: unknown, max = 220) => {
  if (v == null) return '';
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s.length > max ? s.slice(0, max) + '…' : s;
};

const IngestionRegistry = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [busySourceId, setBusySourceId] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'ingesta'] });
  };

  const runDry = async (sourceId?: string) => {
    setBusySourceId(sourceId ?? '__dispatcher__');
    try {
      const { data, error } = await supabase.functions.invoke('admin-ingest', {
        body: sourceId
          ? { action: 'scrape-source', sourceId, dryRun: true }
          : { action: 'ingest-dispatcher', dryRun: true },
      });
      if (error) throw error;
      const summary = data as { inserted?: number; skippedDupes?: number; errors?: number; preview?: unknown[]; processed?: number };
      toast({
        title: 'Dry-run completado',
        description: summary?.preview
          ? `${summary.preview.length} eventos normalizados · ${summary.errors ?? 0} errores`
          : `Procesadas ${summary?.processed ?? 0} fuentes`,
      });
      setAutoRefresh(true);
      setTimeout(() => setAutoRefresh(false), 8000);
      invalidateAll();
    } catch (e: any) {
      toast({
        title: 'Dry-run falló',
        description: e?.message ?? 'Error desconocido',
        variant: 'destructive',
      });
    } finally {
      setBusySourceId(null);
    }
  };

  const sourcesQuery = useQuery({
    queryKey: ['admin', 'ingesta', 'event_sources'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_sources' as any)
        .select(
          'id, slug, name, kind, base_url, adapter_key, locality_slug, category_hints, priority, enabled, schedule_cron, robots_ok, notes, created_at, updated_at',
        )
        .order('priority', { ascending: false })
        .order('name', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as EventSource[];
    },
  });

  const runsQuery = useQuery({
    queryKey: ['admin', 'ingesta', 'event_source_runs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_source_runs' as any)
        .select('id, source_id, started_at, finished_at, status, inserted, updated, skipped_dupes, errors, duration_ms, meta')
        .order('started_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as EventSourceRun[];
    },
  });

  const errorsQuery = useQuery({
    queryKey: ['admin', 'ingesta', 'ingestion_errors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ingestion_errors' as any)
        .select('id, source_id, run_id, stage, message, payload_sample, created_at')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as IngestionError[];
    },
  });

  const venueAliasCountQuery = useQuery({
    queryKey: ['admin', 'ingesta', 'venue_aliases', 'count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('venue_aliases' as any)
        .select('id', { count: 'exact', head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });

  const localityAliasCountQuery = useQuery({
    queryKey: ['admin', 'ingesta', 'locality_aliases', 'count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('locality_aliases' as any)
        .select('id', { count: 'exact', head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });

  const anyError =
    sourcesQuery.isError ||
    runsQuery.isError ||
    errorsQuery.isError ||
    venueAliasCountQuery.isError ||
    localityAliasCountQuery.isError;

  const sources = sourcesQuery.data ?? [];
  const runs = runsQuery.data ?? [];
  const errors = errorsQuery.data ?? [];
  const sourceById = new Map(sources.map((s) => [s.id, s]));

  const enabledCount = sources.filter((s) => s.enabled).length;
  const robotsOkCount = sources.filter((s) => s.robots_ok).length;
  const lastRunBySource = new Map<string, EventSourceRun>();
  for (const r of runs) {
    if (!lastRunBySource.has(r.source_id)) lastRunBySource.set(r.source_id, r);
  }

  if (anyError) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          <AlertCircle className="h-5 w-5 mx-auto mb-2" />
          No disponible o sin permisos de administrador.
        </CardContent>
      </Card>
    );
  }

  const KpiCard = ({ icon: Icon, label, value, loading }: {
    icon: typeof Database; label: string; value: number | string; loading?: boolean;
  }) => (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center gap-1 text-xs">
          <Icon className="h-3.5 w-3.5" /> {label}
        </CardDescription>
        <CardTitle className="text-2xl">
          {loading ? <Skeleton className="h-7 w-12" /> : value}
        </CardTitle>
      </CardHeader>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard icon={Database} label="Fuentes" value={sources.length} loading={sourcesQuery.isLoading} />
        <KpiCard icon={CheckCircle2} label="Activas" value={enabledCount} loading={sourcesQuery.isLoading} />
        <KpiCard icon={ShieldCheck} label="robots_ok" value={robotsOkCount} loading={sourcesQuery.isLoading} />
        <KpiCard icon={Building2} label="Alias recintos" value={venueAliasCountQuery.data ?? 0} loading={venueAliasCountQuery.isLoading} />
        <KpiCard icon={MapPin} label="Alias localidades" value={localityAliasCountQuery.data ?? 0} loading={localityAliasCountQuery.isLoading} />
        <KpiCard icon={AlertCircle} label="Errores (50)" value={errors.length} loading={errorsQuery.isLoading} />
      </div>

      <Tabs defaultValue="sources" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="sources" className="flex-1">Fuentes</TabsTrigger>
          <TabsTrigger value="runs" className="flex-1">Ejecuciones</TabsTrigger>
          <TabsTrigger value="errors" className="flex-1">Errores</TabsTrigger>
        </TabsList>

        <TabsContent value="sources" className="space-y-2">
          {sourcesQuery.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : sources.length === 0 ? (
            <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">Sin fuentes registradas.</CardContent></Card>
          ) : (
            sources.map((s) => {
              const last = lastRunBySource.get(s.id);
              return (
                <Card key={s.id}>
                  <CardContent className="py-3 flex flex-wrap items-center gap-3">
                    <div className="flex-1 min-w-[220px]">
                      <div className="font-medium flex items-center gap-2 flex-wrap">
                        {s.name}
                        {s.enabled
                          ? <Badge className="bg-emerald-600 hover:bg-emerald-600">Activa</Badge>
                          : <Badge variant="secondary">Deshabilitada</Badge>}
                        {s.robots_ok
                          ? <Badge variant="outline" className="text-xs">robots ok</Badge>
                          : <Badge variant="outline" className="text-xs text-amber-600 border-amber-600/50">robots pend.</Badge>}
                        {s.kind && <Badge variant="outline" className="text-xs">{s.kind}</Badge>}
                        {typeof s.priority === 'number' && (
                          <Badge variant="outline" className="text-xs">p{s.priority}</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 space-x-2">
                        <span className="font-mono">{s.slug}</span>
                        {s.adapter_key && <span>· adapter: <span className="font-mono">{s.adapter_key}</span></span>}
                        {s.locality_slug && <span>· {s.locality_slug}</span>}
                      </div>
                      {s.base_url && (
                        <div className="text-xs text-muted-foreground font-mono truncate mt-0.5">{s.base_url}</div>
                      )}
                      {s.notes && (
                        <div className="text-xs text-muted-foreground mt-0.5 italic">{s.notes}</div>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <Clock className="h-3 w-3" />
                        {last ? fmt(last.started_at) : 'sin ejecuciones'}
                      </div>
                      {last && <div>{statusBadge(last.status)}</div>}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="runs" className="space-y-2">
          {runsQuery.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : runs.length === 0 ? (
            <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">Sin ejecuciones aún.</CardContent></Card>
          ) : (
            runs.map((r) => {
              const src = sourceById.get(r.source_id);
              const meta = (r.meta ?? {}) as Record<string, unknown>;
              const dryRun = meta.dryRun === true;
              const fetched = typeof meta.events_fetched === 'number' ? meta.events_fetched : null;
              const phase = typeof meta.phase === 'string' ? meta.phase : null;
              return (
                <Card key={r.id}>
                  <CardContent className="py-3 flex flex-wrap items-center gap-3 text-sm">
                    <div className="flex-1 min-w-[220px]">
                      <div className="flex items-center gap-2 flex-wrap">
                        {statusBadge(r.status)}
                        <span className="font-medium">{src?.name ?? r.source_id.slice(0, 8)}</span>
                        {dryRun && <Badge variant="outline" className="text-xs">dry-run</Badge>}
                        {phase && <Badge variant="outline" className="text-xs">fase {phase}</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {fmt(r.started_at)}
                        {r.duration_ms != null && ` · ${Math.round(r.duration_ms / 1000)}s`}
                        {r.finished_at && ` · fin ${fmt(r.finished_at)}`}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground text-right">
                      {fetched != null && <div>Encontrados: {fetched}</div>}
                      <div>Nuevos: {r.inserted ?? 0} · Actualizados: {r.updated ?? 0}</div>
                      <div>Dupes: {r.skipped_dupes ?? 0} · Errores: {r.errors ?? 0}</div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="errors" className="space-y-2">
          {errorsQuery.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : errors.length === 0 ? (
            <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">Sin errores registrados. 🎉</CardContent></Card>
          ) : (
            errors.map((e) => {
              const src = e.source_id ? sourceById.get(e.source_id) : null;
              return (
                <Card key={e.id}>
                  <CardContent className="py-3 text-sm">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge variant="destructive" className="text-xs">{e.stage ?? 'error'}</Badge>
                      {src && <span className="text-xs font-medium">{src.name}</span>}
                      <span className="text-xs text-muted-foreground">{fmt(e.created_at)}</span>
                    </div>
                    {e.message && <div className="text-sm break-words">{e.message}</div>}
                    {e.payload_sample != null && (
                      <pre className="text-xs text-muted-foreground bg-muted/40 rounded px-2 py-1 mt-1 overflow-hidden">
                        {truncate(e.payload_sample)}
                      </pre>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default IngestionRegistry;

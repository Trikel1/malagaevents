import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertCircle, CheckCircle2, Clock, Database, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type EventSource = {
  id: string;
  slug: string;
  name: string;
  kind: string | null;
  enabled: boolean;
  status: string | null;
  last_run_at: string | null;
  last_success_at: string | null;
  events_last_run: number | null;
  events_total: number | null;
  notes: string | null;
};

type SourceRun = {
  id: string;
  source_id: string;
  started_at: string;
  finished_at: string | null;
  status: string | null;
  events_found: number | null;
  events_inserted: number | null;
  events_updated: number | null;
  events_skipped: number | null;
  errors_count: number | null;
  duration_ms: number | null;
  triggered_by: string | null;
};

type IngestionError = {
  id: string;
  source_id: string | null;
  created_at: string;
  error_type: string | null;
  message: string | null;
  url: string | null;
};

const statusBadge = (status: string | null | undefined, enabled?: boolean) => {
  if (enabled === false) return <Badge variant="secondary">Deshabilitada</Badge>;
  switch (status) {
    case 'success':
    case 'ok':
      return <Badge className="bg-emerald-600 hover:bg-emerald-600">OK</Badge>;
    case 'running':
      return <Badge className="bg-blue-600 hover:bg-blue-600">En curso</Badge>;
    case 'error':
    case 'failed':
      return <Badge variant="destructive">Error</Badge>;
    case 'idle':
    case null:
    case undefined:
      return <Badge variant="outline">Sin ejecutar</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

const fmt = (d: string | null | undefined) =>
  d ? format(new Date(d), "d MMM yyyy, HH:mm", { locale: es }) : '—';

const IngestionRegistry = () => {
  const sourcesQuery = useQuery({
    queryKey: ['admin', 'event_sources'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_sources' as any)
        .select('*')
        .order('enabled', { ascending: false })
        .order('name', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as EventSource[];
    },
  });

  const runsQuery = useQuery({
    queryKey: ['admin', 'event_source_runs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_source_runs' as any)
        .select('*')
        .order('started_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as SourceRun[];
    },
  });

  const errorsQuery = useQuery({
    queryKey: ['admin', 'ingestion_errors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ingestion_errors' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as IngestionError[];
    },
  });

  const sources = sourcesQuery.data ?? [];
  const runs = runsQuery.data ?? [];
  const errors = errorsQuery.data ?? [];

  const enabledCount = sources.filter((s) => s.enabled).length;
  const totalEvents = sources.reduce((sum, s) => sum + (s.events_total ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Database className="h-3.5 w-3.5" /> Fuentes
            </CardDescription>
            <CardTitle className="text-2xl">{sources.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> Activas
            </CardDescription>
            <CardTitle className="text-2xl">{enabledCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> Ejecuciones (50)
            </CardDescription>
            <CardTitle className="text-2xl">{runs.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5" /> Errores (50)
            </CardDescription>
            <CardTitle className="text-2xl">{errors.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Tabs defaultValue="sources" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="sources" className="flex-1">Fuentes</TabsTrigger>
          <TabsTrigger value="runs" className="flex-1">Ejecuciones</TabsTrigger>
          <TabsTrigger value="errors" className="flex-1">Errores</TabsTrigger>
        </TabsList>

        <TabsContent value="sources" className="space-y-2">
          {sourcesQuery.isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : sources.length === 0 ? (
            <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">Sin fuentes registradas.</CardContent></Card>
          ) : (
            sources.map((s) => (
              <Card key={s.id}>
                <CardContent className="py-3 flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[200px]">
                    <div className="font-medium flex items-center gap-2">
                      {s.name}
                      {statusBadge(s.status, s.enabled)}
                      {s.kind && <Badge variant="outline" className="text-xs">{s.kind}</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      <span className="font-mono">{s.slug}</span>
                      {s.notes && <span> · {s.notes}</span>}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground text-right">
                    <div>Último: {fmt(s.last_run_at)}</div>
                    <div>OK: {fmt(s.last_success_at)}</div>
                    <div>Eventos: {s.events_last_run ?? 0} / total {s.events_total ?? 0}</div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="runs" className="space-y-2">
          {runsQuery.isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : runs.length === 0 ? (
            <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">Sin ejecuciones aún.</CardContent></Card>
          ) : (
            runs.map((r) => (
              <Card key={r.id}>
                <CardContent className="py-3 flex flex-wrap items-center gap-3 text-sm">
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center gap-2">
                      {statusBadge(r.status)}
                      <span className="text-xs text-muted-foreground font-mono">{r.source_id.slice(0, 8)}</span>
                      {r.triggered_by && <Badge variant="outline" className="text-xs">{r.triggered_by}</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {fmt(r.started_at)} {r.duration_ms != null && `· ${Math.round(r.duration_ms / 1000)}s`}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground text-right">
                    <div>Encontrados: {r.events_found ?? 0}</div>
                    <div>Nuevos: {r.events_inserted ?? 0} · Actualizados: {r.events_updated ?? 0}</div>
                    <div>Omitidos: {r.events_skipped ?? 0} · Errores: {r.errors_count ?? 0}</div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="errors" className="space-y-2">
          {errorsQuery.isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : errors.length === 0 ? (
            <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">Sin errores registrados. 🎉</CardContent></Card>
          ) : (
            errors.map((e) => (
              <Card key={e.id}>
                <CardContent className="py-3 text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="destructive" className="text-xs">{e.error_type ?? 'error'}</Badge>
                    <span className="text-xs text-muted-foreground">{fmt(e.created_at)}</span>
                  </div>
                  {e.message && <div className="text-sm">{e.message}</div>}
                  {e.url && <div className="text-xs text-muted-foreground font-mono truncate mt-1">{e.url}</div>}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default IngestionRegistry;

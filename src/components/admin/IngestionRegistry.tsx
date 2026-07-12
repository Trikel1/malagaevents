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
  ExternalLink,
  Copy,
  KeyRound,
  ShieldOff,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  write_confirmed_at: string | null;
  write_confirmed_by: string | null;
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

type PreviewItem = {
  title: string | null;
  startAt: string | null;
  venueName: string | null;
  locality: string | null;
  category: string | null;
  sourceUrl: string | null;
  ticketUrl: string | null;
  imageUrl: string | null;
  timeAssumed: boolean;
  dateLine: string | null;
  cycleText: string | null;
};

type DryRunResponse = {
  ok?: boolean;
  dryRun?: boolean;
  runId?: string;
  status?: string;
  inserted?: number;
  updated?: number;
  skippedDupes?: number;
  errors?: number;
  previewCount?: number;
  preview?: PreviewItem[];
  error?: string;
};

type PreflightAction = 'insert' | 'update' | 'skip' | 'conflict';

type PreflightItem = {
  action: PreflightAction;
  title: string | null;
  startAt: string | null;
  venueName: string | null;
  canonicalVenue: string | null;
  locality: string | null;
  category: string | null;
  sourceUrl: string | null;
  ticketUrl: string | null;
  imageUrl: string | null;
  existingEventId: string | null;
  existingDedupeKey: string | null;
  newDedupeKey: string;
  reason: string;
  raw: { timeAssumed: boolean; dateLine: string | null; cycleText: string | null };
};

type PreflightResponse = {
  ok?: boolean;
  dryRun?: boolean;
  sourceId?: string;
  sourceName?: string;
  adapter?: string;
  totalFetched?: number;
  wouldInsert?: number;
  wouldUpdate?: number;
  wouldSkip?: number;
  conflicts?: number;
  warnings?: string[];
  generatedAt?: string;
  preview?: PreflightItem[];
  error?: string;
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
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<DryRunResponse | null>(null);
  const [previewSourceName, setPreviewSourceName] = useState<string>('');
  const [preflightOpen, setPreflightOpen] = useState(false);
  const [preflightData, setPreflightData] = useState<PreflightResponse | null>(null);
  const [preflightBusyId, setPreflightBusyId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmSource, setConfirmSource] = useState<EventSource | null>(null);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [confirmNote, setConfirmNote] = useState('');
  const [confirmBusy, setConfirmBusy] = useState(false);

  const openConfirmDialog = (s: EventSource) => {
    setConfirmSource(s);
    setConfirmChecked(false);
    setConfirmNote('');
    setConfirmOpen(true);
  };

  const submitConfirm = async () => {
    if (!confirmSource || !confirmChecked) return;
    const revoking = !!confirmSource.write_confirmed_at;
    setConfirmBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        'admin-source-confirm-write',
        {
          body: {
            sourceId: confirmSource.id,
            confirm: !revoking,
            note: confirmNote.slice(0, 500),
          },
        },
      );
      if (error) throw error;
      const res = (data ?? {}) as { action?: string; writeConfirmedAt?: string | null };
      toast({
        title: revoking ? 'Autorización revocada' : 'Autorización registrada',
        description: revoking
          ? 'La fuente ya no está marcada como preparada para escritura.'
          : `Marcada como preparada. Sigue sin escribir eventos ni activarse. (${res.action ?? '—'})`,
      });
      setConfirmOpen(false);
      invalidateAll();
    } catch (e: any) {
      const msg = e?.message ?? '';
      const forbidden = /forbidden|unauthorized|invalid_token/i.test(msg);
      toast({
        title: forbidden ? 'Sin permisos' : 'No se pudo actualizar',
        description: forbidden ? 'Necesitas rol admin.' : msg || 'Error desconocido',
        variant: 'destructive',
      });
    } finally {
      setConfirmBusy(false);
    }
  };


  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'ingesta'] });
  };

  const runDry = async (sourceId?: string, sourceName?: string) => {
    setBusySourceId(sourceId ?? '__dispatcher__');
    try {
      if (sourceId) {
        // Dedicated admin function: forces dryRun=true server-side and
        // returns only a sanitized summary. No secrets in the browser.
        const { data, error } = await supabase.functions.invoke(
          'admin-ingest-dry-run',
          { body: { sourceId } },
        );
        if (error) throw error;
        const s = (data ?? {}) as DryRunResponse;
        setPreviewData(s);
        setPreviewSourceName(sourceName ?? '');
        setPreviewOpen(true);
        toast({
          title: 'Dry-run completado',
          description:
            typeof s.previewCount === 'number'
              ? `${s.previewCount} eventos normalizados · ${s.errors ?? 0} errores`
              : s.status
                ? `Estado: ${s.status} · ${s.errors ?? 0} errores`
                : 'Ejecución registrada',
        });
      } else {
        const { data, error } = await supabase.functions.invoke('admin-ingest', {
          body: { action: 'ingest-dispatcher', dryRun: true },
        });
        if (error) throw error;
        const summary = data as { processed?: number; errors?: number };
        toast({
          title: 'Dry-run completado',
          description: `Procesadas ${summary?.processed ?? 0} fuentes · ${summary?.errors ?? 0} errores`,
        });
      }
      setAutoRefresh(true);
      setTimeout(() => setAutoRefresh(false), 8000);
      invalidateAll();
    } catch (e: any) {
      const msg = e?.message ?? '';
      const forbidden = /forbidden|unauthorized|invalid_token/i.test(msg);
      toast({
        title: forbidden ? 'Sin permisos' : 'No se pudo ejecutar dry-run',
        description: forbidden
          ? 'Necesitas rol admin para ejecutar esta acción.'
          : msg || 'Error desconocido',
        variant: 'destructive',
      });
    } finally {
      setBusySourceId(null);
    }
  };

  const runPreflight = async (sourceId: string, sourceName: string) => {
    setPreflightBusyId(sourceId);
    try {
      const { data, error } = await supabase.functions.invoke(
        'admin-ingest-preflight',
        { body: { sourceId } },
      );
      if (error) throw error;
      const s = (data ?? {}) as PreflightResponse;
      setPreflightData({ ...s, sourceName: s.sourceName ?? sourceName });
      setPreflightOpen(true);
      toast({
        title: 'Preflight completado',
        description: `Insert ${s.wouldInsert ?? 0} · Update ${s.wouldUpdate ?? 0} · Skip ${s.wouldSkip ?? 0} · Conflict ${s.conflicts ?? 0}`,
      });
      setAutoRefresh(true);
      setTimeout(() => setAutoRefresh(false), 4000);
      invalidateAll();
    } catch (e: any) {
      const msg = e?.message ?? '';
      const forbidden = /forbidden|unauthorized|invalid_token/i.test(msg);
      toast({
        title: forbidden ? 'Sin permisos' : 'No se pudo ejecutar preflight',
        description: forbidden ? 'Necesitas rol admin.' : msg || 'Error desconocido',
        variant: 'destructive',
      });
    } finally {
      setPreflightBusyId(null);
    }
  };




  const sourcesQuery = useQuery({
    queryKey: ['admin', 'ingesta', 'event_sources'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_sources' as any)
        .select(
          'id, slug, name, kind, base_url, adapter_key, locality_slug, category_hints, priority, enabled, schedule_cron, robots_ok, notes, write_confirmed_at, write_confirmed_by, created_at, updated_at',
        )
        .order('priority', { ascending: false })
        .order('name', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as EventSource[];
    },
  });

  const runsQuery = useQuery({
    refetchInterval: autoRefresh ? 2000 : false,
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

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          onClick={() => runDry()}
          disabled={busySourceId !== null}
          className="gap-1"
        >
          {busySourceId === '__dispatcher__' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          Dry-run dispatcher
        </Button>
        <Button size="sm" variant="outline" onClick={invalidateAll} className="gap-1">
          <RefreshCw className="h-3.5 w-3.5" /> Refrescar
        </Button>
        <span className="text-xs text-muted-foreground">
          Escritura real deshabilitada (WRITE_ENABLED=false)
        </span>
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
                    <div className="text-xs text-muted-foreground text-right flex flex-col items-end gap-1">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {last ? fmt(last.started_at) : 'sin ejecuciones'}
                      </div>
                      {last && <div>{statusBadge(last.status)}</div>}
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 gap-1"
                          onClick={() => runDry(s.id, s.name)}
                          disabled={busySourceId !== null || preflightBusyId !== null}
                        >
                          {busySourceId === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                          Dry-run
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 gap-1"
                          onClick={() => runPreflight(s.id, s.name)}
                          disabled={busySourceId !== null || preflightBusyId !== null}
                          title="Calcular diff sin escribir nada"
                        >
                          {preflightBusyId === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
                          Preparar escritura
                        </Button>
                      </div>
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

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              <span>Dry-run</span>
              {previewSourceName && (
                <Badge variant="outline" className="text-xs">{previewSourceName}</Badge>
              )}
              {previewData?.status && statusBadge(previewData.status)}
              <Badge variant="outline" className="text-xs">dry-run</Badge>
            </DialogTitle>
            <DialogDescription className="text-xs">
              {previewData
                ? `${previewData.previewCount ?? 0} eventos normalizados · ${previewData.errors ?? 0} errores · WRITE_ENABLED=false`
                : 'Sin datos'}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-3 -mr-3">
            {!previewData ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Sin datos de preview.
              </div>
            ) : previewData.error ? (
              <div className="py-6 text-sm text-destructive break-words">
                {previewData.error}
              </div>
            ) : !previewData.preview || previewData.preview.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <AlertCircle className="h-5 w-5 mx-auto mb-2 opacity-60" />
                El adaptador no devolvió eventos parseables en este dry-run.
              </div>
            ) : (
              <div className="space-y-2">
                {previewData.preview.map((it, idx) => (
                  <Card key={idx} className="border-muted">
                    <CardContent className="py-3 text-sm space-y-1">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="font-medium break-words flex-1 min-w-0">
                          {it.title ?? <span className="italic text-muted-foreground">sin título</span>}
                        </div>
                        <div className="flex items-center gap-1 flex-wrap">
                          {it.category && (
                            <Badge variant="secondary" className="text-xs">{it.category}</Badge>
                          )}
                          {it.timeAssumed && (
                            <Badge variant="outline" className="text-xs text-amber-600 border-amber-600/50">
                              hora estimada
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                        {it.startAt && (
                          <span>
                            {(() => {
                              try {
                                return format(new Date(it.startAt), "EEE d MMM yyyy · HH:mm", { locale: es });
                              } catch {
                                return it.startAt;
                              }
                            })()}
                          </span>
                        )}
                        {it.venueName && (
                          <span className="inline-flex items-center gap-1">
                            <Building2 className="h-3 w-3" /> {it.venueName}
                          </span>
                        )}
                        {it.locality && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {it.locality}
                          </span>
                        )}
                      </div>
                      {(it.cycleText || it.dateLine) && (
                        <div className="text-xs text-muted-foreground italic break-words">
                          {it.cycleText && <span>Ciclo: {it.cycleText}</span>}
                          {it.cycleText && it.dateLine && <span> · </span>}
                          {it.dateLine && <span className="font-mono">{it.dateLine}</span>}
                        </div>
                      )}
                      <div className="flex items-center gap-3 text-xs pt-0.5 flex-wrap">
                        {it.sourceUrl && (
                          <a
                            href={it.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" /> Fuente
                          </a>
                        )}
                        {it.ticketUrl && (
                          <a
                            href={it.ticketUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" /> Entradas
                          </a>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={async () => {
                if (!previewData) return;
                try {
                  await navigator.clipboard.writeText(JSON.stringify(previewData, null, 2));
                  toast({ title: 'JSON copiado al portapapeles' });
                } catch {
                  toast({
                    title: 'No se pudo copiar',
                    variant: 'destructive',
                  });
                }
              }}
              disabled={!previewData}
            >
              <Copy className="h-3.5 w-3.5" /> Copiar JSON
            </Button>
            <Button size="sm" onClick={() => setPreviewOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={preflightOpen} onOpenChange={setPreflightOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              <ShieldCheck className="h-4 w-4" />
              <span>Preflight de escritura</span>
              {preflightData?.sourceName && (
                <Badge variant="outline" className="text-xs">{preflightData.sourceName}</Badge>
              )}
              {preflightData?.adapter && (
                <Badge variant="outline" className="text-xs font-mono">{preflightData.adapter}</Badge>
              )}
              <Badge variant="outline" className="text-xs">dry-run</Badge>
            </DialogTitle>
            <DialogDescription className="text-xs">
              {preflightData
                ? `Total ${preflightData.totalFetched ?? 0} · Insert ${preflightData.wouldInsert ?? 0} · Update ${preflightData.wouldUpdate ?? 0} · Skip ${preflightData.wouldSkip ?? 0} · Conflict ${preflightData.conflicts ?? 0}`
                : 'Sin datos'}
              {' · sin escrituras reales'}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-3 -mr-3">
            {!preflightData ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Sin datos.</div>
            ) : preflightData.error ? (
              <div className="py-6 text-sm text-destructive break-words">{preflightData.error}</div>
            ) : (
              <div className="space-y-3">
                {preflightData.warnings && preflightData.warnings.length > 0 && (
                  <Card className="border-amber-500/40">
                    <CardContent className="py-2 text-xs space-y-1">
                      <div className="font-medium flex items-center gap-1">
                        <AlertCircle className="h-3.5 w-3.5" /> Warnings ({preflightData.warnings.length})
                      </div>
                      {preflightData.warnings.slice(0, 10).map((w, i) => (
                        <div key={i} className="text-muted-foreground break-words font-mono">{w}</div>
                      ))}
                    </CardContent>
                  </Card>
                )}
                {(!preflightData.preview || preflightData.preview.length === 0) ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    <AlertCircle className="h-5 w-5 mx-auto mb-2 opacity-60" />
                    Sin eventos para clasificar.
                  </div>
                ) : (
                  preflightData.preview.map((it, idx) => {
                    const actionBadge = (() => {
                      switch (it.action) {
                        case 'insert':
                          return <Badge className="bg-emerald-600 hover:bg-emerald-600 text-xs">insert</Badge>;
                        case 'update':
                          return <Badge className="bg-blue-600 hover:bg-blue-600 text-xs">update</Badge>;
                        case 'skip':
                          return <Badge variant="secondary" className="text-xs">skip</Badge>;
                        case 'conflict':
                          return <Badge variant="destructive" className="text-xs">conflict</Badge>;
                      }
                    })();
                    return (
                      <Card key={idx} className="border-muted">
                        <CardContent className="py-3 text-sm space-y-1">
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <div className="font-medium break-words flex-1 min-w-0">
                              {it.title ?? <span className="italic text-muted-foreground">sin título</span>}
                            </div>
                            <div className="flex items-center gap-1 flex-wrap">
                              {actionBadge}
                              {it.category && <Badge variant="secondary" className="text-xs">{it.category}</Badge>}
                              {it.raw.timeAssumed && (
                                <Badge variant="outline" className="text-xs text-amber-600 border-amber-600/50">
                                  hora estimada
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                            {it.startAt && (
                              <span>
                                {(() => {
                                  try { return format(new Date(it.startAt), "EEE d MMM yyyy · HH:mm", { locale: es }); }
                                  catch { return it.startAt; }
                                })()}
                              </span>
                            )}
                            {(it.canonicalVenue ?? it.venueName) && (
                              <span className="inline-flex items-center gap-1">
                                <Building2 className="h-3 w-3" /> {it.canonicalVenue ?? it.venueName}
                              </span>
                            )}
                            {it.locality && (
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="h-3 w-3" /> {it.locality}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground font-mono break-all">
                            {it.reason} · new={it.newDedupeKey.slice(0, 12)}…
                            {it.existingEventId && (
                              <> · existing={it.existingEventId.slice(0, 8)}…</>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs pt-0.5 flex-wrap">
                            {it.sourceUrl && (
                              <a href={it.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                                <ExternalLink className="h-3 w-3" /> Fuente
                              </a>
                            )}
                            {it.ticketUrl && (
                              <a href={it.ticketUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                                <ExternalLink className="h-3 w-3" /> Entradas
                              </a>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            )}
          </ScrollArea>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={async () => {
                if (!preflightData) return;
                try {
                  await navigator.clipboard.writeText(JSON.stringify(preflightData, null, 2));
                  toast({ title: 'JSON copiado al portapapeles' });
                } catch {
                  toast({ title: 'No se pudo copiar', variant: 'destructive' });
                }
              }}
              disabled={!preflightData}
            >
              <Copy className="h-3.5 w-3.5" /> Copiar JSON
            </Button>
            <Button size="sm" onClick={() => setPreflightOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default IngestionRegistry;

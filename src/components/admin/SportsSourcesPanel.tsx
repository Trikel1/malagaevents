import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2, Play, CheckCircle2, XCircle, AlertTriangle, MinusCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface SportSource {
  id: string;
  slug: string;
  name: string;
  municipality: string | null;
  province: string | null;
  source_type: string;
  adapter_key: string | null;
  primary_url: string | null;
  enabled: boolean;
  priority: number;
  last_status: string | null;
  last_success_at: string | null;
  last_attempt_at: string | null;
  last_error: string | null;
  consecutive_failures: number;
  items_upserted: number;
  items_fetched: number;
  robots_allowed: boolean | null;
  robots_checked_at: string | null;
}


const StatusBadge = ({ status }: { status: string | null }) => {
  if (!status) {
    return (
      <Badge variant="secondary" className="text-xs">
        <MinusCircle className="h-3 w-3 mr-1" /> sin datos
      </Badge>
    );
  }
  if (status === 'success') {
    return (
      <Badge className="text-xs bg-emerald-600 hover:bg-emerald-600">
        <CheckCircle2 className="h-3 w-3 mr-1" /> ok
      </Badge>
    );
  }
  if (status === 'partial') {
    return (
      <Badge variant="secondary" className="text-xs">
        <AlertTriangle className="h-3 w-3 mr-1" /> parcial
      </Badge>
    );
  }
  if (status === 'running') {
    return (
      <Badge variant="secondary" className="text-xs">
        <Loader2 className="h-3 w-3 mr-1 animate-spin" /> ejecutando
      </Badge>
    );
  }
  return (
    <Badge variant="destructive" className="text-xs">
      <XCircle className="h-3 w-3 mr-1" /> {status}
    </Badge>
  );
};

interface SyncRun {
  id: string;
  source_slug: string;
  adapter: string | null;
  status: string;
  started_at: string;
  finished_at: string | null;
  items_fetched: number;
  items_parsed: number;
  items_upserted: number;
  items_failed: number;
  error_sample: string | null;
}

export default function SportsSourcesPanel() {
  const { toast } = useToast();
  const [sources, setSources] = useState<SportSource[]>([]);
  const [runs, setRuns] = useState<SyncRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningSlug, setRunningSlug] = useState<string | null>(null);
  const [runningAll, setRunningAll] = useState(false);

  const fetchSources = async () => {
    setLoading(true);
    const [srcRes, runsRes] = await Promise.all([
      supabase.from('sports_sources').select('*').order('priority', { ascending: true }),
      supabase
        .from('sports_sync_runs')
        .select('id, source_slug, adapter, status, started_at, finished_at, items_fetched, items_parsed, items_upserted, items_failed, error_sample')
        .order('started_at', { ascending: false })
        .limit(20),
    ]);
    if (srcRes.error) {
      toast({ title: 'Error', description: srcRes.error.message, variant: 'destructive' });
    } else {
      setSources((srcRes.data as SportSource[]) || []);
    }
    if (!runsRes.error) {
      setRuns((runsRes.data as SyncRun[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSources();
  }, []);

  const runSource = async (slug: string) => {
    setRunningSlug(slug);
    try {
      const { data, error } = await supabase.functions.invoke('admin-sync-sports-source', {
        body: { slug },
      });
      if (error) throw error;
      toast({
        title: 'Sincronización lanzada',
        description: data?.ok ? `${slug}: OK` : `${slug}: revisar`,
      });
      await fetchSources();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err?.message ?? 'unknown error',
        variant: 'destructive',
      });
    } finally {
      setRunningSlug(null);
    }
  };

  const runAll = async () => {
    setRunningAll(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-sync-sports-source', {
        body: { all: true },
      });
      if (error) throw error;
      toast({
        title: 'Sincronización completa',
        description: `Procesadas ${data?.count ?? 0} fuentes`,
      });
      await fetchSources();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err?.message ?? 'unknown error',
        variant: 'destructive',
      });
    } finally {
      setRunningAll(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-2 flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Fuentes deportivas registradas</CardTitle>
            <CardDescription>
              {sources.length} fuentes MVP para Málaga y provincia. Adaptador, estado y última
              ejecución.
            </CardDescription>
          </div>
          <Button size="sm" onClick={runAll} disabled={runningAll}>
            {runningAll ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-1" />
            )}
            Sincronizar todas
          </Button>
        </CardHeader>
      </Card>


      {sources.map((src) => (
        <Card key={src.id} data-testid={`sports-source-${src.slug}`}>
          <CardContent className="py-3">
            <div className="flex items-start gap-3 flex-wrap">
              <div className="flex-1 min-w-[220px]">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{src.name}</span>
                  <Badge variant="outline" className="text-xs uppercase">
                    {src.source_type}
                  </Badge>
                  {!src.enabled && (
                    <Badge variant="secondary" className="text-xs">
                      deshabilitada
                    </Badge>
                  )}
                  {src.consecutive_failures > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {src.consecutive_failures} fallos
                    </Badge>
                  )}
                  {src.robots_allowed === false && (
                    <Badge variant="destructive" className="text-xs">
                      robots bloqueado
                    </Badge>
                  )}
                  {src.robots_allowed === true && (
                    <Badge variant="outline" className="text-xs">
                      robots ok
                    </Badge>
                  )}

                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {src.municipality ? `${src.municipality} · ` : ''}
                  {src.province ?? 'Málaga'}
                </p>
                {src.primary_url && (
                  <a
                    href={src.primary_url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-xs text-primary underline break-all"
                  >
                    {src.primary_url}
                  </a>
                )}
                {src.last_error && (
                  <p className="text-xs text-destructive mt-1 line-clamp-2" title={src.last_error}>
                    {src.last_error}
                  </p>
                )}
              </div>

              <div className="flex flex-col items-end gap-1 text-xs">
                <StatusBadge status={src.last_status} />
                <span className="text-muted-foreground">
                  {src.last_success_at
                    ? `OK: ${format(new Date(src.last_success_at), "d MMM HH:mm", { locale: es })}`
                    : 'sin ejecuciones OK'}
                </span>
                <span className="text-muted-foreground">
                  ↑{src.items_upserted ?? 0} · ↓{src.items_fetched ?? 0}
                </span>
              </div>

              <Button
                size="sm"
                variant="outline"
                disabled={!src.enabled || runningSlug === src.slug}
                onClick={() => runSource(src.slug)}
              >
                {runningSlug === src.slug ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-1" />
                )}
                Ejecutar
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      {runs.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Ejecuciones recientes</CardTitle>
            <CardDescription>Últimas {runs.length} ejecuciones registradas.</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-1.5 text-xs">
              {runs.map((r) => (
                <div
                  key={r.id}
                  className="flex items-start gap-2 flex-wrap py-1.5 border-b border-border/40 last:border-0"
                >
                  <StatusBadge status={r.status} />
                  <span className="font-medium min-w-[160px]">{r.source_slug}</span>
                  <span className="text-muted-foreground">
                    {format(new Date(r.started_at), 'd MMM HH:mm:ss', { locale: es })}
                  </span>
                  <span className="text-muted-foreground">
                    ↓{r.items_fetched} · ⚙{r.items_parsed} · ↑{r.items_upserted}
                    {r.items_failed > 0 && ` · ✗${r.items_failed}`}
                  </span>
                  {r.adapter && (
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {r.adapter}
                    </Badge>
                  )}
                  {r.error_sample && (
                    <span
                      className="text-destructive line-clamp-1 basis-full"
                      title={r.error_sample}
                    >
                      {r.error_sample}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

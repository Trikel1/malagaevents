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

export default function SportsSourcesPanel() {
  const { toast } = useToast();
  const [sources, setSources] = useState<SportSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningSlug, setRunningSlug] = useState<string | null>(null);

  const fetchSources = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('sports_sources')
      .select('*')
      .order('priority', { ascending: true });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setSources((data as SportSource[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSources();
  }, []);

  const runSource = async (slug: string) => {
    setRunningSlug(slug);
    try {
      const { data, error } = await supabase.functions.invoke('admin-sync-sports', {
        body: { slug, force: true, cooldownMinutes: 0 },
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
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Fuentes deportivas registradas</CardTitle>
          <CardDescription>
            {sources.length} fuentes MVP para Málaga y provincia. Adaptador, estado y última
            ejecución.
          </CardDescription>
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
    </div>
  );
}

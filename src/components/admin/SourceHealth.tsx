import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertCircle, CheckCircle2, PauseCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface SourceRow {
  id: string;
  slug: string;
  name: string;
  kind: string;
  scope: string | null;
  source_type: string | null;
  priority: number | null;
  trust_level: number | null;
  enabled: boolean;
  robots_ok: boolean;
  paused_reason: string | null;
  last_success_at: string | null;
  last_error_at: string | null;
  consecutive_errors: number | null;
  write_confirmed_at: string | null;
}

/**
 * SourceHealth — read-only dashboard listing all cultural ingestion sources
 * with their scope, priority, status and last success/error.
 *
 * Purely presentational: pause/resume actions still go through the existing
 * `admin-source-toggle-enabled` edge function elsewhere in the admin panel.
 */
const SourceHealth = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['source-health'],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_sources')
        .select(
          'id, slug, name, kind, scope, source_type, priority, trust_level, enabled, robots_ok, paused_reason, last_success_at, last_error_at, consecutive_errors, write_confirmed_at',
        )
        .order('priority', { ascending: true, nullsFirst: false })
        .order('name', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as SourceRow[];
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="text-sm text-destructive flex items-center gap-2">
        <AlertCircle className="h-4 w-4" /> Error cargando fuentes
      </div>
    );
  }

  const sources = data ?? [];
  const active = sources.filter((s) => s.enabled).length;
  const paused = sources.filter((s) => !s.enabled).length;
  const withErrors = sources.filter((s) => (s.consecutive_errors ?? 0) > 0).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Activas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" /> {active}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pausadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              <PauseCircle className="h-5 w-5 text-amber-500" /> {paused}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Con errores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" /> {withErrors}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-md border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Fuente</th>
                <th className="px-3 py-2">Ámbito</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Prioridad</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Último éxito</th>
                <th className="px-3 py-2">Último error</th>
                <th className="px-3 py-2">Errores</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => {
                const priorityLabel =
                  s.priority === 10 ? 'P0' : s.priority === 20 ? 'P1' : s.priority ? `P${Math.floor(s.priority / 10)}` : '—';
                return (
                  <tr key={s.id} className="border-t">
                    <td className="px-3 py-2">
                      <div className="font-medium">{s.name}</div>
                      <div className="text-xs text-muted-foreground">{s.slug}</div>
                    </td>
                    <td className="px-3 py-2">{s.scope ?? '—'}</td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className="uppercase text-[10px]">
                        {s.source_type ?? s.kind}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">{priorityLabel}</td>
                    <td className="px-3 py-2">
                      {s.enabled ? (
                        <Badge variant="default" className="bg-emerald-500/15 text-emerald-700">
                          activa
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          pausada{s.paused_reason ? ` · ${s.paused_reason}` : ''}
                        </Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {s.last_success_at
                        ? formatDistanceToNow(new Date(s.last_success_at), { addSuffix: true, locale: es })
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {s.last_error_at
                        ? formatDistanceToNow(new Date(s.last_error_at), { addSuffix: true, locale: es })
                        : '—'}
                    </td>
                    <td className="px-3 py-2">
                      {(s.consecutive_errors ?? 0) > 0 ? (
                        <Badge variant="destructive">{s.consecutive_errors}</Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SourceHealth;

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Radar, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';

interface CoverageRow {
  source_id: string;
  source_slug: string;
  source_name: string | null;
  source_kind: string | null;
  source_enabled: boolean;
  priority_tier: number | null;
  last_success_at: string | null;
  last_error_at: string | null;
  consecutive_errors: number | null;
  canonical_source_id: string | null;
  future_events: number | null;
  next_event_at: string | null;
  distinct_future_venues: number | null;
  last_event_updated_at: string | null;
}

const PRIORITY_VENUES = [
  'Teatro Cervantes',
  'Teatro Echegaray',
  'Teatro del Soho',
  'Sala Cánovas',
  'Cine Albéniz',
  'Centro Pompidou Málaga',
  'CAC Málaga',
  'MIMMA',
  'La Cochera Cabaret',
  'La Térmica',
  'Sala París 15',
  'Auditorio Edgar Neville',
];

function toCSV(rows: CoverageRow[]): string {
  const header = [
    'slug',
    'nombre',
    'habilitada',
    'canonica',
    'eventos_futuros',
    'recintos_futuros',
    'proximo_evento',
    'ultimo_exito',
    'ultimo_error',
    'errores_consecutivos',
  ].join(',');
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return '';
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  const body = rows
    .map((r) =>
      [
        r.source_slug,
        r.source_name ?? '',
        r.source_enabled ? 'si' : 'no',
        r.canonical_source_id ? 'duplicada' : 'canonica',
        r.future_events ?? 0,
        r.distinct_future_venues ?? 0,
        r.next_event_at ?? '',
        r.last_success_at ?? '',
        r.last_error_at ?? '',
        r.consecutive_errors ?? 0,
      ]
        .map(esc)
        .join(','),
    )
    .join('\n');
  return `${header}\n${body}\n`;
}

function relTime(iso: string | null): string {
  if (!iso) return '—';
  const diffMs = Date.now() - new Date(iso).getTime();
  const h = Math.round(diffMs / 3_600_000);
  if (h < 1) return 'hace <1 h';
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return `hace ${d} d`;
}

export default function CitizenServiceRadar() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['citizen-service-radar'],
    queryFn: async (): Promise<CoverageRow[]> => {
      const { data, error } = await supabase
        .from('event_source_coverage' as any)
        .select('*')
        .order('future_events', { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as CoverageRow[];
    },
    staleTime: 60_000,
  });

  const { data: activeVenues } = useQuery({
    queryKey: ['radar-active-venues'],
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase
        .from('events')
        .select('venue_name')
        .eq('status', 'published')
        .gt('start_at', new Date().toISOString())
        .limit(1000);
      if (error) throw error;
      const set = new Set<string>();
      for (const row of (data ?? []) as { venue_name: string | null }[]) {
        if (row.venue_name) set.add(row.venue_name);
      }
      return set;
    },
    staleTime: 60_000,
  });

  const summary = useMemo(() => {
    if (!data) return null;
    const enabled = data.filter((r) => r.source_enabled);
    const operational = enabled.filter((r) => (r.future_events ?? 0) > 0);
    const pending = enabled.filter((r) => (r.future_events ?? 0) === 0);
    const totalFutureEvents = data.reduce((s, r) => s + (r.future_events ?? 0), 0);
    const totalFutureVenues = new Set<string>();
    // aggregate by max future venues per source is a lower bound; use activeVenues instead
    const lastSuccess = data
      .map((r) => r.last_success_at)
      .filter((v): v is string => !!v)
      .sort()
      .pop();
    return {
      enabledCount: enabled.length,
      operationalCount: operational.length,
      pendingCount: pending.length,
      totalFutureEvents,
      lastSuccess: lastSuccess ?? null,
      activeVenuesCount: activeVenues?.size ?? null,
    };
  }, [data, activeVenues]);

  const gaps = useMemo(() => {
    if (!activeVenues) return null;
    return PRIORITY_VENUES.map((v) => ({ venue: v, hasActivity: activeVenues.has(v) }));
  }, [activeVenues]);

  const staleSources = useMemo(() => {
    if (!data) return [];
    const cutoff = Date.now() - 7 * 24 * 3_600_000;
    return data
      .filter((r) => r.source_enabled)
      .filter((r) => !r.last_success_at || new Date(r.last_success_at).getTime() < cutoff)
      .slice(0, 6);
  }, [data]);

  const downloadCSV = () => {
    if (!data) return;
    const blob = new Blob([toCSV(data)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `radar-cobertura-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Radar className="h-4 w-4 text-primary" aria-hidden />
            Radar de servicio ciudadano
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1 max-w-lg">
            Panorama transparente de cobertura cultural real. No es una herramienta oficial ni afirma
            cubrir toda Málaga.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={downloadCSV}
          disabled={!data || data.length === 0}
        >
          <Download className="h-4 w-4 mr-1.5" />
          CSV
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
        {error && (
          <p className="text-sm text-destructive">No se pudo leer la vista de cobertura.</p>
        )}

        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Metric label="Eventos futuros" value={summary.totalFutureEvents} />
            <Metric
              label="Recintos con actividad"
              value={summary.activeVenuesCount ?? '—'}
            />
            <Metric
              label="Fuentes operativas"
              value={`${summary.operationalCount}/${summary.enabledCount}`}
              tone={summary.operationalCount > 0 ? 'ok' : 'warn'}
            />
            <Metric label="Última sincronización" value={relTime(summary.lastSuccess)} />
          </div>
        )}

        {gaps && (
          <section>
            <h4 className="text-[11px] uppercase tracking-[0.16em] font-semibold text-muted-foreground mb-2">
              Huecos prioritarios
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {gaps.map((g) => (
                <Badge
                  key={g.venue}
                  variant={g.hasActivity ? 'default' : 'outline'}
                  className={g.hasActivity ? '' : 'text-amber-700 border-amber-500/40 bg-amber-500/5'}
                >
                  {g.hasActivity ? (
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                  ) : (
                    <AlertTriangle className="h-3 w-3 mr-1" />
                  )}
                  {g.venue}
                </Badge>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              "Con actividad" = al menos un evento publicado con inicio futuro cuyo{' '}
              <code>venue_name</code> coincide con el listado. Señal territorial por municipio/distrito:
              dato no disponible de forma fiable — no se infiere.
            </p>
          </section>
        )}

        {staleSources.length > 0 && (
          <section>
            <h4 className="text-[11px] uppercase tracking-[0.16em] font-semibold text-muted-foreground mb-2">
              Fuentes desactualizadas (sin éxito &gt; 7 días)
            </h4>
            <ul className="text-sm space-y-1">
              {staleSources.map((s) => (
                <li key={s.source_id} className="flex items-center justify-between gap-3">
                  <span className="truncate">
                    <Clock className="h-3 w-3 inline mr-1 text-muted-foreground" />
                    {s.source_name ?? s.source_slug}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {relTime(s.last_success_at)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h4 className="text-[11px] uppercase tracking-[0.16em] font-semibold text-muted-foreground mb-2">
            Acciones sugeridas
          </h4>
          <ul className="text-sm space-y-1 list-disc pl-5 text-muted-foreground">
            <li>Contactar con los recintos marcados en ámbar para obtener feed o calendario público.</li>
            <li>Revisar credenciales o robots.txt de las fuentes desactualizadas &gt; 7 días.</li>
            <li>Consolidar duplicados en <code>event_sources</code> vía <code>canonical_source_id</code>.</li>
          </ul>
        </section>
      </CardContent>
    </Card>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: 'ok' | 'warn';
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/50 p-3">
      <div
        className={
          tone === 'warn'
            ? 'text-lg font-bold text-amber-600 tabular-nums'
            : 'text-lg font-bold text-primary tabular-nums'
        }
      >
        {value}
      </div>
      <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">{label}</div>
    </div>
  );
}

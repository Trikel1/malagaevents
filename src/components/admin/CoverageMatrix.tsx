import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertCircle, CheckCircle2, CircleSlash, EyeOff } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * CoverageMatrix — reuses the same visual language as SourceHealth/IngestionRegistry
 * and reveals REAL coverage gaps for cultural ingestion, per source and per venue.
 *
 * Data comes from two read-only sources already present in the schema:
 *   1. `event_source_coverage` view (per-source future-event counts + last sync).
 *   2. Aggregation over `events` grouped by `venue_name` for future items.
 *
 * The point is honesty: any recinto with 0 upcoming events shows explicitly as
 * "sin cobertura", and any source without recent successes shows as "requiere revisión".
 */

interface SourceCoverageRow {
  source_id: string;
  source_slug: string;
  source_name: string;
  source_kind: string;
  source_enabled: boolean;
  priority_tier: string | null;
  last_success_at: string | null;
  last_error_at: string | null;
  consecutive_errors: number | null;
  canonical_source_id: string | null;
  future_events: number;
  next_event_at: string | null;
  distinct_future_venues: number;
  last_event_updated_at: string | null;
}

interface VenueCoverageRow {
  venue_name: string;
  future_events: number;
  next_event_at: string | null;
}

// Curated list of Málaga capital venues that the app is expected to cover.
// Kept intentionally small and explicit so gaps are visible.
const TRACKED_VENUES: { key: string; label: string; aliases: string[] }[] = [
  { key: 'cervantes', label: 'Teatro Cervantes', aliases: ['teatro cervantes', 'cervantes'] },
  { key: 'echegaray', label: 'Teatro Echegaray', aliases: ['echegaray'] },
  { key: 'soho', label: 'Teatro del Soho CaixaBank', aliases: ['soho caixabank', 'teatro del soho', 'teatro soho'] },
  { key: 'canovas', label: 'Teatro Cánovas', aliases: ['cánovas', 'canovas'] },
  { key: 'cochera', label: 'La Cochera Cabaret', aliases: ['cochera cabaret', 'la cochera'] },
  { key: 'albeniz', label: 'Cine Albéniz', aliases: ['albéniz', 'albeniz'] },
  { key: 'cac', label: 'CAC Málaga', aliases: ['cac málaga', 'cac malaga', 'centro de arte contemporáneo'] },
  { key: 'pompidou', label: 'Centre Pompidou Málaga', aliases: ['pompidou'] },
  { key: 'picasso', label: 'Museo Picasso Málaga', aliases: ['picasso'] },
  { key: 'mimma', label: 'MIMMA', aliases: ['mimma', 'museo interactivo'] },
  { key: 'fycma', label: 'FYCMA — Palacio de Ferias', aliases: ['fycma', 'palacio de ferias'] },
  { key: 'paris15', label: 'Sala París 15', aliases: ['parís 15', 'paris 15'] },
  { key: 'trinchera', label: 'Sala Trinchera', aliases: ['trinchera'] },
];

const stripDiacritics = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const matchesAlias = (venueName: string, aliases: string[]) => {
  const n = stripDiacritics(venueName);
  return aliases.some((a) => n.includes(stripDiacritics(a)));
};

const CoverageMatrix = () => {
  const sourcesQ = useQuery({
    queryKey: ['coverage-matrix', 'sources'],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('event_source_coverage')
        .select('*')
        .order('future_events', { ascending: false })
        .order('source_name', { ascending: true });
      if (error) throw error;
      return (data ?? []) as SourceCoverageRow[];
    },
  });

  const venuesQ = useQuery({
    queryKey: ['coverage-matrix', 'venues-future'],
    staleTime: 30_000,
    queryFn: async () => {
      // Pull future venues with counts. Filter server-side by status/date, then
      // aggregate client-side (Supabase JS has no GROUP BY).
      const { data, error } = await supabase
        .from('events')
        .select('venue_name, start_at')
        .eq('status', 'published')
        .gt('start_at', new Date().toISOString())
        .not('venue_name', 'is', null)
        .limit(5000);
      if (error) throw error;
      const map = new Map<string, VenueCoverageRow>();
      (data ?? []).forEach((e: any) => {
        const v = (e.venue_name || '').trim();
        if (!v) return;
        const existing = map.get(v);
        if (existing) {
          existing.future_events += 1;
          if (!existing.next_event_at || e.start_at < existing.next_event_at) {
            existing.next_event_at = e.start_at;
          }
        } else {
          map.set(v, { venue_name: v, future_events: 1, next_event_at: e.start_at });
        }
      });
      return Array.from(map.values());
    },
  });

  if (sourcesQ.isLoading || venuesQ.isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (sourcesQ.error || venuesQ.error) {
    return (
      <div className="text-sm text-destructive flex items-center gap-2">
        <AlertCircle className="h-4 w-4" /> Error cargando cobertura
      </div>
    );
  }

  const sources = sourcesQ.data ?? [];
  const venuesRows = venuesQ.data ?? [];

  // Filter out alias/duplicate sources from the source coverage table
  const primarySources = sources.filter((s) => s.canonical_source_id == null);
  const productive = primarySources.filter((s) => s.future_events > 0).length;
  const enabledNoData = primarySources.filter((s) => s.source_enabled && s.future_events === 0).length;
  const needsReview = primarySources.filter(
    (s) =>
      s.source_enabled &&
      ((s.consecutive_errors ?? 0) > 2 ||
        (!s.last_success_at && s.future_events === 0))
  ).length;

  const venueRowsResolved = TRACKED_VENUES.map((tv) => {
    const matching = venuesRows.filter((v) => matchesAlias(v.venue_name, tv.aliases));
    const count = matching.reduce((acc, m) => acc + m.future_events, 0);
    const next = matching
      .map((m) => m.next_event_at)
      .filter(Boolean)
      .sort()[0] ?? null;
    return { ...tv, count, next };
  });

  const venuesWithGap = venueRowsResolved.filter((v) => v.count === 0).length;

  return (
    <div className="space-y-6">
      {/* Summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Fuentes productivas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" /> {productive}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Activas sin datos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              <EyeOff className="h-5 w-5 text-amber-500" /> {enabledNoData}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Requieren revisión
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" /> {needsReview}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Recintos sin cobertura
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              <CircleSlash className="h-5 w-5 text-muted-foreground" /> {venuesWithGap}/{TRACKED_VENUES.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per-source coverage */}
      <div>
        <h3 className="text-sm font-semibold mb-2">Cobertura por fuente (próximos)</h3>
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Fuente</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2 text-right">Eventos futuros</th>
                <th className="px-3 py-2 text-right">Recintos</th>
                <th className="px-3 py-2">Próximo</th>
                <th className="px-3 py-2">Última sincro</th>
                <th className="px-3 py-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {primarySources.map((s) => {
                const reviewNeeded =
                  s.source_enabled &&
                  ((s.consecutive_errors ?? 0) > 2 ||
                    (!s.last_success_at && s.future_events === 0));
                return (
                  <tr key={s.source_id} className="border-t">
                    <td className="px-3 py-2">
                      <div className="font-medium">{s.source_name}</div>
                      <div className="text-xs text-muted-foreground">{s.source_slug}</div>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className="uppercase text-[10px]">
                        {s.source_kind}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">
                      {s.future_events}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {s.distinct_future_venues}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {s.next_event_at
                        ? formatDistanceToNow(new Date(s.next_event_at), { addSuffix: true, locale: es })
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {s.last_success_at
                        ? formatDistanceToNow(new Date(s.last_success_at), { addSuffix: true, locale: es })
                        : '—'}
                    </td>
                    <td className="px-3 py-2">
                      {!s.source_enabled ? (
                        <Badge variant="secondary">pausada</Badge>
                      ) : reviewNeeded ? (
                        <Badge variant="destructive">requiere revisión</Badge>
                      ) : s.future_events > 0 ? (
                        <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15">
                          productiva
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-500/15 text-amber-700 hover:bg-amber-500/15">
                          activa, sin datos
                        </Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Per-venue coverage */}
      <div>
        <h3 className="text-sm font-semibold mb-2">Cobertura por recinto (Málaga capital)</h3>
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Recinto</th>
                <th className="px-3 py-2 text-right">Eventos futuros</th>
                <th className="px-3 py-2">Próximo</th>
                <th className="px-3 py-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {venueRowsResolved
                .sort((a, b) => a.count - b.count || a.label.localeCompare(b.label))
                .map((v) => (
                  <tr key={v.key} className="border-t">
                    <td className="px-3 py-2 font-medium">{v.label}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{v.count}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {v.next
                        ? formatDistanceToNow(new Date(v.next), { addSuffix: true, locale: es })
                        : '—'}
                    </td>
                    <td className="px-3 py-2">
                      {v.count === 0 ? (
                        <Badge variant="destructive">sin cobertura</Badge>
                      ) : v.count < 3 ? (
                        <Badge className="bg-amber-500/15 text-amber-700 hover:bg-amber-500/15">
                          cobertura débil
                        </Badge>
                      ) : (
                        <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15">
                          cubierto
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Recintos declarados. Se muestran los eventos futuros publicados asociados por nombre
          normalizado; los ceros son huecos reales de cobertura, no errores de la UI.
        </p>
      </div>
    </div>
  );
};

export default CoverageMatrix;

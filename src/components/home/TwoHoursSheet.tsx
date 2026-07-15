import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { Clock, MapPin, ExternalLink, Sparkles, Info, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { pickTwoHoursEvents, type TwoHoursEvent, type PickerHorizon } from '@/lib/twoHoursPicker';
import { useQuery } from '@tanstack/react-query';

// Sheet is lazily loaded on interaction.
const Sheet = lazy(() => import('@/components/ui/sheet').then((m) => ({ default: m.Sheet })));
const SheetContent = lazy(() => import('@/components/ui/sheet').then((m) => ({ default: m.SheetContent })));
const SheetHeader = lazy(() => import('@/components/ui/sheet').then((m) => ({ default: m.SheetHeader })));
const SheetTitle = lazy(() => import('@/components/ui/sheet').then((m) => ({ default: m.SheetTitle })));
const SheetDescription = lazy(() =>
  import('@/components/ui/sheet').then((m) => ({ default: m.SheetDescription })),
);

type Budget = 60 | 120 | 180;

const BUDGETS: { value: Budget; label: string }[] = [
  { value: 60, label: '1 hora' },
  { value: 120, label: '2 horas' },
  { value: 180, label: '3 horas' },
];

const HORIZONS: { value: PickerHorizon; label: string }[] = [
  { value: 'now', label: 'Ahora mismo' },
  { value: 'today', label: 'Hoy' },
];

async function fetchWindowedEvents(nowIso: string, endIso: string): Promise<TwoHoursEvent[]> {
  const { data, error } = await supabase
    .from('events')
    .select(
      'id, title, start_at, end_at, venue_name, lat, lng, is_free, is_family_friendly, audience, source, source_ref, updated_at',
    )
    .eq('status', 'published')
    .gte('start_at', nowIso)
    .lte('start_at', endIso)
    .order('start_at', { ascending: true })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as TwoHoursEvent[];
}

function formatHora(iso: string): string {
  try {
    return new Intl.DateTimeFormat('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Madrid',
    }).format(new Date(iso));
  } catch {
    return '';
  }
}

function extractHost(ref?: string | null): string | null {
  if (!ref) return null;
  try {
    return new URL(ref).host.replace(/^www\./, '');
  } catch {
    return null;
  }
}

export default function TwoHoursSheet() {
  const [open, setOpen] = useState(false);
  const [budget, setBudget] = useState<Budget>(120);
  const [horizon, setHorizon] = useState<PickerHorizon>('now');
  const [onlyFree, setOnlyFree] = useState(false);
  const [onlyFamily, setOnlyFamily] = useState(false);
  const [nearMe, setNearMe] = useState(false);
  const [geoGranted, setGeoGranted] = useState<boolean | null>(null);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const navigate = useNavigate();

  // Detect existing geolocation permission (no prompt).
  useEffect(() => {
    if (!open) return;
    if (typeof navigator === 'undefined' || !('permissions' in navigator)) {
      setGeoGranted(false);
      return;
    }
    let cancelled = false;
    navigator.permissions
      .query({ name: 'geolocation' as PermissionName })
      .then((s: PermissionStatus) => {
        if (cancelled) return;
        setGeoGranted(s.state === 'granted');
      })
      .catch(() => setGeoGranted(false));
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!nearMe || !geoGranted) {
      setUserCoords(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => setUserCoords({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setUserCoords(null),
      { maximumAge: 60_000, timeout: 5_000 },
    );
  }, [nearMe, geoGranted]);

  const nowMs = Date.now();
  const window = useMemo(() => {
    const now = new Date(nowMs);
    const end =
      horizon === 'now'
        ? new Date(nowMs + budget * 60_000)
        : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    return { nowIso: now.toISOString(), endIso: end.toISOString() };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, budget, horizon]);

  const { data: events, isLoading } = useQuery({
    queryKey: ['two-hours', window.nowIso, window.endIso],
    queryFn: () => fetchWindowedEvents(window.nowIso, window.endIso),
    enabled: open,
    staleTime: 60_000,
  });

  const result = useMemo(() => {
    if (!events) return null;
    return pickTwoHoursEvents(events, {
      nowMs,
      budgetMinutes: budget,
      horizon,
      onlyFree,
      onlyFamily,
      userCoords: nearMe ? userCoords : null,
      limit: 3,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, budget, horizon, onlyFree, onlyFamily, nearMe, userCoords]);

  const emptyHref = useMemo(() => {
    const params = new URLSearchParams();
    params.set('filter', horizon === 'now' ? 'today' : 'today');
    if (onlyFree) params.set('free', '1');
    if (onlyFamily) params.set('family', '1');
    return `/events?${params.toString()}`;
  }, [horizon, onlyFree, onlyFamily]);

  return (
    <section className="glass-panel p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 shrink-0 rounded-2xl bg-primary/15 flex items-center justify-center">
          <Clock className="h-5 w-5 text-primary" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base sm:text-lg font-bold tracking-tight">Tengo dos horas</h2>
          <p className="text-[13px] text-muted-foreground leading-snug mt-0.5">
            Planes reales que caben en tu hueco. Sin inventar duraciones.
          </p>
        </div>
        <Button
          onClick={() => setOpen(true)}
          className="liquid-press h-10 px-4 font-semibold shrink-0"
          aria-haspopup="dialog"
        >
          Buscar plan
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>

      {open && (
        <Suspense fallback={null}>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto rounded-t-3xl">
              <SheetHeader className="text-left">
                <SheetTitle className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" aria-hidden />
                  Tengo dos horas
                </SheetTitle>
                <SheetDescription>
                  Rango determinista sobre eventos publicados. Solo confirmamos que un plan "cabe" si el
                  evento tiene hora de fin real.
                </SheetDescription>
              </SheetHeader>

              <div className="mt-4 space-y-4">
                {/* Duración */}
                <fieldset>
                  <legend className="text-[11px] uppercase tracking-[0.16em] font-semibold text-muted-foreground mb-2">
                    Duración disponible
                  </legend>
                  <div role="radiogroup" className="flex gap-2">
                    {BUDGETS.map((b) => (
                      <button
                        key={b.value}
                        role="radio"
                        aria-checked={budget === b.value}
                        onClick={() => setBudget(b.value)}
                        className={cn(
                          'glass-chip liquid-press px-4 py-2 text-sm font-medium flex-1',
                          budget === b.value && 'bg-primary/15 border-primary/30 text-primary',
                        )}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                </fieldset>

                {/* Cuándo */}
                <fieldset>
                  <legend className="text-[11px] uppercase tracking-[0.16em] font-semibold text-muted-foreground mb-2">
                    Cuándo
                  </legend>
                  <div role="radiogroup" className="flex gap-2">
                    {HORIZONS.map((h) => (
                      <button
                        key={h.value}
                        role="radio"
                        aria-checked={horizon === h.value}
                        onClick={() => setHorizon(h.value)}
                        className={cn(
                          'glass-chip liquid-press px-4 py-2 text-sm font-medium flex-1',
                          horizon === h.value && 'bg-primary/15 border-primary/30 text-primary',
                        )}
                      >
                        {h.label}
                      </button>
                    ))}
                  </div>
                </fieldset>

                {/* Filtros reales */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="flex items-center justify-between glass-card p-3">
                    <Label htmlFor="th-free" className="text-sm font-medium cursor-pointer">
                      Gratis
                    </Label>
                    <Switch id="th-free" checked={onlyFree} onCheckedChange={setOnlyFree} />
                  </div>
                  <div className="flex items-center justify-between glass-card p-3">
                    <Label htmlFor="th-family" className="text-sm font-medium cursor-pointer">
                      Familiar
                    </Label>
                    <Switch id="th-family" checked={onlyFamily} onCheckedChange={setOnlyFamily} />
                  </div>
                  <div className="flex items-center justify-between glass-card p-3">
                    <Label
                      htmlFor="th-near"
                      className={cn(
                        'text-sm font-medium cursor-pointer',
                        !geoGranted && 'text-muted-foreground cursor-not-allowed',
                      )}
                    >
                      Cerca de mí
                      {!geoGranted && (
                        <span className="block text-[10px] font-normal text-muted-foreground">
                          Permite la ubicación en tu navegador
                        </span>
                      )}
                    </Label>
                    <Switch
                      id="th-near"
                      checked={nearMe}
                      onCheckedChange={setNearMe}
                      disabled={!geoGranted}
                    />
                  </div>
                </div>

                {/* Resultados */}
                <div className="pt-2">
                  {isLoading && (
                    <div className="glass-card p-6 text-center text-sm text-muted-foreground">
                      Buscando planes…
                    </div>
                  )}

                  {!isLoading && result && result.fits.length === 0 && result.unconfirmed.length === 0 && (
                    <div className="glass-card p-6 text-center">
                      <Info className="h-6 w-6 mx-auto mb-2 text-muted-foreground" aria-hidden />
                      <p className="text-sm font-medium">Nada encaja ahora mismo</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        No hay eventos publicados que quepan en {budget / 60} h con los filtros elegidos.
                      </p>
                      <Button
                        variant="outline"
                        className="mt-3 h-9"
                        onClick={() => {
                          setOpen(false);
                          navigate(emptyHref);
                        }}
                      >
                        Ver toda la agenda de hoy
                      </Button>
                    </div>
                  )}

                  {!isLoading && result && result.fits.length > 0 && (
                    <>
                      <p className="text-[11px] uppercase tracking-[0.16em] font-semibold text-muted-foreground mb-2">
                        Planes que caben ({result.fits.length})
                      </p>
                      <ul className="space-y-2">
                        {result.fits.map((e) => (
                          <ResultCard
                            key={e.id}
                            title={e.title}
                            hora={formatHora(e.start_at)}
                            venue={e.venue_name}
                            durationMinutes={e.durationMinutes}
                            distanceKm={e.distanceKm}
                            source={extractHost(e.source_ref) ?? e.source ?? null}
                            updated={e.updated_at ?? null}
                            onOpen={() => {
                              setOpen(false);
                              navigate(`/event/${e.id}`);
                            }}
                          />
                        ))}
                      </ul>
                    </>
                  )}

                  {!isLoading && result && result.unconfirmed.length > 0 && (
                    <div className="mt-4">
                      <p className="text-[11px] uppercase tracking-[0.16em] font-semibold text-muted-foreground mb-2">
                        Duración sin confirmar
                      </p>
                      <p className="text-[11px] text-muted-foreground mb-2">
                        Empiezan a tiempo pero no sabemos cuándo terminan. Confírmalo en el detalle.
                      </p>
                      <ul className="space-y-2">
                        {result.unconfirmed.map((e) => (
                          <ResultCard
                            key={e.id}
                            title={e.title}
                            hora={formatHora(e.start_at)}
                            venue={e.venue_name}
                            durationMinutes={null}
                            distanceKm={e.distanceKm}
                            source={extractHost(e.source_ref) ?? e.source ?? null}
                            updated={e.updated_at ?? null}
                            muted
                            onOpen={() => {
                              setOpen(false);
                              navigate(`/event/${e.id}`);
                            }}
                          />
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </Suspense>
      )}
    </section>
  );
}

function ResultCard(props: {
  title: string;
  hora: string;
  venue?: string | null;
  durationMinutes: number | null;
  distanceKm: number | null;
  source: string | null;
  updated: string | null;
  muted?: boolean;
  onOpen: () => void;
}) {
  const { title, hora, venue, durationMinutes, distanceKm, source, updated, muted, onOpen } = props;
  return (
    <li>
      <button
        onClick={onOpen}
        className={cn(
          'glass-card liquid-hover liquid-press w-full text-left p-3 flex items-start gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          muted && 'opacity-90',
        )}
      >
        <div className="min-w-14 shrink-0 rounded-xl bg-primary/10 text-primary font-semibold text-sm text-center py-2 tabular-nums">
          {hora}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm leading-tight line-clamp-2">{title}</div>
          <div className="text-[12px] text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            {venue && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" aria-hidden /> {venue}
              </span>
            )}
            {durationMinutes !== null && <span>· {durationMinutes} min</span>}
            {distanceKm !== null && <span>· {distanceKm.toFixed(1)} km</span>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {source && (
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/40 rounded px-1.5 py-0.5">
                Fuente · {source}
              </span>
            )}
            {updated && (
              <span className="text-[10px] text-muted-foreground">
                Actualizado {new Date(updated).toLocaleDateString('es-ES')}
              </span>
            )}
          </div>
        </div>
        <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0 mt-2" aria-hidden />
      </button>
    </li>
  );
}

import { useMemo, useState, useCallback, useEffect } from 'react';
import {
  MapPin,
  List,
  Map as MapIcon,
  Locate,
  Search,
  X,
  Loader2,
  RefreshCw,
  Crosshair,
  CircleDashed,
  CalendarDays,
  Trophy,
  Building2,
  Cross,
} from 'lucide-react';
import { useEvents } from '@/hooks/useEvents';
import { useSportsEvents } from '@/hooks/useSportsEvents';
import { useVenues } from '@/hooks/useVenues';
import { usePharmaciesOnDuty } from '@/hooks/usePharmacies';
import { LeafletMap } from '@/modules/maps/LeafletMap';
import { MarkerSheet } from '@/modules/maps/MarkerSheet';
import MarkerDetails, { KIND_LABEL } from '@/modules/maps/MarkerDetails';
import type { MapMarker, MarkerKind } from '@/modules/maps/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import SEO from '@/components/common/SEO';
import { useIsMobile } from '@/hooks/use-mobile';
import { mapVenueToCoords, MALAGA_CENTER } from '@/lib/venueCoords';
import { isWithinScope, SCOPE_LABEL, type MapTimeScope } from '@/lib/mapTimeScope';
import { cn } from '@/lib/utils';

const MAX_MARKERS = 200;

type FilterKind = 'all' | 'events' | 'sports' | 'venues' | 'pharmacies';

const KIND_OF: Record<Exclude<FilterKind, 'all'>, MarkerKind> = {
  events: 'event',
  sports: 'sport',
  venues: 'venue',
  pharmacies: 'pharmacy',
};

const COLOR_OF: Record<MarkerKind, string> = {
  event: 'hsl(173, 80%, 38%)',
  sport: 'hsl(150, 70%, 40%)',
  venue: 'hsl(265, 70%, 55%)',
  pharmacy: 'hsl(0, 75%, 55%)',
  demo: 'hsl(215, 15%, 50%)',
};

const FILTERS: { id: FilterKind; label: string; icon: typeof CalendarDays; color?: string }[] = [
  { id: 'all', label: 'Todos', icon: MapPin },
  { id: 'events', label: 'Eventos', icon: CalendarDays, color: COLOR_OF.event },
  { id: 'sports', label: 'Deportes', icon: Trophy, color: COLOR_OF.sport },
  { id: 'venues', label: 'Recintos', icon: Building2, color: COLOR_OF.venue },
  { id: 'pharmacies', label: 'Farmacias', icon: Cross, color: COLOR_OF.pharmacy },
];

const SCOPES: { id: MapTimeScope; label: string }[] = [
  { id: 'today', label: 'Hoy' },
  { id: 'week', label: 'Esta semana' },
  { id: 'all', label: 'Todos' },
];


const fmtWhen = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Madrid',
  }).format(d);
};

const MapPage = () => {
  const isMobile = useIsMobile();

  const [view, setView] = useState<'map' | 'list'>('map');
  const [filter, setFilter] = useState<FilterKind>('events');
  const [scope, setScope] = useState<MapTimeScope>('today');

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<MapMarker | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  const eventsQuery = useEvents({ limit: 200 });
  const sportsQuery = useSportsEvents({});
  const venuesQuery = useVenues();
  const pharmaciesQuery = usePharmaciesOnDuty(new Date());

  const cultureEvents = eventsQuery.data ?? [];
  const sportsEvents = sportsQuery.data ?? [];
  const venues = venuesQuery.data ?? [];
  const pharmacies = pharmaciesQuery.data ?? [];

  const isLoading =
    eventsQuery.isLoading || sportsQuery.isLoading || venuesQuery.isLoading || pharmaciesQuery.isLoading;
  const isError = eventsQuery.isError || sportsQuery.isError || venuesQuery.isError;

  const retry = useCallback(() => {
    eventsQuery.refetch();
    sportsQuery.refetch();
    venuesQuery.refetch();
    pharmaciesQuery.refetch();
  }, [eventsQuery, sportsQuery, venuesQuery, pharmaciesQuery]);

  const eventMarkers = useMemo<MapMarker[]>(
    () =>
      (cultureEvents as any[]).map((e) => {
        const hasReal = Number.isFinite(Number(e.lat)) && Number.isFinite(Number(e.lng));
        const c = hasReal
          ? { lat: Number(e.lat), lng: Number(e.lng), approximate: false }
          : mapVenueToCoords(e.venue_name, e.id);
        return {
          id: `ev-${e.id}`,
          eventId: e.id,
          kind: 'event' as MarkerKind,
          title: e.title,
          subtitle: [e.venue_name, e.city].filter(Boolean).join(' · '),
          address: e.address ?? e.venue_name ?? '',
          startAt: e.start_at ?? null,
          lat: c.lat,
          lng: c.lng,
          approximate: c.approximate,
        };
      }),
    [cultureEvents]
  );

  const sportMarkers = useMemo<MapMarker[]>(
    () =>
      (sportsEvents as any[]).map((e) => {
        const hasReal = Number.isFinite(Number(e.lat)) && Number.isFinite(Number(e.lng));
        const c = hasReal
          ? { lat: Number(e.lat), lng: Number(e.lng), approximate: false }
          : mapVenueToCoords(e.venue_name, e.id);
        return {
          id: `sp-${e.id}`,
          eventId: e.id,
          kind: 'sport' as MarkerKind,
          title: e.title,
          subtitle: [e.venue_name, e.city].filter(Boolean).join(' · '),
          address: e.address ?? e.venue_name ?? '',
          startAt: e.start_datetime ?? null,
          lat: c.lat,
          lng: c.lng,
          approximate: c.approximate,
        };
      }),
    [sportsEvents]
  );

  const venueMarkers = useMemo<MapMarker[]>(
    () =>
      (venues as any[])
        .filter((v) => Number.isFinite(Number(v.lat)) && Number.isFinite(Number(v.lng)))
        .map((v) => ({
          id: `vn-${v.id}`,
          kind: 'venue' as MarkerKind,
          title: v.name,
          subtitle: v.city ?? '',
          address: v.address ?? '',
          lat: Number(v.lat),
          lng: Number(v.lng),
          approximate: false,
        })),
    [venues]
  );

  const pharmacyMarkers = useMemo<MapMarker[]>(
    () =>
      (pharmacies as any[])
        .filter((p) => Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)))
        .map((p) => ({
          id: `ph-${p.id}`,
          kind: 'pharmacy' as MarkerKind,
          title: p.name,
          subtitle: p.municipality ?? '',
          address: p.address ?? '',
          phone: p.phone ?? undefined,
          onDuty: true,
          lat: Number(p.lat),
          lng: Number(p.lng),
          approximate: false,
        })),
    [pharmacies]
  );

  const allMarkers = useMemo<MapMarker[]>(
    () => [...eventMarkers, ...sportMarkers, ...venueMarkers, ...pharmacyMarkers],
    [eventMarkers, sportMarkers, venueMarkers, pharmacyMarkers]
  );

  /** Time scope only narrows dated items (events / sports). */
  const scopedMarkers = useMemo<MapMarker[]>(() => {
    const now = new Date();
    return allMarkers.filter((m) => isWithinScope(m.startAt, scope, now));
  }, [allMarkers, scope]);

  const searchedMarkers = useMemo<MapMarker[]>(() => {
    const q = search.trim().toLowerCase();
    if (!q) return scopedMarkers;
    return scopedMarkers.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        (m.subtitle ?? '').toLowerCase().includes(q) ||
        (m.address ?? '').toLowerCase().includes(q)
    );
  }, [scopedMarkers, search]);

  const counts = useMemo(() => {
    const by = (k: MarkerKind) => searchedMarkers.filter((m) => m.kind === k).length;
    return {
      all: searchedMarkers.length,
      events: by('event'),
      sports: by('sport'),
      venues: by('venue'),
      pharmacies: by('pharmacy'),
    };
  }, [searchedMarkers]);

  const filteredMarkers = useMemo<MapMarker[]>(() => {
    const list =
      filter === 'all' ? searchedMarkers : searchedMarkers.filter((m) => m.kind === KIND_OF[filter]);
    return list.slice(0, MAX_MARKERS);
  }, [searchedMarkers, filter]);


  const handleSelect = useCallback(
    (id: string) => {
      const m = allMarkers.find((mk) => mk.id === id);
      if (m) setSelected(m);
    },
    [allMarkers]
  );

  const handleMyLocation = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setLocError('Tu dispositivo no permite compartir la ubicación.');
      return;
    }
    setLocError(null);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(loc);
        setFlyTo({ ...loc, zoom: 14 });
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        setLocError(
          err.code === err.PERMISSION_DENIED
            ? 'Permiso denegado. Actívalo en los ajustes del navegador para centrar el mapa en tu posición.'
            : 'No hemos podido obtener tu ubicación. Inténtalo de nuevo.'
        );
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  useEffect(() => {
    setSelected(null);
  }, [filter, scope]);


  const focusMarker = (m: MapMarker) => {
    setFlyTo({ lat: m.lat, lng: m.lng, zoom: 16 });
    setSelected(m);
    if (isMobile) setView('map');
  };

  const clearFilters = () => {
    setFilter('all');
    setScope('all');
    setSearch('');
  };


  const resultsList = (
    <div className="space-y-2.5">
      {isLoading ? (
        Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-3.5">
            <Skeleton className="h-4 w-2/3 mb-2" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))
      ) : isError ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground mb-4">No hemos podido cargar los puntos del mapa.</p>
          <Button onClick={retry} className="min-h-11">
            <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
            Reintentar
          </Button>
        </div>
      ) : filteredMarkers.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <MapPin className="h-9 w-9 mx-auto mb-3 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm font-medium">
            {scope === 'today'
              ? 'No hay puntos con coordenadas para hoy'
              : 'No hay puntos con coordenadas para este alcance'}
          </p>
          <p className="text-xs text-muted-foreground mt-1 mb-4">
            Amplía el alcance temporal o quita los filtros.
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            {scope === 'today' && (
              <Button className="min-h-11" onClick={() => setScope('week')}>
                Ver esta semana
              </Button>
            )}
            <Button variant="outline" className="min-h-11" onClick={clearFilters}>
              Limpiar filtros
            </Button>
            <Button variant="outline" className="min-h-11" onClick={retry}>
              <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
              Reintentar
            </Button>
          </div>
        </div>
      ) : (

        filteredMarkers.map((m) => {
          const when = fmtWhen(m.startAt);
          const active = selected?.id === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => focusMarker(m)}
              className={cn(
                'w-full text-left rounded-2xl border bg-card p-3.5 min-h-[44px] transition-transform duration-200 motion-reduce:transition-none',
                'hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                active ? 'border-primary' : 'border-border'
              )}
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 h-10 w-10 shrink-0 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <MapPin className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[11px] font-semibold uppercase tracking-wide text-primary">
                    {KIND_LABEL[m.kind ?? 'event']}
                  </span>
                  <span className="block font-semibold text-sm leading-snug line-clamp-2">{m.title}</span>
                  {(m.address || m.subtitle) && (
                    <span className="block text-xs text-muted-foreground mt-0.5 line-clamp-1">
                      {m.address || m.subtitle}
                    </span>
                  )}
                  <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {when && (
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                        {when}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      {m.approximate ? (
                        <>
                          <CircleDashed className="h-3.5 w-3.5" aria-hidden="true" />
                          Aproximada
                        </>
                      ) : (
                        <>
                          <Crosshair className="h-3.5 w-3.5" aria-hidden="true" />
                          Exacta
                        </>
                      )}
                    </span>
                  </span>
                </span>
              </div>
            </button>
          );
        })
      )}
    </div>
  );

  const mapPanel = (
    <div className="relative rounded-2xl border border-border bg-card overflow-hidden h-[calc(100dvh-300px)] min-h-[360px] lg:h-[calc(100dvh-220px)]">
      <LeafletMap
        markers={filteredMarkers}
        center={MALAGA_CENTER}
        zoom={13}
        onMarkerSelect={handleSelect}
        userLocation={userLocation}
        flyTo={flyTo}
      />

      {!isLoading && filteredMarkers.length === 0 && (
        <div className="absolute inset-x-4 top-4 z-[400] rounded-xl border border-border bg-background p-3 text-center">
          <p className="text-sm font-medium">
            {scope === 'today' ? 'Hoy no hay puntos en el mapa' : 'No hay puntos para este alcance'}
          </p>
          <div className="mt-2 flex flex-wrap gap-2 justify-center">
            {scope === 'today' && (
              <Button size="sm" className="min-h-11" onClick={() => setScope('week')}>
                Ver esta semana
              </Button>
            )}
            <Button variant="outline" size="sm" className="min-h-11" onClick={clearFilters}>
              Limpiar filtros
            </Button>
          </div>
        </div>
      )}


      <div className="absolute bottom-20 left-3 lg:bottom-3 z-[400]">
        <Button
          onClick={handleMyLocation}
          disabled={locating}
          className="min-h-11 rounded-full bg-background text-foreground border border-border hover:bg-muted shadow-sm"
          aria-label="Centrar el mapa en mi ubicación"
        >
          {locating ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          ) : (
            <Locate className="h-4 w-4 mr-2" aria-hidden="true" />
          )}
          Mi ubicación
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-background">
      <SEO
        title="Mapa de eventos y farmacias en Málaga"
        description="Mapa interactivo de Málaga con eventos culturales, deporte, recintos y farmacias de guardia. Encuentra qué ocurre cerca de ti."
        path="/map"
      />

      <div className="mx-auto w-full max-w-[1280px] px-3 sm:px-5 pt-3">
        {/* App bar */}
        <header className="flex items-center gap-3">
          <span className="h-11 w-11 shrink-0 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
            <MapIcon className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight leading-tight">Mapa de Málaga</h1>
            <p className="text-[13px] text-muted-foreground leading-snug">Encuentra qué ocurre cerca de ti</p>
          </div>
        </header>

        {/* Search */}
        <div className="relative mt-3">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <label htmlFor="map-search" className="sr-only">Buscar en el mapa</label>
          <Input
            id="map-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar eventos, recintos o farmacias"
            className="h-12 pl-10 pr-11 rounded-xl bg-card border-border focus-visible:ring-2 focus-visible:ring-primary"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Limpiar búsqueda"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 h-11 w-11 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Time scope */}
        <div className="mt-3 flex rounded-full border border-border bg-card p-1" role="group" aria-label="Alcance temporal">
          {SCOPES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setScope(s.id)}
              aria-pressed={scope === s.id}
              className={cn(
                'flex-1 min-h-11 px-3 rounded-full text-sm font-medium transition-colors duration-200 motion-reduce:transition-none',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                scope === s.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        <p role="status" className="mt-2 text-xs text-muted-foreground">
          {SCOPE_LABEL[scope]} · {filteredMarkers.length}{' '}
          {filteredMarkers.length === 1 ? 'resultado' : 'resultados'}
        </p>

        {/* Filters */}
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" role="toolbar" aria-label="Filtros del mapa">
          {FILTERS.map((f) => {
            const active = filter === f.id;
            const Icon = f.icon;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                aria-pressed={active}
                className={cn(
                  'shrink-0 inline-flex items-center gap-1.5 min-h-11 px-4 rounded-full border text-sm font-medium whitespace-nowrap transition-colors duration-200 motion-reduce:transition-none',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  active
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card text-foreground border-border hover:bg-muted'
                )}
              >
                {f.color && (
                  <span
                    className="h-2.5 w-2.5 rounded-full ring-1 ring-border"
                    style={{ backgroundColor: f.color }}
                    aria-hidden="true"
                  />
                )}
                <Icon className="h-4 w-4" aria-hidden="true" />
                {f.label}
                <span className={cn('tabular-nums', active ? 'opacity-90' : 'text-muted-foreground')}>
                  {counts[f.id]}
                </span>
              </button>
            );
          })}
        </div>


        {/* View toggle + legend */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-full border border-border bg-card p-1" role="group" aria-label="Cambiar vista">
            {(
              [
                { id: 'map' as const, label: 'Mapa', icon: MapIcon },
                { id: 'list' as const, label: 'Lista', icon: List },
              ]
            ).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setView(id)}
                aria-pressed={view === id}
                className={cn(
                  'inline-flex items-center gap-1.5 min-h-11 px-4 rounded-full text-sm font-medium transition-colors duration-200 motion-reduce:transition-none',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  view === id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>

          <ul className="flex flex-wrap items-center gap-2" aria-label="Leyenda del mapa">
            {FILTERS.filter((f) => f.id !== 'all').map(({ id, label, icon: Icon, color }) => (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => setFilter(id)}
                  aria-pressed={filter === id}
                  className={cn(
                    'inline-flex items-center gap-1.5 min-h-11 px-3 rounded-full border text-xs font-medium transition-colors duration-200 motion-reduce:transition-none',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                    filter === id ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-card text-muted-foreground hover:bg-muted'
                  )}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full ring-1 ring-border"
                    style={{ backgroundColor: color }}
                    aria-hidden="true"
                  />
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {label}
                </button>
              </li>
            ))}
          </ul>

        </div>

        {locError && (
          <p role="status" className="mt-3 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {locError}
          </p>
        )}

        {/* Body */}
        <div className="mt-3 pb-6 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-4 lg:items-start">
          <div className={cn(view === 'map' ? 'block' : 'hidden', 'lg:block lg:sticky lg:top-3')}>{mapPanel}</div>

          <aside className={cn(view === 'list' ? 'block' : 'hidden', 'lg:block')}>
            {!isMobile && selected && (
              <div className="mb-3 rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Detalle</p>
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    aria-label="Cerrar detalle"
                    className="h-8 w-8 -mt-1 -mr-1 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
                <div className="mt-2">
                  <MarkerDetails marker={selected} onNavigated={() => setSelected(null)} />
                </div>
              </div>
            )}
            <p className="mb-2 text-xs text-muted-foreground">
              {filteredMarkers.length} {filteredMarkers.length === 1 ? 'punto' : 'puntos'} en el mapa
            </p>
            {resultsList}
          </aside>
        </div>
      </div>

      {isMobile && <MarkerSheet marker={selected} onClose={() => setSelected(null)} />}
    </div>
  );
};

export default MapPage;

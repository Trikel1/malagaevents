import { useMemo, useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { MapPin, List, Map as MapIcon, Locate, Search, Calendar, X } from 'lucide-react';
import { useEvents } from '@/hooks/useEvents';
import { useSportsEvents } from '@/hooks/useSportsEvents';
import { useVenues } from '@/hooks/useVenues';
import { usePharmaciesOnDuty } from '@/hooks/usePharmacies';
import { LeafletMap } from '@/modules/maps/LeafletMap';
import { MarkerSheet } from '@/modules/maps/MarkerSheet';
import type { MapMarker, MarkerKind } from '@/modules/maps/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import SEO from '@/components/common/SEO';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { mapVenueToCoords, MALAGA_CENTER } from '@/lib/venueCoords';
import { DEMO_MAP_POINTS } from '@/lib/mapDemoPoints';
import { cn } from '@/lib/utils';

const MAX_MARKERS = 200;

type FilterKind = 'all' | 'events' | 'venues' | 'sports' | 'pharmacies';

const FILTERS: { id: FilterKind; key: string }[] = [
  { id: 'all', key: 'map.all' },
  { id: 'events', key: 'map.events' },
  { id: 'venues', key: 'map.venues' },
  { id: 'sports', key: 'map.sports' },
  { id: 'pharmacies', key: 'map.pharmacies' },
];

const fmtDate = (d?: string | null) => (d ? format(new Date(d), 'dd MMM HH:mm') : '');

const MapPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [view, setView] = useState<'map' | 'list'>('map');
  const [filter, setFilter] = useState<FilterKind>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<MapMarker | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);

  const { data: cultureEvents = [] } = useEvents({ limit: 200 });
  const { data: sportsEvents = [] } = useSportsEvents({});
  const { data: venues = [] } = useVenues();
  const { data: pharmacies = [] } = usePharmaciesOnDuty(new Date());

  const eventMarkers = useMemo<MapMarker[]>(() => {
    return cultureEvents.map((e: any) => {
      const hasReal = Number.isFinite(Number(e.lat)) && Number.isFinite(Number(e.lng));
      const c = hasReal
        ? { lat: Number(e.lat), lng: Number(e.lng), approximate: false }
        : mapVenueToCoords(e.venue_name, e.id);
      return {
        id: `ev-${e.id}`,
        eventId: e.id,
        kind: 'event' as MarkerKind,
        title: e.title,
        subtitle: [e.venue_name, fmtDate(e.start_at)].filter(Boolean).join(' · '),
        address: e.address ?? e.venue_name ?? '',
        startAt: e.start_at ?? null,
        lat: c.lat,
        lng: c.lng,
        approximate: c.approximate,
      };
    });
  }, [cultureEvents]);

  const sportMarkers = useMemo<MapMarker[]>(() => {
    return sportsEvents.map((e: any) => {
      const hasReal = Number.isFinite(Number(e.lat)) && Number.isFinite(Number(e.lng));
      const c = hasReal
        ? { lat: Number(e.lat), lng: Number(e.lng), approximate: false }
        : mapVenueToCoords(e.venue_name, e.id);
      return {
        id: `sp-${e.id}`,
        eventId: e.id,
        kind: 'sport' as MarkerKind,
        title: e.title,
        subtitle: [e.venue_name, fmtDate(e.start_datetime)].filter(Boolean).join(' · '),
        address: e.address ?? e.venue_name ?? '',
        startAt: e.start_datetime ?? null,
        lat: c.lat,
        lng: c.lng,
        approximate: c.approximate,
      };
    });
  }, [sportsEvents]);

  const venueMarkers = useMemo<MapMarker[]>(() => {
    return (venues as any[])
      .filter((v) => Number.isFinite(Number(v.lat)) && Number.isFinite(Number(v.lng)))
      .map((v) => ({
        id: `vn-${v.id}`,
        kind: 'venue' as MarkerKind,
        title: v.name,
        subtitle: v.address ?? v.city ?? '',
        address: v.address ?? '',
        lat: Number(v.lat),
        lng: Number(v.lng),
        approximate: false,
      }));
  }, [venues]);

  const pharmacyMarkers = useMemo<MapMarker[]>(() => {
    return (pharmacies as any[])
      .filter((p) => Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)))
      .map((p) => ({
        id: `ph-${p.id}`,
        kind: 'pharmacy' as MarkerKind,
        title: p.name,
        subtitle: p.address ?? '',
        address: p.address ?? '',
        phone: p.phone ?? undefined,
        onDuty: true,
        lat: Number(p.lat),
        lng: Number(p.lng),
        approximate: false,
      }));
  }, [pharmacies]);

  const allMarkers = useMemo<MapMarker[]>(() => {
    const real = [...eventMarkers, ...sportMarkers, ...venueMarkers, ...pharmacyMarkers];
    // Demo fallback if essentially empty
    if (real.length < 4) {
      const existingTitles = new Set(real.map((m) => m.title.toLowerCase()));
      DEMO_MAP_POINTS.forEach((d) => {
        if (!existingTitles.has(d.title.toLowerCase())) real.push(d);
      });
    }
    return real;
  }, [eventMarkers, sportMarkers, venueMarkers, pharmacyMarkers]);

  const filteredMarkers = useMemo<MapMarker[]>(() => {
    let list = allMarkers;
    if (filter !== 'all') {
      const kindMap: Record<FilterKind, MarkerKind | null> = {
        all: null,
        events: 'event',
        venues: 'venue',
        sports: 'sport',
        pharmacies: 'pharmacy',
      };
      const wanted = kindMap[filter];
      list = list.filter((m) => m.kind === wanted || (wanted === 'venue' && m.kind === 'demo'));
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          (m.subtitle ?? '').toLowerCase().includes(q) ||
          (m.address ?? '').toLowerCase().includes(q)
      );
    }
    return list.slice(0, MAX_MARKERS);
  }, [allMarkers, filter, search]);

  const handleSelect = useCallback(
    (id: string) => {
      const m = allMarkers.find((mk) => mk.id === id);
      if (m) setSelected(m);
    },
    [allMarkers]
  );

  const handleMyLocation = useCallback(() => {
    if (!('geolocation' in navigator)) {
      toast({ title: t('map.geolocationUnavailable'), variant: 'destructive' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(loc);
        setFlyTo({ ...loc, zoom: 14 });
      },
      (err) => {
        toast({
          title:
            err.code === err.PERMISSION_DENIED
              ? t('map.geolocationDenied')
              : t('map.geolocationUnavailable'),
          variant: 'destructive',
        });
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, [toast, t]);

  // Reset view to map when filter changes
  useEffect(() => {
    setSelected(null);
  }, [filter]);

  return (
    <div className="min-h-screen bg-gradient-warm relative">
      <SEO
        title="Mapa de eventos y farmacias en Málaga"
        description="Mapa interactivo de Málaga con eventos, recintos y farmacias de guardia cercanas. Encuentra qué hay cerca de ti en tiempo real."
        path="/map"
      />

      {/* Ambient blobs */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-64 overflow-hidden">
        <div className="absolute -top-16 -left-10 h-56 w-56 rounded-full bg-secondary/25 blur-3xl" />
        <div className="absolute top-6 -right-10 h-56 w-56 rounded-full bg-primary/25 blur-3xl" />
      </div>

      {/* Hero + controls (glass) */}
      <header className="relative px-3 pt-3 space-y-3">
        <div className="glass-panel p-4 sm:p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0">
              <div className="h-10 w-10 shrink-0 rounded-2xl bg-primary/12 flex items-center justify-center">
                <MapPin className="h-5 w-5 text-primary" aria-hidden />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight leading-tight">
                  Mapa de Málaga
                </h1>
                <p className="text-[12px] sm:text-[13px] text-muted-foreground leading-snug mt-0.5">
                  Explora eventos, recintos, farmacias y puntos cercanos en la ciudad y la provincia.
                </p>
              </div>
            </div>

            <div className="inline-flex glass-button p-0.5 text-xs shrink-0" role="tablist" aria-label={t('map.view', 'Vista')}>
              <button
                type="button"
                onClick={() => setView('map')}
                aria-pressed={view === 'map'}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1.5 rounded-full transition min-h-[32px]',
                  view === 'map'
                    ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <MapIcon className="h-3.5 w-3.5" aria-hidden />
                <span className="hidden sm:inline">{t('map.viewMap', 'Mapa')}</span>
              </button>
              <button
                type="button"
                onClick={() => setView('list')}
                aria-pressed={view === 'list'}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1.5 rounded-full transition min-h-[32px]',
                  view === 'list'
                    ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <List className="h-3.5 w-3.5" aria-hidden />
                <span className="hidden sm:inline">{t('map.viewList', 'Lista')}</span>
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" aria-hidden />
            <label htmlFor="map-search" className="sr-only">{t('map.searchPlaceholder', 'Buscar')}</label>
            <Input
              id="map-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('map.searchPlaceholder', 'Buscar eventos, recintos, farmacias…')}
              className="glass-input pl-10 pr-10 h-11 border-0 focus-visible:ring-2 focus-visible:ring-primary"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground"
                aria-label={t('common.clearSearch', 'Limpiar búsqueda')}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Filter chips */}
          <div
            className="flex gap-2 overflow-x-auto liquid-scroll -mx-1 px-1 pb-0.5"
            role="toolbar"
            aria-label={t('map.filters', 'Filtros')}
          >
            {FILTERS.map((f) => {
              const active = filter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  aria-pressed={active}
                  className={cn(
                    'glass-chip liquid-press shrink-0 text-xs px-3.5 h-8 rounded-full font-medium transition whitespace-nowrap',
                    active
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'text-foreground hover:bg-primary/5'
                  )}
                >
                  {t(f.key)}
                </button>
              );
            })}
            <span className="shrink-0 self-center mx-1 h-4 w-px bg-border" aria-hidden />
            <Badge variant="secondary" className="shrink-0 self-center bg-primary/10 text-primary border-0 rounded-full px-3 h-8 flex items-center text-xs font-semibold">
              {filteredMarkers.length} {t('map.points', 'puntos')}
            </Badge>
          </div>
        </div>
      </header>

      {/* Map / List body */}
      {view === 'map' ? (
        <div
          className="relative px-3 mt-3"
          style={{
            height:
              'calc(100dvh - 260px - env(safe-area-inset-bottom, 0px))',
            minHeight: '360px',
          }}
        >
          <div className="glass-card-strong overflow-hidden h-full relative">
            <LeafletMap
              markers={filteredMarkers}
              center={MALAGA_CENTER}
              zoom={13}
              onMarkerSelect={handleSelect}
              userLocation={userLocation}
              flyTo={flyTo}
            />

            {/* Floating locate button */}
            <div className="absolute bottom-3 left-3 right-3 z-[400] flex items-center justify-center pointer-events-none">
              <Button
                size="sm"
                onClick={handleMyLocation}
                className="glass-button liquid-press pointer-events-auto rounded-full h-10 px-4 bg-card/90 text-foreground hover:bg-card border-border/60"
              >
                <Locate className="h-4 w-4 mr-1.5" />
                {t('map.useMyLocation', 'Mi ubicación')}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="px-3 py-3 space-y-2.5">
          {filteredMarkers.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <MapPin className="h-10 w-10 mx-auto mb-2 text-muted-foreground opacity-60" />
              <p className="text-sm text-muted-foreground">{t('map.noResults', 'No hay puntos que coincidan.')}</p>
            </div>
          ) : (
            filteredMarkers.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setView('map');
                  setFlyTo({ lat: m.lat, lng: m.lng, zoom: 16 });
                  setTimeout(() => setSelected(m), 400);
                }}
                className="w-full text-left glass-card liquid-hover liquid-press p-3.5 flex items-start gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <div className="mt-0.5 h-10 w-10 rounded-2xl bg-primary/12 flex items-center justify-center shrink-0 text-primary">
                  <MapPin className="h-5 w-5" aria-hidden />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm leading-snug line-clamp-2">{m.title}</div>
                  {m.subtitle && (
                    <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{m.subtitle}</div>
                  )}
                  {m.startAt && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                      <Calendar className="h-3 w-3" aria-hidden />
                      {fmtDate(m.startAt)}
                    </div>
                  )}
                  <div className="mt-1.5 text-[11px] font-medium text-primary uppercase tracking-wide">
                    {m.kind === 'event' && 'Evento'}
                    {m.kind === 'sport' && 'Deporte'}
                    {m.kind === 'venue' && 'Recinto'}
                    {m.kind === 'pharmacy' && 'Farmacia'}
                    {m.kind === 'demo' && 'Punto de interés'}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}

      <MarkerSheet marker={selected} onClose={() => setSelected(null)} />
    </div>
  );
};

export default MapPage;


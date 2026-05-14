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
    <div className="min-h-screen bg-background pb-20">
      <SEO
        title="Mapa de eventos y farmacias en Málaga"
        description="Mapa interactivo de Málaga con eventos, recintos y farmacias de guardia cercanas. Encuentra qué hay cerca de ti en tiempo real."
        path="/map"
      />
      {/* Header */}
      <header className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground px-4 pt-4 pb-3 rounded-b-2xl shadow-soft space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <MapPin className="h-5 w-5 shrink-0" />
            <div className="min-w-0">
              <h1 className="text-lg font-bold truncate leading-tight">{t('map.title')}</h1>
              <p className="text-[11px] text-primary-foreground/80 truncate">{t('map.subtitle')}</p>
            </div>
            <Badge variant="secondary" className="bg-white/20 text-primary-foreground border-0 text-[11px] ml-1">
              {filteredMarkers.length}
            </Badge>
          </div>

          <div className="inline-flex rounded-full bg-white/15 backdrop-blur p-0.5 text-xs shrink-0">
            <button
              type="button"
              onClick={() => setView('map')}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1.5 rounded-full transition',
                view === 'map' ? 'bg-white text-primary font-semibold shadow' : 'text-primary-foreground/90'
              )}
            >
              <MapIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t('map.viewMap')}</span>
            </button>
            <button
              type="button"
              onClick={() => setView('list')}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1.5 rounded-full transition',
                view === 'list' ? 'bg-white text-primary font-semibold shadow' : 'text-primary-foreground/90'
              )}
            >
              <List className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t('map.viewList')}</span>
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('map.searchPlaceholder')}
            className="pl-9 pr-9 bg-white text-foreground border-0 h-9 rounded-full"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filter chips */}
        <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 scrollbar-none">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                'shrink-0 text-xs px-3 py-1.5 rounded-full font-medium transition border',
                filter === f.id
                  ? 'bg-white text-primary border-white'
                  : 'bg-white/10 text-primary-foreground border-white/20 hover:bg-white/20'
              )}
            >
              {t(f.key)}
            </button>
          ))}
        </div>
      </header>

      {view === 'map' ? (
        <div className="h-[calc(100vh-220px)] relative">
          <LeafletMap
            markers={filteredMarkers}
            center={MALAGA_CENTER}
            zoom={13}
            onMarkerSelect={handleSelect}
            userLocation={userLocation}
            flyTo={flyTo}
          />

          <div className="absolute bottom-4 left-3 right-3 z-[400] flex items-center justify-center pointer-events-none">
            <Button
              size="sm"
              onClick={handleMyLocation}
              className="pointer-events-auto rounded-full shadow-lg bg-background text-foreground hover:bg-background/90 border border-border/60"
            >
              <Locate className="h-4 w-4 mr-1.5" />
              {t('map.useMyLocation')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="px-4 py-3 space-y-2">
          {filteredMarkers.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">{t('map.noResults')}</Card>
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
                className="w-full text-left"
              >
                <Card className="p-3 hover:shadow-md transition flex items-start gap-3">
                  <div
                    className="mt-0.5 h-9 w-9 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: 'hsl(var(--primary) / 0.12)', color: 'hsl(var(--primary))' }}
                  >
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm leading-snug line-clamp-2">{m.title}</div>
                    {m.subtitle && (
                      <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{m.subtitle}</div>
                    )}
                    {m.startAt && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        <Calendar className="h-3 w-3" />
                        {fmtDate(m.startAt)}
                      </div>
                    )}
                  </div>
                </Card>
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

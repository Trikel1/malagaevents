import { useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { MapPin, List, Map as MapIcon, Locate, Search, Calendar } from 'lucide-react';
import { useEvents } from '@/hooks/useEvents';
import { useSportsEvents } from '@/hooks/useSportsEvents';
import { useAppMode } from '@/contexts/AppModeContext';
import { LeafletMap } from '@/modules/maps/LeafletMap';
import { MarkerSheet } from '@/modules/maps/MarkerSheet';
import type { MapMarker } from '@/modules/maps/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { mapVenueToCoords, MALAGA_CENTER } from '@/lib/venueCoords';
import { cn } from '@/lib/utils';

interface MarkerWithMeta extends MapMarker {
  approximate: boolean;
  startAt: string | null;
  venue: string;
}

const MAX_MARKERS = 120;

const MapPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { appMode } = useAppMode();

  const [view, setView] = useState<'map' | 'list'>('map');
  const [selected, setSelected] = useState<MapMarker | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);
  const [bounds, setBounds] = useState<
    { north: number; south: number; east: number; west: number } | null
  >(null);
  const [areaFilterActive, setAreaFilterActive] = useState(false);

  const { data: cultureEvents = [] } = useEvents({ limit: 200 });
  const { data: sportsEvents = [] } = useSportsEvents({});

  const allMarkers: MarkerWithMeta[] = useMemo(() => {
    const fmt = (d?: string | null) => (d ? format(new Date(d), 'dd MMM HH:mm') : '');

    const list =
      appMode === 'deportes'
        ? sportsEvents.map((e: any) => {
            const hasReal = Number.isFinite(Number(e.lat)) && Number.isFinite(Number(e.lng));
            const coords = hasReal
              ? { lat: Number(e.lat), lng: Number(e.lng), approximate: false }
              : mapVenueToCoords(e.venue_name, e.id);
            return {
              id: e.id,
              title: e.title,
              subtitle: [e.venue_name, fmt(e.start_datetime)].filter(Boolean).join(' · '),
              lat: coords.lat,
              lng: coords.lng,
              approximate: coords.approximate,
              startAt: e.start_datetime ?? null,
              venue: e.venue_name ?? '',
            };
          })
        : cultureEvents.map((e: any) => {
            const hasReal = Number.isFinite(Number(e.lat)) && Number.isFinite(Number(e.lng));
            const coords = hasReal
              ? { lat: Number(e.lat), lng: Number(e.lng), approximate: false }
              : mapVenueToCoords(e.venue_name, e.id);
            return {
              id: e.id,
              title: e.title,
              subtitle: [e.venue_name, fmt(e.start_at)].filter(Boolean).join(' · '),
              lat: coords.lat,
              lng: coords.lng,
              approximate: coords.approximate,
              startAt: e.start_at ?? null,
              venue: e.venue_name ?? '',
            };
          });

    return list.slice(0, MAX_MARKERS);
  }, [appMode, cultureEvents, sportsEvents]);

  const visibleMarkers: MarkerWithMeta[] = useMemo(() => {
    if (!areaFilterActive || !bounds) return allMarkers;
    return allMarkers.filter(
      (m) =>
        m.lat <= bounds.north &&
        m.lat >= bounds.south &&
        m.lng <= bounds.east &&
        m.lng >= bounds.west
    );
  }, [allMarkers, bounds, areaFilterActive]);

  const approxCount = useMemo(
    () => visibleMarkers.filter((m) => m.approximate).length,
    [visibleMarkers]
  );

  const handleSelect = useCallback(
    (id: string) => {
      const m = allMarkers.find((mk) => mk.id === id);
      if (m) setSelected(m);
    },
    [allMarkers]
  );

  const handleMyLocation = useCallback(() => {
    if (!('geolocation' in navigator)) {
      toast({
        title: t('map.geolocationUnavailable'),
        variant: 'destructive',
      });
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

  const handleSearchArea = useCallback(() => {
    setAreaFilterActive(true);
    toast({ title: t('map.areaUpdated') });
  }, [toast, t]);

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground px-4 pt-4 pb-3 rounded-b-2xl shadow-soft">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <MapPin className="h-5 w-5 shrink-0" />
            <h1 className="text-lg font-bold truncate">{t('map.title')}</h1>
            <Badge variant="secondary" className="bg-white/20 text-primary-foreground border-0 text-[11px] ml-1">
              {visibleMarkers.length}
            </Badge>
          </div>

          {/* Map / List toggle */}
          <div className="inline-flex rounded-full bg-white/15 backdrop-blur p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setView('map')}
              className={cn(
                'flex items-center gap-1 px-3 py-1.5 rounded-full transition',
                view === 'map'
                  ? 'bg-white text-primary font-semibold shadow'
                  : 'text-primary-foreground/90'
              )}
              aria-pressed={view === 'map'}
            >
              <MapIcon className="h-3.5 w-3.5" />
              {t('map.viewMap')}
            </button>
            <button
              type="button"
              onClick={() => setView('list')}
              className={cn(
                'flex items-center gap-1 px-3 py-1.5 rounded-full transition',
                view === 'list'
                  ? 'bg-white text-primary font-semibold shadow'
                  : 'text-primary-foreground/90'
              )}
              aria-pressed={view === 'list'}
            >
              <List className="h-3.5 w-3.5" />
              {t('map.viewList')}
            </button>
          </div>
        </div>
      </header>

      {view === 'map' ? (
        <div className="h-[calc(100vh-160px)] relative">
          <LeafletMap
            markers={visibleMarkers}
            center={MALAGA_CENTER}
            zoom={12}
            onMarkerSelect={handleSelect}
            onMoveEnd={setBounds}
            userLocation={userLocation}
            flyTo={flyTo}
          />

          {/* Approx legend */}
          {approxCount > 0 && (
            <div className="absolute top-3 left-3 z-[400] bg-background/90 backdrop-blur px-3 py-1.5 rounded-full shadow border border-border/60 text-[11px] font-medium flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full" style={{ background: 'hsl(35,80%,50%)' }} />
              {approxCount} · {t('map.approximateLocation')}
            </div>
          )}

          {/* Floating actions */}
          <div className="absolute bottom-4 left-3 right-3 z-[400] flex items-center justify-between gap-2 pointer-events-none">
            <Button
              size="sm"
              onClick={handleMyLocation}
              className="pointer-events-auto rounded-full shadow-lg bg-background text-foreground hover:bg-background/90 border border-border/60"
            >
              <Locate className="h-4 w-4 mr-1.5" />
              {t('map.useMyLocation')}
            </Button>
            <Button
              size="sm"
              onClick={handleSearchArea}
              className="pointer-events-auto rounded-full shadow-lg"
            >
              <Search className="h-4 w-4 mr-1.5" />
              {t('map.searchThisArea')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="px-4 py-3 space-y-2">
          {visibleMarkers.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              {t('map.noEventsHere')}
            </Card>
          ) : (
            visibleMarkers.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => navigate(`/events/${m.id}`)}
                className="w-full text-left"
              >
                <Card className="p-3 hover:shadow-md transition flex items-start gap-3">
                  <div
                    className="mt-0.5 h-9 w-9 rounded-full flex items-center justify-center shrink-0"
                    style={{
                      background: m.approximate ? 'hsl(35 80% 50% / 0.15)' : 'hsl(173 80% 38% / 0.15)',
                      color: m.approximate ? 'hsl(35,80%,40%)' : 'hsl(173,80%,32%)',
                    }}
                  >
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm leading-snug line-clamp-2">{m.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                      {m.venue}
                    </div>
                    {m.startAt && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(m.startAt), 'dd MMM HH:mm')}
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

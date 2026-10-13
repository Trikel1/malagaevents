import { useTranslation } from 'react-i18next';
import { formatEventWhen } from '@/lib/eventTime';
import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

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
import MarkerDetails from '@/modules/maps/MarkerDetails';
import type { MapMarker, MarkerKind } from '@/modules/maps/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import SEO from '@/components/common/SEO';
import { useIsMobile } from '@/hooks/use-mobile';
import { resolvePoint, toLatLng, MALAGA_CENTER } from '@/lib/venueCoords';
import { isWithinScope, type MapTimeScope } from '@/lib/mapTimeScope';
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

const FILTERS: { id: FilterKind; icon: typeof CalendarDays; color?: string }[] = [
  { id: 'all', icon: MapPin },
  { id: 'events', icon: CalendarDays, color: COLOR_OF.event },
  { id: 'sports', icon: Trophy, color: COLOR_OF.sport },
  { id: 'venues', icon: Building2, color: COLOR_OF.venue },
  { id: 'pharmacies', icon: Cross, color: COLOR_OF.pharmacy },
];

const SCOPES: { id: MapTimeScope }[] = [
  { id: 'today' },
  { id: 'week' },
  { id: 'all' },
];

/** Accepted `?kind=` deep-link values. */
const KIND_TO_FILTER: Record<string, FilterKind> = {
  event: 'events',
  events: 'events',
  sport: 'sports',
  sports: 'sports',
  venue: 'venues',
  venues: 'venues',
  pharmacy: 'pharmacies',
  pharmacies: 'pharmacies',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;




const MapPage = () => {
  const { t, i18n } = useTranslation();
  const fmtWhen = (iso?: string | null) => formatEventWhen(iso, i18n.language, t('events.timeTBC'));
  const isMobile = useIsMobile();
  const [searchParams] = useSearchParams();
  const [pendingEventId, setPendingEventId] = useState<string | null>(null);


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
  // usePharmaciesOnDuty returns the duty result (rows + provenance), not a bare list.
  const pharmacies = pharmaciesQuery.data?.rows ?? [];


  // An unavailable domain must not block results from another selected domain.
  const queriesByFilter = { events: eventsQuery, sports: sportsQuery, venues: venuesQuery, pharmacies: pharmaciesQuery };
  const activeQueries = filter === 'all' ? Object.values(queriesByFilter) : [queriesByFilter[filter]];
  const isLoading = activeQueries.some(query => query.isLoading);
  const isError = activeQueries.some(query => query.isError);

  const retry = useCallback(() => {
    eventsQuery.refetch();
    sportsQuery.refetch();
    venuesQuery.refetch();
    pharmaciesQuery.refetch();
  }, [eventsQuery, sportsQuery, venuesQuery, pharmaciesQuery]);

  /**
   * A candidate point. `point === null` means we have no verified location:
   * it is listed as "Ubicación pendiente" and never gets a pin on the map.
   */
  type Candidate = Omit<MapMarker, 'lat' | 'lng' | 'approximate'> & {
    point: { lat: number; lng: number; precision: 'exact' | 'approximate' } | null;
  };

  const eventCandidates = useMemo<Candidate[]>(
    () =>
      (cultureEvents as any[]).map((e) => ({
        id: `ev-${e.id}`,
        eventId: e.id,
        kind: 'event' as MarkerKind,
        title: e.title,
        subtitle: [e.venue_name, e.venues?.name, e.locations?.name].filter(Boolean)[0] ?? '',
        address: e.address ?? e.venue_name ?? '',
        startAt: e.start_at ?? null,
        point: resolvePoint({
          lat: e.lat,
          lng: e.lng,
          venueLat: e.venues?.lat,
          venueLng: e.venues?.lng,
          venueName: e.venue_name ?? e.venues?.name,
        }),
      })),
    [cultureEvents]
  );

  const sportCandidates = useMemo<Candidate[]>(
    () =>
      (sportsEvents as any[]).map((e) => ({
        id: `sp-${e.id}`,
        eventId: e.id,
        kind: 'sport' as MarkerKind,
        title: e.title,
        // useSportsEvents maps rows to SportEvent: { start_at, venue, city }.
        subtitle: [e.venue, e.city].filter(Boolean).join(' · '),
        address: e.address ?? e.venue ?? '',
        startAt: e.start_at ?? null,
        point: resolvePoint({ lat: e.lat, lng: e.lng, venueName: e.venue }),
      })),
    [sportsEvents]
  );

  const venueCandidates = useMemo<Candidate[]>(
    () =>
      (venues as any[]).map((v) => ({
        id: `vn-${v.id}`,
        kind: 'venue' as MarkerKind,
        title: v.name,
        subtitle: v.city ?? '',
        address: v.address ?? '',
        point: resolvePoint({ lat: v.lat, lng: v.lng, venueName: v.name }),
      })),
    [venues]
  );

  const pharmacyCandidates = useMemo<Candidate[]>(
    () =>
      (pharmacies as any[]).map((p) => ({
        id: `ph-${p.id}`,
        kind: 'pharmacy' as MarkerKind,
        title: p.name,
        subtitle: p.municipality ?? '',
        address: p.address ?? '',
        phone: p.phone ?? undefined,
        onDuty: true,
        point: resolvePoint({ lat: p.lat, lng: p.lng }),
      })),
    [pharmacies]
  );

  const allCandidates = useMemo<Candidate[]>(
    () => [...eventCandidates, ...sportCandidates, ...venueCandidates, ...pharmacyCandidates],
    [eventCandidates, sportCandidates, venueCandidates, pharmacyCandidates]
  );

  /** Time scope only narrows dated items (events / sports). */
  const scopedCandidates = useMemo<Candidate[]>(() => {
    const now = new Date();
    return allCandidates.filter((m) => isWithinScope(m.startAt, scope, now));
  }, [allCandidates, scope]);

  const searchedCandidates = useMemo<Candidate[]>(() => {
    const q = search.trim().toLowerCase();
    if (!q) return scopedCandidates;
    return scopedCandidates.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        (m.subtitle ?? '').toLowerCase().includes(q) ||
        (m.address ?? '').toLowerCase().includes(q)
    );
  }, [scopedCandidates, search]);

  const counts = useMemo(() => {
    const by = (k: MarkerKind) => searchedCandidates.filter((m) => m.kind === k).length;
    return {
      all: searchedCandidates.length,
      events: by('event'),
      sports: by('sport'),
      venues: by('venue'),
      pharmacies: by('pharmacy'),
    };
  }, [searchedCandidates]);

  const filteredCandidates = useMemo<Candidate[]>(
    () =>
      filter === 'all'
        ? searchedCandidates
        : searchedCandidates.filter((m) => m.kind === KIND_OF[filter]),
    [searchedCandidates, filter]
  );

  const toMarker = (c: Candidate): MapMarker => ({
    ...c,
    lat: c.point!.lat,
    lng: c.point!.lng,
    approximate: c.point!.precision === 'approximate',
  });

  /** Only located points reach the map. */
  const filteredMarkers = useMemo<MapMarker[]>(
    () => filteredCandidates.filter((c) => c.point).slice(0, MAX_MARKERS).map(toMarker),
    [filteredCandidates]
  );

  /** Honest bucket: real records we cannot place on the map yet. */
  const pendingLocation = useMemo(
    () => filteredCandidates.filter((c) => !c.point),
    [filteredCandidates]
  );



  const handleSelect = useCallback(
    (id: string) => {
      const c = allCandidates.find((mk) => mk.id === id);
      if (c?.point) setSelected(toMarker(c));
    },
    [allCandidates]
  );


  const handleMyLocation = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setLocError(t('mapUI.geoUnsupported'));
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
            ? t('mapUI.geoDenied')
            : t('mapUI.geoError')
        );
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, [t]);

  useEffect(() => {
    setSelected(null);
  }, [filter, scope]);

  /**
   * Deep links used by the cards elsewhere in the app:
   * `/map?event=<uuid>`, `/map?venue=<name>`, `/map?kind=pharmacy`,
   * `/map?lat=&lng=`, `/map?q=`. Every parameter is validated; we never fly to
   * invented coordinates and we always widen the scope so the target is inside
   * the current view instead of silently filtered out.
   */
  const deepLinkAppliedRef = useRef(false);
  useEffect(() => {
    if (deepLinkAppliedRef.current) return;

    const kindParam = searchParams.get('kind');
    if (kindParam && kindParam in KIND_TO_FILTER) {
      setFilter(KIND_TO_FILTER[kindParam]);
      setScope('all');
    }

    const q = searchParams.get('q');
    if (q && q.trim()) setSearch(q.trim().slice(0, 120));

    const venueParam = searchParams.get('venue');
    if (venueParam && venueParam.trim()) {
      setFilter('venues');
      setScope('all');
      setSearch(venueParam.trim().slice(0, 120));
    }

    const eventParam = searchParams.get('event');
    if (eventParam && UUID_RE.test(eventParam)) {
      setFilter('all');
      setScope('all');
      setPendingEventId(eventParam);
    }

    const point = toLatLng(searchParams.get('lat'), searchParams.get('lng'));
    if (point) setFlyTo({ ...point, zoom: 15 });

    deepLinkAppliedRef.current = true;
  }, [searchParams]);

  /** Once data is loaded, select the deep-linked event if it has a location. */
  useEffect(() => {
    if (!pendingEventId) return;
    const c = allCandidates.find((m) => m.eventId === pendingEventId);
    if (!c) return;
    if (c.point) {
      setSelected(toMarker(c));
      setFlyTo({ lat: c.point.lat, lng: c.point.lng, zoom: 16 });
    } else {
      setSearch(c.title.slice(0, 120));
    }
    setPendingEventId(null);
  }, [pendingEventId, allCandidates]);




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
          <p className="text-sm text-muted-foreground mb-4">{t('mapUI.loadError')}</p>
          <Button onClick={retry} className="min-h-11">
            <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
            {t('common.retry')}
          </Button>
        </div>
      ) : filteredMarkers.length === 0 && pendingLocation.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <MapPin className="h-9 w-9 mx-auto mb-3 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm font-medium">
            {scope === 'today'
              ? t('mapUI.noCoordsToday')
              : t('mapUI.noCoordsScope')}
          </p>
          <p className="text-xs text-muted-foreground mt-1 mb-4">
            {t('mapUI.emptyHelp')}
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            {scope === 'today' && (
              <Button className="min-h-11" onClick={() => setScope('week')}>
                {t('mapUI.weekAction')}
              </Button>
            )}
            <Button variant="outline" className="min-h-11" onClick={clearFilters}>
              {t('events.clearFilters')}
            </Button>
            <Button variant="outline" className="min-h-11" onClick={retry}>
              <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
              {t('common.retry')}
            </Button>
          </div>
        </div>
      ) : (
        <>
        {filteredMarkers.map((m) => {

          const when = fmtWhen(m.startAt);
          const active = selected?.id === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => focusMarker(m)}
              className={cn(
                'w-full text-start rounded-2xl border bg-card p-3.5 min-h-[44px] transition-transform duration-200 motion-reduce:transition-none',
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
                    {t(`mapUI.kind.${m.kind ?? 'event'}`)}
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
                          {t('mapUI.approxShort')}
                        </>
                      ) : (
                        <>
                          <Crosshair className="h-3.5 w-3.5" aria-hidden="true" />
                          {t('mapUI.exactShort')}
                        </>
                      )}
                    </span>
                  </span>
                </span>
              </div>
            </button>
          );
        })}

        {pendingLocation.length > 0 && (
          <section
            aria-label={t('mapUI.pendingLabel')}
            className="rounded-2xl border border-dashed border-border bg-muted/30 p-3.5"
          >
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <CircleDashed className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              {t('mapUI.pending', { count: pendingLocation.length })}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {t('mapUI.pendingHelp')}
            </p>
            <ul className="mt-3 space-y-2">
              {pendingLocation.slice(0, 20).map((c) => (
                <li key={c.id} className="rounded-xl bg-background p-3">
                  <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t(`mapUI.kind.${c.kind ?? 'event'}`)}
                  </span>
                  <span className="block text-sm font-medium leading-snug">{c.title}</span>
                  {(c.subtitle || c.address) && (
                    <span className="block text-xs text-muted-foreground mt-0.5">
                      {c.address || c.subtitle}
                    </span>
                  )}
                  {fmtWhen(c.startAt) && (
                    <span className="block text-xs text-muted-foreground mt-0.5">{fmtWhen(c.startAt)}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
        </>
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

      {!isLoading && (isError || filteredMarkers.length === 0) && (
        <div role={isError ? 'alert' : undefined} className="absolute inset-x-4 top-4 z-[400] rounded-xl border border-border bg-background p-3 text-center">
          <p className="text-sm font-medium">
            {isError ? t('mapUI.loadError') : scope === 'today' ? t('mapUI.emptyToday') : t('mapUI.emptyScope')}
          </p>
          <div className="mt-2 flex flex-wrap gap-2 justify-center">
            {isError ? (
              <Button size="sm" className="min-h-11" onClick={retry}>{t('common.retry')}</Button>
            ) : (
              <>
                {scope === 'today' && (
                  <Button size="sm" className="min-h-11" onClick={() => setScope('week')}>
                    Ver esta semana
                  </Button>
                )}
                <Button variant="outline" size="sm" className="min-h-11" onClick={clearFilters}>
                  {t('events.clearFilters')}
                </Button>
              </>
            )}
          </div>
        </div>
      )}


      <div className="absolute bottom-20 start-3 lg:bottom-3 z-[400]">
        <Button
          onClick={handleMyLocation}
          disabled={locating}
          className="min-h-11 rounded-full bg-background text-foreground border border-border hover:bg-muted shadow-sm"
          aria-label={t('mapUI.locate')}
        >
          {locating ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          ) : (
            <Locate className="h-4 w-4 mr-2" aria-hidden="true" />
          )}
          {t('mapUI.myLocation')}
        </Button>
      </div>
    </div>
  );

  return (
    <main className="min-h-dvh bg-background">
      <SEO
        title={t('mapUI.seoTitle')}
        description={t('mapUI.seoDescription')}
        path="/map"
      />

      <div className="mx-auto w-full max-w-[1280px] px-3 sm:px-5 pt-3">
        {/* App bar */}
        <header className="flex items-center gap-3">
          <span className="h-11 w-11 shrink-0 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
            <MapIcon className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight leading-tight">{t('mapUI.title')}</h1>
            <p className="text-[13px] text-muted-foreground leading-snug">{t('mapUI.subtitle')}</p>
          </div>
        </header>

        {/* Search */}
        <div className="relative mt-3">
          <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <label htmlFor="map-search" className="sr-only">{t('mapUI.search')}</label>
          <Input
            id="map-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('mapUI.searchPlaceholder')}
            className="h-12 ps-10 pe-11 rounded-xl bg-card border-border focus-visible:ring-2 focus-visible:ring-primary"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label={t('mapUI.clearSearch')}
              className="absolute end-1.5 top-1/2 -translate-y-1/2 h-11 w-11 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Time scope */}
        <div className="mt-3 flex rounded-full border border-border bg-card p-1" role="group" aria-label={t('mapUI.scopeLabel')}>
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
              {t(`mapUI.scopes.${s.id}`)}
            </button>
          ))}
        </div>

        <p role="status" className="mt-2 text-xs text-muted-foreground">
          {t(`mapUI.scopeSummary.${scope}`)} · {t('mapUI.resultCount', { count: filteredMarkers.length })}
        </p>

        {/* Filters */}
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" role="toolbar" aria-label={t('mapUI.filters')}>
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
                {t(`mapUI.filtersByKind.${f.id}`)}
                <span className={cn('tabular-nums', active ? 'opacity-90' : 'text-muted-foreground')}>
                  {counts[f.id]}
                </span>
              </button>
            );
          })}
        </div>


        {/* View toggle */}
        <div className="mt-3 flex flex-wrap items-center gap-3">

          <div className="inline-flex rounded-full border border-border bg-card p-1" role="group" aria-label={t('mapUI.view')}>
            {(
              [
                { id: 'map' as const, icon: MapIcon },
                { id: 'list' as const, icon: List },
              ]
            ).map(({ id, icon: Icon }) => (
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
                {t(`mapUI.views.${id}`)}
              </button>
            ))}
          </div>



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
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('mapUI.detail')}</p>
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    aria-label={t('mapUI.closeDetail')}
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
              {t('mapUI.pointCount', { count: filteredMarkers.length })}
            </p>
            {resultsList}
          </aside>
        </div>
      </div>

      {isMobile && <MarkerSheet marker={selected} onClose={() => setSelected(null)} />}
    </main>
  );
};

export default MapPage;

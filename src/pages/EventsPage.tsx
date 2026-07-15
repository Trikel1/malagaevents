import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search, SlidersHorizontal, X, AlertTriangle, Navigation, CalendarDays } from 'lucide-react';
import { format } from 'date-fns';
import { getDateLocale } from '@/i18n/dateLocale';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import FilterDrawer, { type EventFilters, type DatePreset, type AgeRange } from '@/components/events/FilterDrawer';
import { VenueKindFilter } from '@/components/events/VenueKindFilter';
import LocationFilter from '@/components/events/LocationFilter';
import UpcomingHighlights from '@/components/events/UpcomingHighlights';
import GroupedEventsList from '@/components/events/GroupedEventsList';
import EmptyState from '@/components/common/EmptyState';
import { EventListSkeleton } from '@/components/common/LoadingSkeleton';
import { useEventsOptimized } from '@/hooks/useEventsOptimized';
import { useFavorites, useToggleFavorite, useFavoriteEvents } from '@/hooks/useFavorites';
import { useLocations } from '@/hooks/useLocations';
import { useAuthContext } from '@/contexts/AuthContext';
import type { EventCategory } from '@/types';
import SEO from '@/components/common/SEO';

// /events is always the cultural agenda. Sports live at /sports.
const EventsPage = () => <CultureEventsPage />;

// ────────────────────────────────────────────────────────────────────────────
// Header preset chips — 4 primary temporal filters
// ────────────────────────────────────────────────────────────────────────────

const PRIMARY_PRESETS: { key: DatePreset; labelKey: string; labelFallback: string }[] = [
  { key: 'today', labelKey: 'events.today', labelFallback: 'Hoy' },
  { key: 'tomorrow', labelKey: 'events.tomorrow', labelFallback: 'Mañana' },
  { key: 'weekend', labelKey: 'events.thisWeekend', labelFallback: 'Este finde' },
  { key: 'next30', labelKey: 'events.next30Days', labelFallback: 'Próximos 30 días' },
];

// ────────────────────────────────────────────────────────────────────────────

const CultureEventsPage = () => {
  const { t, i18n } = useTranslation();
  const locale = getDateLocale(i18n.language);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated } = useAuthContext();

  const initialQuery = searchParams.get('q') || '';
  const initialCategory = searchParams.get('category') as EventCategory | null;
  const initialFilter = searchParams.get('filter');
  const initialAge = searchParams.get('age') as AgeRange | null;
  const initialPreset: DatePreset | undefined =
    initialFilter === 'today'
      ? 'today'
      : initialFilter === 'weekend'
        ? 'weekend'
        : undefined;

  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [debouncedSearch, setDebouncedSearch] = useState(initialQuery);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState<EventFilters>({
    categories: initialCategory ? [initialCategory] : [],
    datePreset: initialPreset,
    familyKids: initialFilter === 'family' ? true : undefined,
    isFree: initialFilter === 'free' ? true : undefined,
    isOutdoor: initialFilter === 'outdoor' ? true : undefined,
    ageRange: initialAge && ['0-3', '4-8', '9-12'].includes(initialAge) ? initialAge : undefined,
  });

  const [selectedVenueIds, setSelectedVenueIds] = useState<string[]>([]);
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);

  const { data: allLocations = [] } = useLocations();
  const priorityCities = useMemo(
    () =>
      selectedLocationIds
        .map((id) => allLocations.find((l) => l.id === id)?.name)
        .filter((n): n is string => !!n),
    [selectedLocationIds, allLocations],
  );

  // Near-me — order-only sort
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);

  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    debounceTimeout.current = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => {
      if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    };
  }, [searchQuery]);

  const queryOptions = useMemo(
    () => ({
      searchQuery: debouncedSearch || undefined,
      filters: filters.onlyFavorites ? undefined : filters,
      venueIds: selectedVenueIds.length > 0 ? selectedVenueIds : undefined,
      locationIds: selectedLocationIds.length > 0 ? selectedLocationIds : undefined,
    }),
    [debouncedSearch, filters, selectedVenueIds, selectedLocationIds],
  );

  const { data: events, isLoading, isError, refetch } = useEventsOptimized(queryOptions);

  const { data: favorites } = useFavorites();
  const { data: favoriteEvents, isLoading: loadingFavorites } = useFavoriteEvents();
  const toggleFavorite = useToggleFavorite();

  const baseDisplayed = filters.onlyFavorites ? favoriteEvents : events;
  const isLoadingEvents = filters.onlyFavorites ? loadingFavorites : isLoading;

  const displayedEvents = useMemo(() => {
    if (!userCoords || !baseDisplayed) return baseDisplayed;
    const haversine = (aLat: number, aLng: number, bLat: number, bLng: number) => {
      const toRad = (v: number) => (v * Math.PI) / 180;
      const R = 6371;
      const dLat = toRad(bLat - aLat);
      const dLng = toRad(bLng - aLng);
      const s =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
      return 2 * R * Math.asin(Math.sqrt(s));
    };
    const eventCoords = (ev: any): { lat: number; lng: number } | null => {
      const lat = ev.lat ?? ev.venue?.lat ?? ev.location?.lat;
      const lng = ev.lng ?? ev.venue?.lng ?? ev.location?.lng;
      if (typeof lat === 'number' && typeof lng === 'number') return { lat, lng };
      return null;
    };
    return [...baseDisplayed].sort((a, b) => {
      const ca = eventCoords(a);
      const cb = eventCoords(b);
      if (!ca && !cb) return 0;
      if (!ca) return 1;
      if (!cb) return -1;
      return (
        haversine(userCoords.lat, userCoords.lng, ca.lat, ca.lng) -
        haversine(userCoords.lat, userCoords.lng, cb.lat, cb.lng)
      );
    });
  }, [baseDisplayed, userCoords]);

  const isFavorite = useCallback(
    (eventId: string) => favorites?.some((f) => f.event_id === eventId) ?? false,
    [favorites],
  );

  const handleToggleFavorite = useCallback(
    (eventId: string) => {
      if (!isAuthenticated) {
        navigate('/auth');
        return;
      }
      toggleFavorite.mutate({ eventId, isFavorite: isFavorite(eventId) });
    },
    [isAuthenticated, navigate, isFavorite, toggleFavorite],
  );

  const setPreset = useCallback(
    (preset: DatePreset) => {
      setFilters((prev) => ({
        ...prev,
        datePreset: prev.datePreset === preset ? undefined : preset,
        dateFrom: undefined,
        dateTo: undefined,
      }));
      setSearchParams((sp) => {
        const next = new URLSearchParams(sp);
        next.delete('filter');
        return next;
      });
    },
    [setSearchParams],
  );

  const handleNearMe = useCallback(() => {
    if (userCoords) {
      setUserCoords(null);
      toast(t('events.clearDistanceSort', 'Orden por cercanía desactivado'));
      return;
    }
    if (!('geolocation' in navigator)) {
      toast.error(t('events.locationUnsupported', 'Tu navegador no soporta geolocalización'));
      return;
    }
    setIsRequestingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setIsRequestingLocation(false);
        toast.success(t('events.sortedByDistance', 'Ordenado por cercanía'));
      },
      (err) => {
        setIsRequestingLocation(false);
        if (err.code === err.PERMISSION_DENIED) {
          toast.error(
            t(
              'events.locationPermissionDenied',
              'Permiso de ubicación denegado. Actívalo en los ajustes del navegador.',
            ),
          );
        } else {
          toast.error(t('events.locationError', 'No pudimos obtener tu ubicación'));
        }
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 },
    );
  }, [userCoords, t]);

  const clearAllFilters = useCallback(() => {
    setFilters({ categories: [] });
    setSelectedVenueIds([]);
    setSelectedLocationIds([]);
    setSearchQuery('');
    setUserCoords(null);
    setSearchParams({});
  }, [setSearchParams]);

  // ── Active-filter chip descriptors ────────────────────────────────────────
  type Chip = { key: string; label: string; onRemove: () => void };
  const activeChips: Chip[] = useMemo(() => {
    const chips: Chip[] = [];
    if (debouncedSearch) {
      chips.push({
        key: 'q',
        label: `“${debouncedSearch}”`,
        onRemove: () => {
          setSearchQuery('');
          setSearchParams({});
        },
      });
    }
    if (filters.datePreset) {
      const p = PRIMARY_PRESETS.find((x) => x.key === filters.datePreset);
      chips.push({
        key: 'preset',
        label: p ? t(p.labelKey, p.labelFallback) : String(filters.datePreset),
        onRemove: () => setFilters((f) => ({ ...f, datePreset: undefined })),
      });
    }
    if (filters.dateFrom || filters.dateTo) {
      const from = filters.dateFrom ? format(filters.dateFrom, 'd MMM', { locale }) : '…';
      const to = filters.dateTo ? format(filters.dateTo, 'd MMM', { locale }) : '…';
      chips.push({
        key: 'daterange',
        label: `${from} – ${to}`,
        onRemove: () =>
          setFilters((f) => ({ ...f, dateFrom: undefined, dateTo: undefined })),
      });
    }
    for (const c of filters.categories) {
      chips.push({
        key: `cat:${c}`,
        label: t(`categories.${c}`, c),
        onRemove: () =>
          setFilters((f) => ({ ...f, categories: f.categories.filter((x) => x !== c) })),
      });
    }
    if (filters.isFree) {
      chips.push({
        key: 'free',
        label: t('events.freeOnly', 'Gratis'),
        onRemove: () => setFilters((f) => ({ ...f, isFree: undefined })),
      });
    }
    if (filters.withTickets) {
      chips.push({
        key: 'tickets',
        label: t('events.withTickets', 'Con entradas'),
        onRemove: () => setFilters((f) => ({ ...f, withTickets: undefined })),
      });
    }
    if (filters.familyKids) {
      chips.push({
        key: 'family',
        label: t('events.familyKids', 'Infantil / Familiar'),
        onRemove: () => setFilters((f) => ({ ...f, familyKids: undefined })),
      });
    }
    if (filters.ageRange) {
      chips.push({
        key: 'age',
        label: `${filters.ageRange} ${t('events.yearsShort', 'años')}`,
        onRemove: () => setFilters((f) => ({ ...f, ageRange: undefined })),
      });
    }
    if (filters.isOutdoor) {
      chips.push({
        key: 'outdoor',
        label: t('events.outdoor', 'Al aire libre'),
        onRemove: () => setFilters((f) => ({ ...f, isOutdoor: undefined })),
      });
    }
    if (filters.onlyFavorites) {
      chips.push({
        key: 'fav',
        label: t('events.favorites', 'Favoritos'),
        onRemove: () => setFilters((f) => ({ ...f, onlyFavorites: undefined })),
      });
    }
    if (selectedLocationIds.length > 0) {
      chips.push({
        key: 'loc',
        label:
          selectedLocationIds.length === 1
            ? allLocations.find((l) => l.id === selectedLocationIds[0])?.name ??
              t('events.localityShort', 'Localidad')
            : `${selectedLocationIds.length} ${t('events.localitiesShort', 'localidades')}`,
        onRemove: () => setSelectedLocationIds([]),
      });
    }
    if (selectedVenueIds.length > 0) {
      chips.push({
        key: 'venues',
        label:
          selectedVenueIds.length === 1
            ? t('events.oneVenueSelected', '1 recinto')
            : `${selectedVenueIds.length} ${t('events.venuesShort', 'recintos')}`,
        onRemove: () => setSelectedVenueIds([]),
      });
    }
    if (userCoords) {
      chips.push({
        key: 'near',
        label: t('events.nearMe', 'Cerca de mí'),
        onRemove: () => setUserCoords(null),
      });
    }
    return chips;
  }, [
    debouncedSearch,
    filters,
    selectedLocationIds,
    selectedVenueIds,
    userCoords,
    allLocations,
    t,
    setSearchParams,
  ]);

  const totalCount = displayedEvents?.length ?? 0;
  const hasFilters = activeChips.length > 0;

  // Human-readable "range" summary shown in the header
  const rangeSummary = useMemo(() => {
    const today = format(new Date(), 'PPPP', { locale });
    const nice = today.charAt(0).toUpperCase() + today.slice(1);
    if (filters.datePreset === 'today') return nice;
    if (filters.datePreset === 'tomorrow') return t('events.tomorrow', 'Mañana');
    if (filters.datePreset === 'weekend') return t('events.thisWeekend', 'Este finde');
    if (filters.datePreset === 'next30') return t('events.next30Days', 'Próximos 30 días');
    if (filters.datePreset === 'thisWeek') return t('events.thisWeek', 'Esta semana');
    return `${t('events.today', 'Hoy')} · ${nice}`;
  }, [filters.datePreset, t]);

  return (
    <div className="min-h-dvh bg-background">
      <SEO
        title={t('seo.events.title')}
        description={t('seo.events.description')}
        path="/events"
        jsonLd={
          displayedEvents && displayedEvents.length > 0
            ? {
                '@context': 'https://schema.org',
                '@type': 'ItemList',
                name: 'Agenda cultural de Málaga',
                itemListElement: displayedEvents.slice(0, 20).map((ev, i) => ({
                  '@type': 'ListItem',
                  position: i + 1,
                  url: `https://malagaevents.lovable.app/events/${ev.id}`,
                  name: ev.title,
                })),
              }
            : undefined
        }
      />

      {/* ── EDITORIAL HEADER ────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-md border-b border-border/60">
        <div className="mx-auto w-full max-w-[1180px] px-4 lg:px-8 pt-4 pb-3 space-y-3">
          {/* Editorial title block */}
          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] sm:text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground/85">
                {t('events.agendaKicker', 'Agenda cultural · Málaga')}
              </p>
              <h1 className="mt-1 font-display text-[26px] sm:text-[32px] lg:text-[38px] font-semibold tracking-tight leading-[1.1] text-foreground">
                {t('events.agendaTitle', 'Agenda cultural')}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground capitalize-first">
                <span className="capitalize">{rangeSummary}</span>
                <span className="mx-1.5 opacity-40">·</span>
                <span className="tabular-nums">
                  {isLoadingEvents
                    ? '…'
                    : t('events.eventCount', { count: totalCount })}
                </span>
              </p>


            </div>
          </div>




          {/* Search + location + filter + near-me */}
          <div className="flex items-center gap-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (searchQuery.trim()) setSearchParams({ q: searchQuery });
                else setSearchParams({});
              }}
              className="relative flex-1 min-w-0"
              role="search"
            >
              <label htmlFor="event-search" className="sr-only">
                {t('common.search', 'Buscar')}
              </label>
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                ref={searchInputRef}
                id="event-search"
                type="search"
                placeholder={t('events.searchPlaceholderShort', 'Buscar…')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-9 h-11 rounded-full text-sm bg-background/70 border-border/60 focus-visible:ring-primary"
              />
              {searchQuery && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full"
                  onClick={() => {
                    setSearchQuery('');
                    setSearchParams({});
                  }}
                  aria-label={t('common.clearSearch', 'Limpiar búsqueda')}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </Button>
              )}
            </form>
            <LocationFilter
              selectedLocationIds={selectedLocationIds}
              onSelectionChange={setSelectedLocationIds}
              showLabel={false}
            />
            <Button
              variant="outline"
              size="icon"
              onClick={handleNearMe}
              disabled={isRequestingLocation}
              aria-pressed={!!userCoords}
              aria-label={t('events.nearMe', 'Cerca de mí')}
              className={cn(
                'h-11 w-11 min-h-[44px] min-w-[44px] rounded-full shrink-0 transition-colors',
                userCoords && 'bg-primary text-primary-foreground border-primary hover:bg-primary/90',
                isRequestingLocation && 'opacity-60',
              )}
            >
              <Navigation className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setIsFilterOpen(true)}
              className="h-11 w-11 min-h-[44px] min-w-[44px] rounded-full relative shrink-0"
              aria-label={t('events.filters', 'Filtros')}
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              {activeChips.length > 0 && (
                <Badge
                  variant="secondary"
                  className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 flex items-center justify-center text-[10px]"
                >
                  {activeChips.length}
                </Badge>
              )}
            </Button>
          </div>

          {/* Time presets — compact segmented row */}
          <div
            role="tablist"
            aria-label={t('events.timeRange', 'Franja temporal')}
            className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1 sm:mx-0 sm:px-0 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {PRIMARY_PRESETS.map((p) => {
              const active = filters.datePreset === p.key;
              const shortLabel =
                p.key === 'next30'
                  ? t('events.next30Short', '30 días')
                  : t(p.labelKey, p.labelFallback);
              return (
                <button
                  key={p.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setPreset(p.key)}
                  className={cn(
                    'shrink-0 min-h-[44px] px-4 rounded-full text-[13px] font-medium border transition-all whitespace-nowrap',
                    active
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-muted/60 text-muted-foreground border-border/60 hover:bg-muted hover:text-foreground',
                  )}

                >
                  {shortLabel}
                </button>
              );
            })}
          </div>

          {/* Active filter chips */}
          {hasFilters && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {activeChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={chip.onRemove}
                  className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-0.5 rounded-full bg-secondary/70 hover:bg-secondary text-secondary-foreground text-[11px] border border-border/60 max-w-full"
                  aria-label={`${t('common.remove', 'Quitar')} ${chip.label}`}
                >
                  <span className="truncate max-w-[160px]">{chip.label}</span>
                  <X className="h-3 w-3 shrink-0" aria-hidden="true" />
                </button>
              ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="min-h-[44px] px-3 text-xs text-muted-foreground hover:text-foreground"
              >
                {t('events.clearFilters', 'Limpiar')}
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* ── BODY ───────────────────────────────────────────────────────── */}
      <main className="mx-auto w-full max-w-[1180px] px-4 lg:px-8 py-6">
        <div className="mb-4">
          <VenueKindFilter
            selectedVenueIds={selectedVenueIds}
            onVenueIdsChange={setSelectedVenueIds}
            priorityCities={priorityCities}
          />
        </div>
        {isLoadingEvents ? (
          <EventListSkeleton count={4} />
        ) : isError ? (
          <EmptyState
            icon={AlertTriangle}
            title={t('errors.loadFailed', 'Error al cargar')}
            description={t(
              'errors.loadFailedDesc',
              'No se pudieron cargar los eventos. Comprueba tu conexión e inténtalo de nuevo.',
            )}
            actionLabel={t('common.retry', 'Reintentar')}
            onAction={() => refetch()}
            variant="error"
          />
        ) : displayedEvents && displayedEvents.length > 0 ? (
          <>
            {!userCoords && (
              <UpcomingHighlights events={displayedEvents} />
            )}
            <GroupedEventsList
              events={displayedEvents}
              isFavorite={isFavorite}
              onToggleFavorite={handleToggleFavorite}
            />
          </>
        ) : (
          <EmptyState
            icon={Search}
            title={t('events.noEventsWithFilters', 'No hay eventos con estos filtros')}
            description={t(
              'events.noEventsHint',
              'Prueba otra fecha, localidad o recinto.',
            )}
            actionLabel={hasFilters ? t('events.clearFilters', 'Limpiar filtros') : undefined}
            onAction={hasFilters ? clearAllFilters : undefined}
            secondaryActionLabel={t('events.next30Days', 'Próximos 30 días')}
            onSecondaryAction={() => {
              clearAllFilters();
              setPreset('next30');
            }}
          />
        )}
      </main>

      <FilterDrawer
        open={isFilterOpen}
        onOpenChange={setIsFilterOpen}
        filters={filters}
        onApplyFilters={setFilters}
        showFavoritesFilter={isAuthenticated}
      />
    </div>
  );
};

export default EventsPage;

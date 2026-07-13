import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search, SlidersHorizontal, X, MapPin, AlertTriangle, Navigation } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import EventCard from '@/components/events/EventCard';
import FilterDrawer, { type EventFilters, type DatePreset, type AgeRange } from '@/components/events/FilterDrawer';
import { VenueKindFilter } from '@/components/events/VenueKindFilter';
import LocationFilter from '@/components/events/LocationFilter';
import EmptyState from '@/components/common/EmptyState';
import { EventListSkeleton } from '@/components/common/LoadingSkeleton';
import { useEventsOptimized } from '@/hooks/useEventsOptimized';
import { useFavorites, useToggleFavorite, useFavoriteEvents } from '@/hooks/useFavorites';
import { useLocations } from '@/hooks/useLocations';
import { useAuthContext } from '@/contexts/AuthContext';
import { useAppMode } from '@/contexts/AppModeContext';
import SportsEventsPage from '@/components/sports/SportsEventsPage';
import type { EventCategory } from '@/types';
import SEO from '@/components/common/SEO';

const EventsPage = () => {
  const { appMode } = useAppMode();

  // Sports mode: render entirely different page
  if (appMode === 'deportes') {
    return <SportsEventsPage />;
  }

  return <CultureEventsPage />;
};

const CultureEventsPage = () => {
  const { t } = useTranslation();
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
  const [showSearchInput, setShowSearchInput] = useState(!!initialQuery);
  const [filters, setFilters] = useState<EventFilters>({
    categories: initialCategory ? [initialCategory] : [],
    datePreset: initialPreset,
    familyKids: initialFilter === 'family' ? true : undefined,
    isFree: initialFilter === 'free' ? true : undefined,
    isOutdoor: initialFilter === 'outdoor' ? true : undefined,
    ageRange: initialAge && ['0-3','4-8','9-12'].includes(initialAge) ? initialAge : undefined,
  });


  // Venue filter state (single-select via VenueKindFilter sheets)
  const [selectedVenueIds, setSelectedVenueIds] = useState<string[]>([]);
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);

  // Cities associated with the currently selected localities (for venue dropdown priority sort)
  const { data: allLocations = [] } = useLocations();
  const priorityCities = useMemo(
    () =>
      selectedLocationIds
        .map((id) => allLocations.find((l) => l.id === id)?.name)
        .filter((n): n is string => !!n),
    [selectedLocationIds, allLocations],
  );

  // Near me — order-only, non-destructive
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);

  // Debounce search input
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }
    debounceTimeout.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);

    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, [searchQuery]);

  // Focus search input when opened
  useEffect(() => {
    if (showSearchInput && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showSearchInput]);

  // Determine query options based on filters
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

  // Fetch favorites
  const { data: favorites } = useFavorites();
  const { data: favoriteEvents, isLoading: loadingFavorites } = useFavoriteEvents();
  const toggleFavorite = useToggleFavorite();

  // Use favorite events if filter is set
  const baseDisplayed = filters.onlyFavorites ? favoriteEvents : events;
  const isLoadingEvents = filters.onlyFavorites ? loadingFavorites : isLoading;

  // Sort by distance when Near-me active. Events without coords go last.
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

  const isFavorite = (eventId: string) =>
    favorites?.some((f) => f.event_id === eventId) ?? false;

  const handleToggleFavorite = (eventId: string) => {
    if (!isAuthenticated) {
      navigate('/auth');
      return;
    }
    toggleFavorite.mutate({ eventId, isFavorite: isFavorite(eventId) });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setSearchParams({ q: searchQuery });
    } else {
      setSearchParams({});
    }
  };

  const togglePreset = useCallback((preset: DatePreset) => {
    setFilters((prev) => ({
      ...prev,
      datePreset: prev.datePreset === preset ? undefined : preset,
      // Presets and manual date range are mutually exclusive
      dateFrom: undefined,
      dateTo: undefined,
    }));
    // Keep URL in sync for today/weekend legacy links; drop it otherwise
    setSearchParams((sp) => {
      const next = new URLSearchParams(sp);
      next.delete('filter');
      return next;
    });
  }, [setSearchParams]);

  const toggleBooleanFilter = useCallback(
    (key: 'isFree' | 'withTickets' | 'familyKids' | 'isOutdoor') => {
      setFilters((prev) => ({ ...prev, [key]: prev[key] ? undefined : true }));
    },
    [],
  );

  const toggleAgeRange = useCallback((range: AgeRange) => {
    setFilters((prev) => ({
      ...prev,
      ageRange: prev.ageRange === range ? undefined : range,
    }));
  }, []);

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
    setShowSearchInput(false);
    setUserCoords(null);
    setSearchParams({});
  }, [setSearchParams]);

  const activeFilterCount =
    filters.categories.length +
    (filters.isFree ? 1 : 0) +
    (filters.withTickets ? 1 : 0) +
    (filters.familyKids ? 1 : 0) +
    (filters.ageRange ? 1 : 0) +
    (filters.isOutdoor ? 1 : 0) +
    (filters.datePreset ? 1 : 0) +
    (filters.dateFrom ? 1 : 0) +
    (filters.dateTo ? 1 : 0) +
    (filters.onlyFavorites ? 1 : 0);

  const totalActiveFilters =
    activeFilterCount +
    (selectedVenueIds.length > 0 ? 1 : 0) +
    selectedLocationIds.length +
    (debouncedSearch ? 1 : 0) +
    (userCoords ? 1 : 0);

  const quickPresets: { key: DatePreset; label: string }[] = [
    { key: 'today', label: t('events.today', 'Hoy') },
    { key: 'tomorrow', label: t('events.tomorrow', 'Mañana') },
    { key: 'thisWeek', label: t('events.thisWeek', 'Esta semana') },
    { key: 'weekend', label: t('events.thisWeekend', 'Este finde') },
    { key: 'next30', label: t('events.next30Days', 'Próximos 30 días') },
  ];

  const quickCategories: { key: EventCategory; label: string }[] = [
    { key: 'music' as EventCategory, label: t('categories.music', 'Conciertos') },
    { key: 'theater' as EventCategory, label: t('categories.theater', 'Teatro') },
    { key: 'festivals' as EventCategory, label: t('categories.festivals', 'Festivales') },
    { key: 'exhibitions' as EventCategory, label: t('categories.exhibitions', 'Museos / Exposiciones') },
  ];

  const toggleCategory = useCallback((cat: EventCategory) => {
    setFilters((prev) => ({
      ...prev,
      categories: prev.categories.includes(cat)
        ? prev.categories.filter((c) => c !== cat)
        : [...prev.categories, cat],
    }));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Eventos en Málaga — Conciertos, Cultura y Planes"
        description="Todos los eventos de Málaga capital y provincia: conciertos, teatro, exposiciones, festivales y planes para hoy, este finde y los próximos días."
        path="/events"
        jsonLd={displayedEvents && displayedEvents.length > 0 ? {
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "Eventos en Málaga",
          itemListElement: displayedEvents.slice(0, 20).map((ev, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: `https://malagaevents.lovable.app/events/${ev.id}`,
            name: ev.title,
          })),
        } : undefined}
      />
      {/* Header - Centered actions taking full width */}
      <header className="glass-nav sticky top-0 z-40 rounded-none">
        <div className="p-3 sm:p-4 space-y-3">
          {/* Row 1: 3 centered action buttons (no title) */}
          <div className="flex items-center justify-center gap-1.5 sm:gap-2 min-w-0">
            {/* Localidades - icon + text, flex:1 */}
            <div className="flex-1 min-w-0 flex justify-center">
              <LocationFilter
                selectedLocationIds={selectedLocationIds}
                onSelectionChange={setSelectedLocationIds}
                showLabel={true}
              />
            </div>

            {/* Filtros - icon + text, flex:1 */}
            <div className="flex-1 min-w-0 flex justify-center">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setIsFilterOpen(true)}
                className="h-9 px-2 sm:px-3 gap-1 sm:gap-1.5 relative whitespace-nowrap min-w-0 max-w-full"
              >
                <SlidersHorizontal className="h-4 w-4 shrink-0" />
                <span className="text-sm truncate">{t('events.filters', 'Filtros')}</span>
                {activeFilterCount > 0 && (
                  <Badge 
                    variant="secondary" 
                    className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]"
                  >
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </div>

            {/* Buscar - icon + text toggle, flex:1 */}
            <div className="flex-1 min-w-0 flex justify-center">
              <Button 
                variant={showSearchInput ? 'default' : 'ghost'} 
                size="sm"
                onClick={() => setShowSearchInput(!showSearchInput)}
                className="h-9 px-2 sm:px-3 gap-1 sm:gap-1.5 whitespace-nowrap min-w-0 max-w-full"
              >
                <Search className="h-4 w-4 shrink-0" />
                <span className="text-sm truncate">{t('common.search', 'Buscar')}</span>
              </Button>
            </div>
          </div>

          {/* Clear filters button (only when filters active) */}
          {totalActiveFilters > 0 && (
            <div className="flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="text-muted-foreground h-7 px-2 text-xs"
              >
                <X className="h-3.5 w-3.5 mr-1" />
                {t('events.clearFilters')}
              </Button>
            </div>
          )}

          {/* Search input (collapsible) */}
          {showSearchInput && (
            <form onSubmit={handleSearch} className="relative" role="search">
              <label htmlFor="event-search" className="sr-only">{t('common.search')}</label>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <Input
                ref={searchInputRef}
                id="event-search"
                type="search"
                placeholder={t('common.search')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-10"
                aria-describedby="search-hint"
              />
              <span id="search-hint" className="sr-only">
                {t('events.searchHint', 'Buscar por nombre de evento, sala o descripción')}
              </span>
              {searchQuery && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
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
          )}

          {/* Row 2: Venue kind buttons opening pre-filtered picker */}
          <VenueKindFilter
            selectedVenueIds={selectedVenueIds}
            onVenueIdsChange={setSelectedVenueIds}
            priorityCities={priorityCities}
          />



          {/* Row 3: Quick filter chips (horizontal scroll on mobile) */}
          <div
            className="flex gap-2 overflow-x-auto pb-1 -mx-3 sm:-mx-4 px-3 sm:px-4 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="toolbar"
            aria-label={t('events.quickFilters', 'Filtros rápidos')}
          >
            {quickPresets.map((p) => {
              const active = filters.datePreset === p.key;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => togglePreset(p.key)}
                  aria-pressed={active}
                  className={cn(
                    'shrink-0 h-8 px-3 rounded-full text-xs font-medium border transition-colors whitespace-nowrap',
                    active
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-foreground border-border hover:bg-muted',
                  )}
                >
                  {p.label}
                </button>
              );
            })}

            <span className="shrink-0 self-center mx-1 h-4 w-px bg-border" aria-hidden />

            {quickCategories.map((c) => {
              const active = filters.categories.includes(c.key);
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => toggleCategory(c.key)}
                  aria-pressed={active}
                  className={cn(
                    'shrink-0 h-8 px-3 rounded-full text-xs font-medium border transition-colors whitespace-nowrap',
                    active
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-foreground border-border hover:bg-muted',
                  )}
                >
                  {c.label}
                </button>
              );
            })}

            <span className="shrink-0 self-center mx-1 h-4 w-px bg-border" aria-hidden />


            <button
              type="button"
              onClick={() => toggleBooleanFilter('familyKids')}
              aria-pressed={!!filters.familyKids}
              className={cn(
                'shrink-0 h-8 px-3 rounded-full text-xs font-medium border transition-colors whitespace-nowrap',
                filters.familyKids
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-foreground border-border hover:bg-muted',
              )}
            >
              {t('events.familyKids', 'Infantil / Familiar')}
            </button>
            {(['0-3', '4-8', '9-12'] as AgeRange[]).map((r) => {
              const active = filters.ageRange === r;
              const labelKey = `events.age${r.replace('-', 'to')}`;
              const fallback = `${r} ${t('events.yearsShort', 'años')}`;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => toggleAgeRange(r)}
                  aria-pressed={active}
                  className={cn(
                    'shrink-0 h-8 px-3 rounded-full text-xs font-medium border transition-colors whitespace-nowrap',
                    active
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-foreground border-border hover:bg-muted',
                  )}
                >
                  {t(labelKey, fallback)}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => toggleBooleanFilter('isOutdoor')}
              aria-pressed={!!filters.isOutdoor}
              className={cn(
                'shrink-0 h-8 px-3 rounded-full text-xs font-medium border transition-colors whitespace-nowrap',
                filters.isOutdoor
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-foreground border-border hover:bg-muted',
              )}
            >
              {t('events.outdoor', 'Al aire libre')}
            </button>
            <button
              type="button"
              onClick={() => toggleBooleanFilter('isFree')}
              aria-pressed={!!filters.isFree}
              className={cn(
                'shrink-0 h-8 px-3 rounded-full text-xs font-medium border transition-colors whitespace-nowrap',
                filters.isFree
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-foreground border-border hover:bg-muted',
              )}
            >
              {t('events.freeOnly', 'Gratis')}
            </button>
            <button
              type="button"
              onClick={() => toggleBooleanFilter('withTickets')}
              aria-pressed={!!filters.withTickets}
              className={cn(
                'shrink-0 h-8 px-3 rounded-full text-xs font-medium border transition-colors whitespace-nowrap',
                filters.withTickets
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-foreground border-border hover:bg-muted',
              )}
            >
              {t('events.withTickets', 'Con entradas')}
            </button>
            <button
              type="button"
              onClick={handleNearMe}
              disabled={isRequestingLocation}
              aria-pressed={!!userCoords}
              className={cn(
                'shrink-0 h-8 px-3 rounded-full text-xs font-medium border transition-colors whitespace-nowrap inline-flex items-center gap-1.5',
                userCoords
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-foreground border-border hover:bg-muted',
                isRequestingLocation && 'opacity-60',
              )}
            >
              <Navigation className="h-3 w-3" aria-hidden="true" />
              {isRequestingLocation
                ? t('events.locating', 'Localizando…')
                : userCoords
                  ? t('events.clearDistanceSort', 'Cerca de mí ✕')
                  : t('events.nearMe', 'Cerca de mí')}
            </button>
          </div>
        </div>
      </header>


      <main className="p-4">
        {isLoadingEvents ? (
          <EventListSkeleton count={4} />
        ) : isError ? (
          <EmptyState
            icon={AlertTriangle}
            title={t('errors.loadFailed', 'Error al cargar')}
            description={t('errors.loadFailedDesc', 'No se pudieron cargar los eventos. Comprueba tu conexión e inténtalo de nuevo.')}
            actionLabel={t('common.retry', 'Reintentar')}
            onAction={() => refetch()}
            variant="error"
          />
        ) : displayedEvents && displayedEvents.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {displayedEvents.map((event) => (
              <EventCard 
                key={event.id} 
                event={event}
                dense
                isFavorite={isFavorite(event.id)}
                onToggleFavorite={handleToggleFavorite}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Search}
            title={t('events.noEvents')}
            description={totalActiveFilters > 0 
              ? t('events.noEventsFiltered', 'No hay eventos con los filtros seleccionados. Prueba a limpiar filtros o cambiar la fecha.')
              : t('events.noEventsDesc')}
            actionLabel={totalActiveFilters > 0 ? t('events.clearFilters') : undefined}
            onAction={totalActiveFilters > 0 ? clearAllFilters : undefined}
          />
        )}
      </main>

      {/* Filter Drawer */}
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

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search, SlidersHorizontal, X, MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import EventCard from '@/components/events/EventCard';
import FilterDrawer, { type EventFilters } from '@/components/events/FilterDrawer';
import { VenueGroupDropdown, type VenueGroup } from '@/components/events/VenueGroupDropdown';
import LocationFilter from '@/components/events/LocationFilter';
import EmptyState from '@/components/common/EmptyState';
import { EventListSkeleton } from '@/components/common/LoadingSkeleton';
import { useEventsOptimized } from '@/hooks/useEventsOptimized';
import { useFavorites, useToggleFavorite, useFavoriteEvents } from '@/hooks/useFavorites';
import { useAuthContext } from '@/contexts/AuthContext';
import { useAppMode } from '@/contexts/AppModeContext';
import SportsEventsPage from '@/components/sports/SportsEventsPage';
import type { EventCategory } from '@/types';

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
  
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [debouncedSearch, setDebouncedSearch] = useState(initialQuery);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [showSearchInput, setShowSearchInput] = useState(!!initialQuery);
  const [filters, setFilters] = useState<EventFilters>({
    categories: initialCategory ? [initialCategory] : [],
  });

  // Venue group filter state
  const [selectedVenueGroup, setSelectedVenueGroup] = useState<VenueGroup>('all');
  const [selectedVenueIds, setSelectedVenueIds] = useState<string[]>([]);
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);

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
  const queryOptions = useMemo(() => ({
    searchQuery: debouncedSearch || undefined,
    filters: filters.onlyFavorites ? undefined : filters,
    todayOnly: initialFilter === 'today',
    weekendOnly: initialFilter === 'weekend',
    venueIds: selectedVenueIds.length > 0 ? selectedVenueIds : undefined,
    locationIds: selectedLocationIds.length > 0 ? selectedLocationIds : undefined,
  }), [debouncedSearch, filters, initialFilter, selectedVenueIds, selectedLocationIds]);

  // Fetch events with optimized hook (includes request cancellation)
  const { data: events, isLoading } = useEventsOptimized(queryOptions);
  
  // Fetch favorites
  const { data: favorites } = useFavorites();
  const { data: favoriteEvents, isLoading: loadingFavorites } = useFavoriteEvents();
  const toggleFavorite = useToggleFavorite();

  // Use favorite events if filter is set
  const displayedEvents = filters.onlyFavorites ? favoriteEvents : events;
  const isLoadingEvents = filters.onlyFavorites ? loadingFavorites : isLoading;

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

  const clearAllFilters = useCallback(() => {
    setFilters({ categories: [] });
    setSelectedVenueIds([]);
    setSelectedVenueGroup('all');
    setSelectedLocationIds([]);
    setSearchQuery('');
    setShowSearchInput(false);
    setSearchParams({});
  }, [setSearchParams]);

  const activeFilterCount = 
    filters.categories.length + 
    (filters.isFree ? 1 : 0) + 
    (filters.dateFrom ? 1 : 0) + 
    (filters.dateTo ? 1 : 0) +
    (filters.onlyFavorites ? 1 : 0);

  const totalActiveFilters = activeFilterCount + 
    (selectedVenueGroup !== 'all' ? 1 : 0) + 
    selectedLocationIds.length +
    (debouncedSearch ? 1 : 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header - Centered actions taking full width */}
      <header className="bg-card border-b border-border sticky top-0 z-40">
        <div className="p-4 space-y-3">
          {/* Row 1: 3 centered action buttons (no title) */}
          <div className="flex items-center justify-center gap-2">
            {/* Localidades - icon + text, flex:1 */}
            <div className="flex-1 flex justify-center">
              <LocationFilter
                selectedLocationIds={selectedLocationIds}
                onSelectionChange={setSelectedLocationIds}
                showLabel={true}
              />
            </div>

            {/* Filtros - icon + text, flex:1 */}
            <div className="flex-1 flex justify-center">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setIsFilterOpen(true)}
                className="h-9 px-3 gap-1.5 relative whitespace-nowrap"
              >
                <SlidersHorizontal className="h-4 w-4 shrink-0" />
                <span className="text-sm">{t('events.filters', 'Filtros')}</span>
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
            <div className="flex-1 flex justify-center">
              <Button 
                variant={showSearchInput ? 'default' : 'ghost'} 
                size="sm"
                onClick={() => setShowSearchInput(!showSearchInput)}
                className="h-9 px-3 gap-1.5 whitespace-nowrap"
              >
                <Search className="h-4 w-4 shrink-0" />
                <span className="text-sm">{t('common.search', 'Buscar')}</span>
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

          {/* Row 2: Venue segmented control [Todos] [Salas] [Teatros] - 100% width */}
          <VenueGroupDropdown
            selectedGroup={selectedVenueGroup}
            selectedVenueIds={selectedVenueIds}
            onGroupChange={setSelectedVenueGroup}
            onVenueIdsChange={setSelectedVenueIds}
          />
        </div>
      </header>

      {/* Content */}
      <main className="p-4">
        {isLoadingEvents ? (
          <EventListSkeleton count={4} />
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
            description={t('events.noEventsDesc')}
            actionLabel={t('events.clearFilters')}
            onAction={clearAllFilters}
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

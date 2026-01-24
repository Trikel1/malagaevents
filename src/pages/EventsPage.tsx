import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search, SlidersHorizontal, X } from 'lucide-react';
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
import type { EventCategory } from '@/types';

const EventsPage = () => {
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
  const [filters, setFilters] = useState<EventFilters>({
    categories: initialCategory ? [initialCategory] : [],
  });

  // Venue group filter state
  const [selectedVenueGroup, setSelectedVenueGroup] = useState<VenueGroup>('all');
  const [selectedVenueIds, setSelectedVenueIds] = useState<string[]>([]);
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);

  // Debounce search input
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);
  
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
    selectedLocationIds.length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-40">
        <div className="p-4 space-y-3">
          {/* Title + Clear + More filters */}
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-xl font-bold shrink-0">{t('events.title')}</h1>
            
            <div className="flex items-center gap-2">
              {totalActiveFilters > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  className="text-muted-foreground h-8 px-2"
                >
                  <X className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">{t('events.clearFilters')}</span>
                </Button>
              )}
              
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setIsFilterOpen(true)}
                className="relative gap-1.5 h-8"
              >
                <SlidersHorizontal className="h-4 w-4" />
                <span className="hidden sm:inline">{t('events.moreFilters')}</span>
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </div>
          </div>
          
          {/* Search */}
          <form onSubmit={handleSearch} className="relative" role="search">
            <label htmlFor="event-search" className="sr-only">{t('common.search')}</label>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input
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
                className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9 min-h-[44px] min-w-[44px]"
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

          {/* Quick venue group dropdowns + location filter */}
          <div className="flex items-center gap-2">
            <div className="flex-1 overflow-hidden">
              <VenueGroupDropdown
                selectedGroup={selectedVenueGroup}
                selectedVenueIds={selectedVenueIds}
                onGroupChange={setSelectedVenueGroup}
                onVenueIdsChange={setSelectedVenueIds}
              />
            </div>
            <LocationFilter
              selectedLocationIds={selectedLocationIds}
              onSelectionChange={setSelectedLocationIds}
            />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="p-4">
        {isLoadingEvents ? (
          <EventListSkeleton count={4} />
        ) : displayedEvents && displayedEvents.length > 0 ? (
          <div className="space-y-4">
            {displayedEvents.map((event) => (
              <EventCard 
                key={event.id} 
                event={event}
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

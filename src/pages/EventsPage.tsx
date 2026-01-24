import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import EventCard from '@/components/events/EventCard';
import FilterDrawer, { type EventFilters } from '@/components/events/FilterDrawer';
import VenueFilter from '@/components/events/VenueFilter';
import LocationFilter from '@/components/events/LocationFilter';
import EmptyState from '@/components/common/EmptyState';
import { EventListSkeleton } from '@/components/common/LoadingSkeleton';
import { useEvents } from '@/hooks/useEvents';
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
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState<EventFilters>({
    categories: initialCategory ? [initialCategory] : [],
  });

  // New filters for venue and location
  const [selectedVenueIds, setSelectedVenueIds] = useState<string[]>([]);
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);

  // Determine query options based on filters
  const queryOptions = useMemo(() => ({
    searchQuery: searchQuery || undefined,
    filters: filters.onlyFavorites ? undefined : filters,
    todayOnly: initialFilter === 'today',
    weekendOnly: initialFilter === 'weekend',
    venueIds: selectedVenueIds.length > 0 ? selectedVenueIds : undefined,
    locationIds: selectedLocationIds.length > 0 ? selectedLocationIds : undefined,
  }), [searchQuery, filters, initialFilter, selectedVenueIds, selectedLocationIds]);

  // Fetch events
  const { data: events, isLoading } = useEvents(queryOptions);
  
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

  const totalActiveFilters = activeFilterCount + selectedVenueIds.length + selectedLocationIds.length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-40">
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">{t('events.title')}</h1>
            {totalActiveFilters > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="text-muted-foreground"
              >
                <X className="h-4 w-4 mr-1" />
                {t('events.clearFilters', 'Limpiar filtros')}
              </Button>
            )}
          </div>
          
          {/* Search */}
          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('common.search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-10"
            />
            {searchQuery && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => {
                  setSearchQuery('');
                  setSearchParams({});
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </form>

          {/* Filters Row */}
          <div className="flex flex-wrap gap-2 items-center">
            <VenueFilter
              selectedVenueIds={selectedVenueIds}
              onSelectionChange={setSelectedVenueIds}
            />
            <LocationFilter
              selectedLocationIds={selectedLocationIds}
              onSelectionChange={setSelectedLocationIds}
            />
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setIsFilterOpen(true)}
              className="relative gap-2"
            >
              <SlidersHorizontal className="h-4 w-4" />
              {t('events.moreFilters', 'Más filtros')}
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
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

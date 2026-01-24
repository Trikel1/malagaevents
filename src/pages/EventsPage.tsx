import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search, SlidersHorizontal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import EventCard from '@/components/events/EventCard';
import FilterDrawer, { type EventFilters } from '@/components/events/FilterDrawer';
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

  // Determine query options based on filters
  const queryOptions = useMemo(() => ({
    searchQuery: searchQuery || undefined,
    filters: filters.onlyFavorites ? undefined : filters,
    todayOnly: initialFilter === 'today',
    weekendOnly: initialFilter === 'weekend',
  }), [searchQuery, filters, initialFilter]);

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

  const activeFilterCount = 
    filters.categories.length + 
    (filters.isFree ? 1 : 0) + 
    (filters.dateFrom ? 1 : 0) + 
    (filters.dateTo ? 1 : 0) +
    (filters.onlyFavorites ? 1 : 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-40">
        <div className="p-4 space-y-3">
          <h1 className="text-xl font-bold">{t('events.title')}</h1>
          
          {/* Search & Filter */}
          <div className="flex gap-2">
            <form onSubmit={handleSearch} className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('common.search')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </form>
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => setIsFilterOpen(true)}
              className="relative"
            >
              <SlidersHorizontal className="h-4 w-4" />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                  {activeFilterCount}
                </span>
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
            onAction={() => {
              setFilters({ categories: [] });
              setSearchQuery('');
              setSearchParams({});
            }}
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

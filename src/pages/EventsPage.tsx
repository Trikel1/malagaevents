import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import EventCard from '@/components/events/EventCard';
import FilterDrawer, { type EventFilters } from '@/components/events/FilterDrawer';
import EmptyState from '@/components/common/EmptyState';
import { EventListSkeleton } from '@/components/common/LoadingSkeleton';
import type { Event as EventType } from '@/types';

// Mock events for demo
const mockEvents: EventType[] = [
  {
    id: '1',
    title: 'Festival de Música de Málaga',
    description: 'Gran festival de música en el centro histórico',
    category: 'music',
    start_at: new Date().toISOString(),
    venue_name: 'Plaza de la Constitución',
    address: 'Plaza de la Constitución, Málaga',
    is_free: true,
    status: 'published',
    source_type: 'official_feed',
    created_at: new Date().toISOString(),
    image_url: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=400',
    tags: ['música', 'festival', 'verano'],
  },
  {
    id: '2',
    title: 'Exposición Picasso: Orígenes',
    description: 'Exposición temporal en el Museo Picasso',
    category: 'art',
    start_at: new Date(Date.now() + 86400000).toISOString(),
    venue_name: 'Museo Picasso Málaga',
    address: 'Palacio de Buenavista, Málaga',
    is_free: false,
    price_info: '12€ - 18€',
    status: 'published',
    source_type: 'official_feed',
    created_at: new Date().toISOString(),
    image_url: 'https://images.unsplash.com/photo-1578926288207-a90a5366759d?w=400',
    tags: ['arte', 'picasso', 'exposición'],
  },
  {
    id: '3',
    title: 'Teatro: La Casa de Bernarda Alba',
    description: 'Obra clásica de Federico García Lorca',
    category: 'theater',
    start_at: new Date(Date.now() + 172800000).toISOString(),
    venue_name: 'Teatro Cervantes',
    address: 'Calle Ramos Marín, Málaga',
    is_free: false,
    price_info: '15€ - 35€',
    status: 'published',
    source_type: 'official_feed',
    created_at: new Date().toISOString(),
    image_url: 'https://images.unsplash.com/photo-1503095396549-807759245b35?w=400',
    tags: ['teatro', 'lorca', 'clásico'],
  },
  {
    id: '4',
    title: 'Mercado Gastronómico del Puerto',
    description: 'Degustación de productos locales',
    category: 'gastronomy',
    start_at: new Date(Date.now() + 259200000).toISOString(),
    venue_name: 'Muelle Uno',
    address: 'Muelle Uno, Puerto de Málaga',
    is_free: true,
    status: 'published',
    source_type: 'official_feed',
    created_at: new Date().toISOString(),
    image_url: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400',
    tags: ['gastronomía', 'mercado', 'local'],
  },
];

const EventsPage = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState<EventFilters>({ categories: [] });
  const [isLoading] = useState(false);

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
    (filters.dateTo ? 1 : 0);

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
        {isLoading ? (
          <EventListSkeleton count={4} />
        ) : mockEvents.length > 0 ? (
          <div className="space-y-4">
            {mockEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Search}
            title={t('events.noEvents')}
            description={t('events.noEventsDesc')}
            actionLabel={t('events.clearFilters')}
            onAction={() => setFilters({ categories: [] })}
          />
        )}
      </main>

      {/* Filter Drawer */}
      <FilterDrawer
        open={isFilterOpen}
        onOpenChange={setIsFilterOpen}
        filters={filters}
        onApplyFilters={setFilters}
        showFavoritesFilter
      />
    </div>
  );
};

export default EventsPage;

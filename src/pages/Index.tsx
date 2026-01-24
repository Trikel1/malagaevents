import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, Calendar, Pill, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import LanguageSelector from '@/components/common/LanguageSelector';
import CategoryChip from '@/components/events/CategoryChip';
import EventCard from '@/components/events/EventCard';
import EmptyState from '@/components/common/EmptyState';
import { EVENT_CATEGORIES, type Event as EventType } from '@/types';

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
];

const Index = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const quickActions = [
    { icon: Calendar, label: t('common.today'), color: 'bg-primary text-primary-foreground', action: () => navigate('/events?filter=today') },
    { icon: Calendar, label: t('common.thisWeekend'), color: 'bg-secondary text-secondary-foreground', action: () => navigate('/events?filter=weekend') },
    { icon: MapPin, label: t('common.nearby'), color: 'bg-accent text-accent-foreground', action: () => navigate('/events?filter=nearby') },
    { icon: Pill, label: t('home.pharmaciesGuard'), color: 'bg-green-500 text-white', action: () => navigate('/pharmacies') },
  ];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/events?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground p-6 pb-14 rounded-b-3xl">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Málaga Events</h1>
          <LanguageSelector variant="compact" />
        </div>
        
        {/* Search */}
        <form onSubmit={handleSearch} className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder={t('home.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-background text-foreground h-12 rounded-xl border-0 shadow-lg"
          />
        </form>
      </header>

      <main className="px-4 -mt-6 space-y-6">
        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map((action, i) => (
            <Button
              key={i}
              variant="outline"
              onClick={action.action}
              className="h-auto py-4 flex flex-col gap-2 bg-card hover:bg-muted shadow-sm"
            >
              <div className={`p-2 rounded-full ${action.color}`}>
                <action.icon className="h-5 w-5" />
              </div>
              <span className="text-sm font-medium">{action.label}</span>
            </Button>
          ))}
        </div>

        {/* Categories */}
        <section>
          <h2 className="text-lg font-semibold mb-3">{t('home.categories')}</h2>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {EVENT_CATEGORIES.map((cat) => (
              <CategoryChip
                key={cat}
                category={cat}
                size="sm"
                onClick={() => navigate(`/events?category=${cat}`)}
              />
            ))}
          </div>
        </section>

        {/* Today Events */}
        <section>
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-semibold">{t('home.todayEvents')}</h2>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-primary gap-1"
              onClick={() => navigate('/events?filter=today')}
            >
              {t('common.seeAll')}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          
          {mockEvents.length > 0 ? (
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
              {mockEvents.slice(0, 3).map((event) => (
                <div key={event.id} className="min-w-[280px] max-w-[280px]">
                  <EventCard event={event} />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Calendar}
              title={t('events.noEvents')}
              description={t('events.noEventsDesc')}
            />
          )}
        </section>

        {/* Weekend Events */}
        <section>
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-semibold">{t('home.weekendEvents')}</h2>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-primary gap-1"
              onClick={() => navigate('/events?filter=weekend')}
            >
              {t('common.seeAll')}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {mockEvents.slice(1).map((event) => (
              <div key={event.id} className="min-w-[280px] max-w-[280px]">
                <EventCard event={event} />
              </div>
            ))}
          </div>
        </section>

        {/* Nearby - Location CTA */}
        <section className="pb-4">
          <Card className="bg-gradient-to-r from-secondary/10 to-accent/10 border-dashed">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-full bg-secondary/20">
                <MapPin className="h-6 w-6 text-secondary" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium">{t('home.nearbyEvents')}</h3>
                <p className="text-sm text-muted-foreground">{t('home.enableLocationDesc')}</p>
              </div>
              <Button size="sm" variant="secondary">
                {t('home.enableLocation')}
              </Button>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
};

export default Index;

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
import { EventCardSkeleton } from '@/components/common/LoadingSkeleton';
import { useEvents } from '@/hooks/useEvents';
import { useFavorites, useToggleFavorite } from '@/hooks/useFavorites';
import { useAuthContext } from '@/contexts/AuthContext';
import { EVENT_CATEGORIES } from '@/types';

const Index = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const { isAuthenticated } = useAuthContext();

  // Fetch today's events
  const { data: todayEvents, isLoading: loadingToday } = useEvents({ 
    todayOnly: true, 
    limit: 6 
  });

  // Fetch weekend events
  const { data: weekendEvents, isLoading: loadingWeekend } = useEvents({ 
    weekendOnly: true, 
    limit: 6 
  });

  // Favorites
  const { data: favorites } = useFavorites();
  const toggleFavorite = useToggleFavorite();

  const isFavorite = (eventId: string) => 
    favorites?.some((f) => f.event_id === eventId) ?? false;

  const handleToggleFavorite = (eventId: string) => {
    if (!isAuthenticated) {
      navigate('/auth');
      return;
    }
    toggleFavorite.mutate({ eventId, isFavorite: isFavorite(eventId) });
  };

  const quickActions = [
    { icon: Calendar, label: t('common.today'), color: 'bg-primary text-primary-foreground', action: () => navigate('/events?filter=today') },
    { icon: Calendar, label: t('common.thisWeekend'), color: 'bg-secondary text-secondary-foreground', action: () => navigate('/events?filter=weekend') },
    { icon: MapPin, label: t('common.nearby'), color: 'bg-accent text-accent-foreground', action: () => navigate('/events?filter=nearby') },
    { icon: Pill, label: t('pharmacies.short'), color: 'bg-green-500 text-white', action: () => navigate('/pharmacies') },
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
      <header className="bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-800 text-white p-6 pb-14 rounded-b-3xl">
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
        <div className="grid grid-cols-4 gap-4 py-2">
          {quickActions.map((action, i) => (
            <button
              key={i}
              onClick={action.action}
              className="flex flex-col items-center gap-2 group"
            >
              <div className={`p-4 rounded-2xl ${action.color} shadow-lg group-hover:scale-110 group-active:scale-95 transition-transform duration-200`}>
                <action.icon className="h-6 w-6" />
              </div>
              <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors text-center">
                {action.label}
              </span>
            </button>
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
          
          {loadingToday ? (
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
              {[1, 2, 3].map((i) => (
                <div key={i} className="min-w-[280px] max-w-[280px]">
                  <EventCardSkeleton />
                </div>
              ))}
            </div>
          ) : todayEvents && todayEvents.length > 0 ? (
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
              {todayEvents.map((event) => (
                <div key={event.id} className="min-w-[280px] max-w-[280px]">
                  <EventCard 
                    event={event} 
                    isFavorite={isFavorite(event.id)}
                    onToggleFavorite={handleToggleFavorite}
                  />
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
          
          {loadingWeekend ? (
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
              {[1, 2].map((i) => (
                <div key={i} className="min-w-[280px] max-w-[280px]">
                  <EventCardSkeleton />
                </div>
              ))}
            </div>
          ) : weekendEvents && weekendEvents.length > 0 ? (
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
              {weekendEvents.map((event) => (
                <div key={event.id} className="min-w-[280px] max-w-[280px]">
                  <EventCard 
                    event={event}
                    isFavorite={isFavorite(event.id)}
                    onToggleFavorite={handleToggleFavorite}
                  />
                </div>
              ))}
            </div>
          ) : (
            <Card className="bg-muted/50 border-dashed">
              <CardContent className="py-8 text-center text-muted-foreground">
                <Calendar className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">{t('events.noEvents')}</p>
              </CardContent>
            </Card>
          )}
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

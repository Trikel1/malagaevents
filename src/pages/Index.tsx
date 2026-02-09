import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, Calendar, Pill, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import LanguageSelector from '@/components/common/LanguageSelector';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import CategoryChip from '@/components/events/CategoryChip';
import EventCard from '@/components/events/EventCard';
import EmptyState from '@/components/common/EmptyState';
import { EventCardSkeleton } from '@/components/common/LoadingSkeleton';
import { useEvents } from '@/hooks/useEvents';
import { useFavorites, useToggleFavorite } from '@/hooks/useFavorites';
import { useAuthContext } from '@/contexts/AuthContext';
import { EVENT_CATEGORIES } from '@/types';
import SportsContent from '@/components/sports/SportsContent';
import { useAppMode } from '@/contexts/AppModeContext';

const Index = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const { appMode, setAppMode } = useAppMode();
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
    { icon: Calendar, label: t('common.today'), action: () => navigate('/events?filter=today') },
    { icon: Calendar, label: t('common.thisWeekend'), action: () => navigate('/events?filter=weekend') },
    { icon: MapPin, label: t('common.nearby'), action: () => navigate('/events?filter=nearby') },
    { icon: Pill, label: t('pharmacies.short'), action: () => navigate('/pharmacies') },
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
      <header className={cn(
        "text-white p-6 pb-14 rounded-b-3xl bg-gradient-to-br",
        appMode === 'deportes'
          ? 'from-emerald-900 via-green-800 to-teal-700'
          : 'from-slate-900 via-blue-900 to-indigo-800'
      )}>
        <div className="flex justify-between items-center mb-4">
          {/* Segmented Control */}
          <div className="flex bg-white/15 rounded-full p-0.5">
            <button
              onClick={() => setAppMode('eventos')}
              className={cn(
                'px-4 py-1.5 rounded-full text-sm font-semibold transition-all',
                appMode === 'eventos'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-white/80 hover:text-white'
              )}
            >
              {t('sports.events')}
            </button>
            <button
              onClick={() => setAppMode('deportes')}
              className={cn(
                'px-4 py-1.5 rounded-full text-sm font-semibold transition-all',
                appMode === 'deportes'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-white/80 hover:text-white'
              )}
            >
              {t('sports.title')}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <LanguageSelector variant="compact" />
          </div>
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
        {appMode === 'deportes' ? (
          <SportsContent />
        ) : (
          <>
            {/* Quick Actions */}
            <div className="grid grid-cols-4 gap-3 py-2">
              {quickActions.map((action, i) => (
                <button
                  key={i}
                  onClick={action.action}
                  className="flex flex-col items-center gap-2 group"
                >
                  <div className="p-4 rounded-2xl bg-background/40 backdrop-blur-md border border-border/60 shadow-sm hover:shadow-lg hover:bg-accent/10 group-hover:scale-105 group-active:scale-95 transition-all duration-200">
                    <action.icon className="h-6 w-6 text-primary" />
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

            {/* Today Events - 2 column grid */}
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
                <div className="grid grid-cols-2 gap-3">
                  {[1, 2, 3, 4].map((i) => (
                    <EventCardSkeleton key={i} />
                  ))}
                </div>
              ) : todayEvents && todayEvents.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {todayEvents.map((event) => (
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
                  icon={Calendar}
                  title={t('events.noEvents')}
                  description={t('events.noEventsDesc')}
                />
              )}
            </section>

            {/* Weekend Events - 2 column grid */}
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
                <div className="grid grid-cols-2 gap-3">
                  {[1, 2].map((i) => (
                    <EventCardSkeleton key={i} />
                  ))}
                </div>
              ) : weekendEvents && weekendEvents.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {weekendEvents.map((event) => (
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
                <Card className="bg-muted/50 border-dashed">
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <Calendar className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">{t('events.noEvents')}</p>
                  </CardContent>
                </Card>
              )}
            </section>

            {/* Nearby CTA */}
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
          </>
        )}
      </main>
    </div>
  );
};

export default Index;

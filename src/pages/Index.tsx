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
      {/* Hero header — editorial Mediterranean (no overlap) */}
      <header className={cn(
        "relative text-white px-5 pt-5 pb-8 overflow-hidden",
        appMode === 'deportes' ? 'bg-gradient-hero-sports' : 'bg-gradient-hero'
      )}>
        {/* Subtle texture */}
        <div className="absolute inset-0 opacity-[0.08] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 20% 10%, white 1px, transparent 1px), radial-gradient(circle at 80% 60%, white 1px, transparent 1px)', backgroundSize: '40px 40px, 60px 60px' }} />

        {/* Top controls */}
        <div className="relative flex justify-between items-center gap-3 mb-6">
          <div className="flex bg-white/15 backdrop-blur-md rounded-full p-0.5 border border-white/10">
            <button
              onClick={() => setAppMode('eventos')}
              aria-pressed={appMode === 'eventos'}
              className={cn(
                'px-4 py-1.5 rounded-full text-sm font-semibold transition-all min-h-[36px]',
                appMode === 'eventos'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-white/85 hover:text-white'
              )}
            >
              {t('sports.events')}
            </button>
            <button
              onClick={() => setAppMode('deportes')}
              aria-pressed={appMode === 'deportes'}
              className={cn(
                'px-4 py-1.5 rounded-full text-sm font-semibold transition-all min-h-[36px]',
                appMode === 'deportes'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-white/85 hover:text-white'
              )}
            >
              {t('sports.title')}
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="hidden xs:inline-flex items-center gap-1 px-2.5 h-8 rounded-full bg-white/12 backdrop-blur-md border border-white/15 text-[12px] font-medium text-white/90">
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
              Málaga
            </span>
            <ThemeToggle />
            <LanguageSelector variant="compact" />
          </div>
        </div>

        {/* Editorial title */}
        <div className="relative">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/75 font-semibold mb-2">
            {t('home.kicker', 'Agenda de la ciudad')}
          </p>
          <h1 className="text-[26px] sm:text-3xl leading-[1.12] font-bold tracking-tight">
            {t('home.heroTitle', '¿Qué hacemos hoy en Málaga?')}
          </h1>
          <p className="text-sm text-white/85 mt-2 max-w-md">
            {t('home.heroSubtitle', 'Eventos, planes y experiencias cerca de ti.')}
          </p>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="relative mt-5" role="search">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <label htmlFor="home-search" className="sr-only">{t('common.search', 'Buscar')}</label>
          <Input
            id="home-search"
            type="search"
            placeholder={t('home.searchPlaceholder', 'Buscar eventos, lugares…')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-11 bg-card text-foreground h-12 rounded-2xl border-0 shadow-soft focus-visible:ring-2 focus-visible:ring-primary"
          />
        </form>
      </header>

      <main className="px-4 mt-5 space-y-7 pb-6">
        {appMode === 'deportes' ? (
          <SportsContent />
        ) : (
          <>
            {/* Quick Actions - elevated card */}
            <div className="grid grid-cols-4 gap-1 p-3 bg-card rounded-2xl shadow-card border border-border/60">
              {quickActions.map((action, i) => (
                <button
                  key={i}
                  onClick={action.action}
                  className="flex flex-col items-center gap-2 py-2 px-1 group rounded-xl hover:bg-muted/60 active:scale-[0.97] transition-all min-h-[88px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <div className="h-11 w-11 flex items-center justify-center rounded-full bg-primary/10 group-hover:bg-primary/15 transition-colors">
                    <action.icon className="h-5 w-5 text-primary" aria-hidden="true" />
                  </div>
                  <span className="text-xs font-medium text-foreground/85 group-hover:text-foreground transition-colors text-center leading-tight line-clamp-2">
                    {action.label}
                  </span>
                </button>
              ))}
            </div>

            {/* Categories */}
            <section>
              <h2 className="text-lg font-semibold tracking-tight mb-3">{t('home.categories')}</h2>
              <div className="flex gap-2 overflow-x-auto pb-2 px-0.5 -mx-0.5 scrollbar-hide">
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

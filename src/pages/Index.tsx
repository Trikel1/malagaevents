import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Search, Calendar, Pill, ChevronRight, Sparkles, Baby,
  Music, Drama, PartyPopper, Building2, Trees, Users, Ticket, Map as MapIcon,
  Landmark, Trophy, Radar, Heart,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import LanguageSelector from '@/components/common/LanguageSelector';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import EventCard from '@/components/events/EventCard';
import EmptyState from '@/components/common/EmptyState';
import { EventCardSkeleton } from '@/components/common/LoadingSkeleton';
import { useEvents } from '@/hooks/useEvents';
import TwoHoursSheet from '@/components/home/TwoHoursSheet';
import { useFavorites, useToggleFavorite } from '@/hooks/useFavorites';
import { useAuthContext } from '@/contexts/AuthContext';
import SportsContent from '@/components/sports/SportsContent';
import { useAppMode } from '@/contexts/AppModeContext';
import SEO from '@/components/common/SEO';
import { MUNICIPALITIES, VENUE_ZONES } from '@/lib/venuesCatalog';


const DISCOVER_CARDS = [
  { icon: Music, key: 'music', to: '/events?category=music' },
  { icon: Drama, key: 'theater', to: '/events?category=theater' },
  { icon: PartyPopper, key: 'festivals', to: '/events?category=festivals' },
  { icon: Building2, key: 'museums', to: '/events?category=exhibitions' },
  { icon: Ticket, key: 'markets', to: '/events?category=markets' },
  { icon: Trees, key: 'outdoor', to: '/events?filter=outdoor' },
] as const;

const INSTITUTIONAL_CARDS = [
  { icon: Calendar, key: 'agenda' },
  { icon: Baby, key: 'family' },
  { icon: Pill, key: 'pharmacies' },
  { icon: MapIcon, key: 'map' },
  { icon: Landmark, key: 'province' },
  { icon: Trophy, key: 'sportsLayer' },
] as const;

const CULTURE_CARDS = ['theaters', 'festivals', 'halls', 'museums', 'family', 'province'] as const;

const Index = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  
  const { appMode, setAppMode } = useAppMode();
  const { isAuthenticated } = useAuthContext();

  const { data: todayEvents, isLoading: loadingToday } = useEvents({ todayOnly: true, limit: 6 });
  const { data: weekendEvents, isLoading: loadingWeekend } = useEvents({ weekendOnly: true, limit: 6 });

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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/events?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  const goLocality = (name: string) => navigate(`/events?q=${encodeURIComponent(name)}`);

  const QUICK_ACTIONS = [
    { k: 'today', icon: Sparkles, to: '/events?filter=today' },
    { k: 'weekend', icon: Calendar, to: '/events?filter=weekend' },
    { k: 'family', icon: Baby, to: '/events?filter=family' },
    { k: 'pharmacies', icon: Pill, to: '/pharmacies' },
    { k: 'map', icon: MapIcon, to: '/map' },
    { k: 'free', icon: Heart, to: '/events?filter=free' },
  ] as const;

  return (
    <div className="min-h-screen">
      <SEO
        title={t('home.seo.title')}
        description={t('home.seo.description')}
        path="/"
      />

      {/* ============== HERO — sobrio, institucional ============== */}
      <header className={cn(
        'relative text-white px-4 sm:px-6 pt-4 pb-20 overflow-hidden',
        appMode === 'deportes' ? 'bg-gradient-hero-sports' : 'bg-gradient-hero'
      )}>

        {/* Subtle depth layer */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="hero-glow hero-glow--warm -top-32 -left-24 h-80 w-80" />
          <div className="hero-glow hero-glow--cool -bottom-24 -right-20 h-72 w-72" />
        </div>

        {/* Fundido extenso hacia el fondo de la siguiente sección */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent via-background/40 to-background"
        />

        {/* Top controls */}
        <div className="relative flex justify-between items-center gap-2 mb-5 min-w-0">
          <div className="glass-button relative flex p-0.5 min-w-0 shrink text-white overflow-hidden">
            <span
              aria-hidden
              className="absolute top-0.5 bottom-0.5 left-0.5 rounded-full bg-white/95 backdrop-blur-md transition-transform duration-500 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)]"
              style={{
                width: 'calc(50% - 2px)',
                transform: `translateX(${appMode === 'eventos' ? '0%' : '100%'})`,
                boxShadow: '0 4px 14px -8px rgba(15,23,42,0.35)',
              }}
            />
            <button
              onClick={() => setAppMode('eventos')}
              aria-pressed={appMode === 'eventos'}
              className={cn(
                'relative z-[1] px-3 sm:px-4 py-1.5 rounded-full text-[13px] sm:text-sm font-semibold transition-colors duration-300 min-h-[36px] whitespace-nowrap',
                appMode === 'eventos' ? 'text-slate-900' : 'text-white/90 hover:text-white'
              )}
            >
              {t('sports.events')}
            </button>
            <button
              onClick={() => setAppMode('deportes')}
              aria-pressed={appMode === 'deportes'}
              className={cn(
                'relative z-[1] px-3 sm:px-4 py-1.5 rounded-full text-[13px] sm:text-sm font-semibold transition-colors duration-300 min-h-[36px] whitespace-nowrap',
                appMode === 'deportes' ? 'text-slate-900' : 'text-white/90 hover:text-white'
              )}
            >
              {t('sports.title')}
            </button>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <ThemeToggle />
            <LanguageSelector variant="compact" />
          </div>
        </div>

        {/* Título editorial + acceso a búsqueda compacto */}
        <div className="relative flex items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-[26px] sm:text-[38px] leading-[1.08] font-bold tracking-tight max-w-xl">
              {t('home.hero.title')}
            </h1>
            <p className="text-[13.5px] sm:text-sm text-white/85 mt-1.5 max-w-md leading-snug truncate">
              {t('home.hero.subtitle')}
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate('/events')}
            aria-label={t('home.hero.searchAria')}
            title={t('home.hero.searchAria')}
            className="liquid-press glass-button shrink-0 inline-flex items-center gap-2 h-11 min-w-11 px-3 sm:px-4 rounded-full text-white/95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <Search className="h-5 w-5" aria-hidden="true" />
            <span className="hidden sm:inline text-sm font-semibold">{t('home.hero.searchLabel', 'Buscar')}</span>
          </button>
        </div>
      </header>



      <main className="px-4 sm:px-6 -mt-14 space-y-6 pb-8 relative z-10 max-w-6xl mx-auto">
        {appMode === 'deportes' ? (
          <div className="pt-6"><SportsContent /></div>
        ) : (
          <>
            {/* ============== QUICK ACTIONS visible desde primer pantallazo ============== */}
            <section aria-label={t('home.quickActions.aria')} className="glass-panel p-4 sm:p-5">
              <div className="grid grid-cols-3 gap-2">
                {QUICK_ACTIONS.map((qa) => (
                  <button
                    key={qa.k}
                    onClick={() => navigate(qa.to)}
                    className="liquid-press flex flex-col items-center justify-center gap-1.5 rounded-2xl py-3 px-2 bg-background/40 hover:bg-primary/10 transition-colors border border-border/40 min-h-[76px]"
                  >
                    <qa.icon className="h-5 w-5 text-primary" aria-hidden />
                    <span className="text-[12px] font-semibold text-foreground leading-tight text-center">{t(`home.quickActions.${qa.k}`)}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* ============== TENGO DOS HORAS — módulo de descubrimiento ciudadano ============== */}
            <TwoHoursSheet />

            {/* ============== Bloque INFANTIL / FAMILIAR ============== */}
            <section className="glass-panel p-5 sm:p-6 animate-fade-in">
              <div className="flex items-start gap-3 mb-4">
                <div className="h-11 w-11 shrink-0 rounded-2xl bg-primary/15 flex items-center justify-center">
                  <Baby className="h-5 w-5 text-primary" aria-hidden />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg sm:text-xl font-bold tracking-tight">{t('home.family.title')}</h2>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                    {t('home.family.subtitle')}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                {[
                  { k: 'kids', to: '/events?filter=family' },
                  { k: 'age0_3', to: '/events?filter=family&age=0-3' },
                  { k: 'age4_8', to: '/events?filter=family&age=4-8' },
                  { k: 'age9_12', to: '/events?filter=family&age=9-12' },
                  { k: 'free', to: '/events?filter=free' },
                  { k: 'weekend', to: '/events?filter=weekend' },
                ].map((c) => (
                  <button
                    key={c.k}
                    onClick={() => navigate(c.to)}
                    className="glass-chip liquid-press px-4 py-2 text-sm font-medium hover:bg-primary/10"
                  >
                    {t(`home.family.chips.${c.k}`)}
                  </button>
                ))}
              </div>

              <Button onClick={() => navigate('/events?filter=family')} className="liquid-press h-11 px-5 font-semibold">
                {t('home.family.cta')}
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </section>

            {/* ============== Ahora en Málaga (Hoy) ============== */}
            <section>
              <div className="flex items-end justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <h2 className="section-title">{t('home.sections.nowInMalaga')}</h2>
                  <div className="section-rule mt-2" aria-hidden />
                </div>
                <Button variant="ghost" size="sm" className="text-primary gap-1 hover:underline underline-offset-4 shrink-0" onClick={() => navigate('/events?filter=today')}>
                  {t('home.sections.viewAll')} <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {loadingToday ? (
                <div className="grid grid-cols-2 gap-3">
                  {[1,2,3,4].map((i) => <EventCardSkeleton key={i} />)}
                </div>
              ) : todayEvents && todayEvents.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {todayEvents.map((event, idx) => (
                    <EventCard key={event.id} event={event} dense priority={idx < 2}
                      isFavorite={isFavorite(event.id)} onToggleFavorite={handleToggleFavorite} />
                  ))}
                </div>
              ) : (
                <EmptyState icon={Calendar} title={t('events.noEvents')} description={t('events.noEventsDesc')} />
              )}
            </section>

            {/* ============== Qué puedes encontrar ============== */}
            <section>
              <h2 className="section-title mb-3">{t('home.sections.whatYouFind')}</h2>
              <div className="section-rule mb-3" aria-hidden />

              <div className="grid grid-cols-2 gap-3">
                {DISCOVER_CARDS.map((card) => (
                  <button
                    key={card.key}
                    onClick={() => navigate(card.to)}
                    className="glass-card liquid-hover liquid-press text-left p-4 min-h-[108px] flex flex-col gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                      <card.icon className="h-5 w-5 text-primary" aria-hidden />
                    </div>
                    <div>
                      <div className="font-semibold text-sm leading-tight">{t(`home.discover.${card.key}.label`)}</div>
                      <div className="text-[12px] text-muted-foreground leading-snug mt-1 line-clamp-2">{t(`home.discover.${card.key}.copy`)}</div>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            {/* ============== Este finde ============== */}
            <section>
              <div className="flex items-end justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <h2 className="section-title">{t('home.sections.thisWeekend')}</h2>
                  <div className="section-rule mt-2" aria-hidden />
                </div>
                <Button variant="ghost" size="sm" className="text-primary gap-1 hover:underline underline-offset-4 shrink-0" onClick={() => navigate('/events?filter=weekend')}>
                  {t('home.sections.viewAll')} <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {loadingWeekend ? (
                <div className="grid grid-cols-2 gap-3">
                  {[1,2].map((i) => <EventCardSkeleton key={i} />)}
                </div>
              ) : weekendEvents && weekendEvents.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {weekendEvents.map((event) => (
                    <EventCard key={event.id} event={event} dense
                      isFavorite={isFavorite(event.id)} onToggleFavorite={handleToggleFavorite} />
                  ))}
                </div>
              ) : (
                <div className="glass-card p-6 text-center text-muted-foreground">
                  <Calendar className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">{t('events.noEvents')}</p>
                </div>
              )}
            </section>

            {/* ============== Málaga ciudad y provincia — agrupado por zona ============== */}
            <section className="glass-panel p-5 sm:p-6">
              <div className="flex items-start gap-3 mb-4">
                <div className="h-11 w-11 shrink-0 rounded-2xl bg-secondary/15 flex items-center justify-center">
                  <Landmark className="h-5 w-5 text-secondary" aria-hidden />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg sm:text-xl font-bold tracking-tight">{t('home.cityProvince.title')}</h2>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                    {t('home.cityProvince.subtitle')}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {VENUE_ZONES.map((zone) => {
                  const items = MUNICIPALITIES.filter((m) => m.zone === zone.id);
                  if (items.length === 0) return null;
                  return (
                    <div key={zone.id}>
                      <p className="text-[11px] uppercase tracking-[0.18em] font-semibold text-muted-foreground mb-2">
                        {zone.label}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {items.map((loc) => (
                          <button
                            key={loc.name}
                            onClick={() => goLocality(loc.name)}
                            className="glass-chip liquid-press px-3.5 py-1.5 text-sm font-medium hover:bg-secondary/10"
                          >
                            {loc.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* ============== Cultura viva ============== */}
            <section>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-accent" aria-hidden />
                <h2 className="section-title">{t('home.culture.title')}</h2>
              </div>
              <div className="section-rule mb-3" aria-hidden />

              <p className="text-sm text-muted-foreground mb-4 leading-relaxed">

                {t('home.culture.subtitle')}
              </p>
              <div className="grid grid-cols-2 gap-3">
                {CULTURE_CARDS.map((k) => (
                  <div key={k} className="glass-card p-4">
                    <div className="font-semibold text-sm">{t(`home.culture.${k}.label`)}</div>
                    <div className="text-[12px] text-muted-foreground mt-1 leading-snug">{t(`home.culture.${k}.copy`)}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* ============== Deportes teaser ============== */}
            <section className="glass-card-strong p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <div className="h-11 w-11 shrink-0 rounded-2xl bg-emerald-500/15 flex items-center justify-center">
                  <Trophy className="h-5 w-5 text-emerald-600" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-bold tracking-tight">{t('home.sports.title')}</h2>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                    {t('home.sports.subtitle')}
                  </p>
                  <Button
                    onClick={() => setAppMode('deportes')}
                    className="mt-4 liquid-press h-10 px-4 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {t('home.sports.cta')} <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </section>

            {/* ============== Bloque institucional — Una plataforma viva para Málaga ============== */}
            <section className="glass-panel p-5 sm:p-7">
              <div className="text-center mb-5">
                <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-primary font-semibold mb-2">
                  <Radar className="h-3.5 w-3.5" aria-hidden />
                  {t('home.institutional.eyebrow')}
                </div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight">{t('home.institutional.title')}</h2>
                <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto leading-relaxed">
                  {t('home.institutional.subtitle')}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {INSTITUTIONAL_CARDS.map((c) => (
                  <div key={c.key} className="glass-card p-4 flex flex-col gap-2">
                    <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                      <c.icon className="h-5 w-5 text-primary" aria-hidden />
                    </div>
                    <div>
                      <div className="font-semibold text-sm leading-tight">{t(`home.institutional.${c.key}.label`)}</div>
                      <div className="text-[12px] text-muted-foreground leading-snug mt-1">{t(`home.institutional.${c.key}.copy`)}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Coverage stats — read-only aspirational counts */}
              <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
                {[
                  { n: '35+', l: t('home.stats.venues') },
                  { n: '24', l: t('home.stats.municipalities') },
                  { n: '70+', l: t('home.stats.sources') },
                  { n: t('home.stats.dailyValue'), l: t('home.stats.pharmaciesDaily') },
                  { n: t('home.stats.familyValue'), l: t('home.stats.familyByAge') },
                  { n: t('home.stats.sportsValue'), l: t('home.stats.sportsGrowing') },
                ].map((s) => (
                  <div key={s.l} className="tile-quiet px-2 py-3 text-center">
                    <div className="text-lg sm:text-xl font-bold tracking-tight text-primary tabular-nums">{s.n}</div>
                    <div className="text-[11px] sm:text-xs font-medium text-muted-foreground leading-tight mt-1">{s.l}</div>
                  </div>

                ))}

              </div>
              <p className="mt-3 text-center text-[11px] text-muted-foreground italic">
                {t('home.stats.footer')}
              </p>
            </section>


            {/* ============== Final CTA ============== */}
            <section className="glass-card-strong p-6 sm:p-8 text-center">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-sunset text-white mb-3 shadow-lift">
                <Users className="h-6 w-6" aria-hidden />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight">{t('home.finalCta.title')}</h2>
              <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto leading-relaxed">
                {t('home.finalCta.subtitle')}
              </p>
              <div className="flex flex-wrap justify-center gap-2 mt-5">
                <Button onClick={() => navigate('/events')} className="liquid-press h-11 px-5 font-semibold">
                  {t('home.finalCta.exploreEvents')}
                </Button>
                <Button onClick={() => navigate('/pharmacies')} variant="outline" className="liquid-press h-11 px-5 font-semibold glass-button border-primary/20">
                  <Pill className="h-4 w-4 mr-1.5" />
                  {t('home.finalCta.pharmacies')}
                </Button>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
};

export default Index;

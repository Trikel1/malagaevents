import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Calendar, Pill, ChevronRight, Sparkles, Baby,
  Music, Drama, PartyPopper, Building2, Trees, Users, Ticket,
  Landmark, Trophy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFavorites, useToggleFavorite } from '@/hooks/useFavorites';
import { useAuthContext } from '@/contexts/AuthContext';
import { useEvents } from '@/hooks/useEvents';
import SportsContent from '@/components/sports/SportsContent';
import { useAppMode } from '@/contexts/AppModeContext';
import SEO from '@/components/common/SEO';
import { MUNICIPALITIES, VENUE_ZONES } from '@/lib/venuesCatalog';
import HeroHeader from '@/components/home/HeroHeader';
import QuickActionsGrid from '@/components/home/QuickActionsGrid';
import EventRail from '@/components/home/EventRail';
import InstitutionalStrip from '@/components/home/InstitutionalStrip';

const DISCOVER_CARDS = [
  { icon: Music, key: 'music', to: '/events?category=music' },
  { icon: Drama, key: 'theater', to: '/events?category=theater' },
  { icon: PartyPopper, key: 'festivals', to: '/events?category=festivals' },
  { icon: Building2, key: 'museums', to: '/events?category=exhibitions' },
  { icon: Ticket, key: 'markets', to: '/events?category=markets' },
  { icon: Trees, key: 'outdoor', to: '/events?filter=outdoor' },
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

  const isFavorite = (eventId: string) => favorites?.some((f) => f.event_id === eventId) ?? false;

  const handleToggleFavorite = (eventId: string) => {
    if (!isAuthenticated) {
      navigate('/auth');
      return;
    }
    toggleFavorite.mutate({ eventId, isFavorite: isFavorite(eventId) });
  };

  const goLocality = (name: string) => navigate(`/events?q=${encodeURIComponent(name)}`);

  return (
    <div className="min-h-screen">
      <SEO title={t('home.seo.title')} description={t('home.seo.description')} path="/" />

      {/* Hero — full width, contenedor centrado dentro */}
      <HeroHeader />

      <div className="mx-auto w-full max-w-[1180px] px-4 lg:px-8 -mt-9 relative z-10 space-y-8 pb-8">
        {appMode === 'deportes' ? (
          <div className="pt-6"><SportsContent /></div>
        ) : (
          <>
            {/* Quick actions — 3x2 móvil, 1x6 desktop */}
            <QuickActionsGrid />

            {/* Ahora en Málaga */}
            <EventRail
              title={t('home.sections.nowInMalaga')}
              events={todayEvents}
              isLoading={loadingToday}
              viewAllTo="/events?filter=today"
              isFavorite={isFavorite}
              onToggleFavorite={handleToggleFavorite}
              priorityFirst
            />

            {/* Este fin de semana */}
            <EventRail
              title={t('home.sections.thisWeekend')}
              events={weekendEvents}
              isLoading={loadingWeekend}
              viewAllTo="/events?filter=weekend"
              isFavorite={isFavorite}
              onToggleFavorite={handleToggleFavorite}
            />

            {/* Familia */}
            <section className="rounded-2xl bg-card border border-border shadow-soft p-5 sm:p-6">
              <div className="flex items-start gap-3 mb-4">
                <div className="h-11 w-11 shrink-0 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Baby className="h-5 w-5 text-primary" aria-hidden />
                </div>
                <div className="min-w-0">
                  <h2 className="font-display text-lg sm:text-xl font-semibold tracking-tight">{t('home.family.title')}</h2>
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
                    className="px-4 min-h-[44px] rounded-full border border-border bg-muted/50 text-sm font-medium hover:bg-primary/10 hover:border-primary/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {t(`home.family.chips.${c.k}`)}
                  </button>
                ))}
              </div>

              <Button onClick={() => navigate('/events?filter=family')} className="min-h-[44px] px-5 font-semibold">
                {t('home.family.cta')}
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </section>

            {/* Qué puedes encontrar */}
            <section>
              <h2 className="font-display text-xl lg:text-2xl font-semibold tracking-tight mb-3 px-1">
                {t('home.sections.whatYouFind')}
              </h2>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {DISCOVER_CARDS.map((card) => (
                  <button
                    key={card.key}
                    onClick={() => navigate(card.to)}
                    className="text-left p-4 min-h-[108px] flex flex-col gap-2 rounded-xl bg-card border border-border shadow-soft hover:shadow-card hover:border-primary/40 transition-[transform,box-shadow,border-color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
                  >
                    <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                      <card.icon className="h-4 w-4 text-primary" aria-hidden />
                    </div>
                    <div>
                      <div className="font-semibold text-sm leading-tight text-foreground">{t(`home.discover.${card.key}.label`)}</div>
                      <div className="text-[12px] text-muted-foreground leading-snug mt-1 line-clamp-2">{t(`home.discover.${card.key}.copy`)}</div>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            {/* Málaga ciudad y provincia */}
            <section className="rounded-2xl bg-card border border-border shadow-soft p-5 sm:p-6">
              <div className="flex items-start gap-3 mb-4">
                <div className="h-11 w-11 shrink-0 rounded-2xl bg-secondary/15 flex items-center justify-center">
                  <Landmark className="h-5 w-5 text-secondary" aria-hidden />
                </div>
                <div className="min-w-0">
                  <h2 className="font-display text-lg sm:text-xl font-semibold tracking-tight">{t('home.cityProvince.title')}</h2>
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
                            className="px-4 min-h-[44px] rounded-full border border-border bg-muted/40 text-sm font-medium hover:bg-secondary/10 hover:border-secondary/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

            {/* Cultura viva */}
            <section>
              <div className="flex items-center gap-2 mb-3 px-1">
                <Sparkles className="h-4 w-4 text-accent" aria-hidden />
                <h2 className="font-display text-xl lg:text-2xl font-semibold tracking-tight">{t('home.culture.title')}</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-4 px-1 leading-relaxed">
                {t('home.culture.subtitle')}
              </p>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {CULTURE_CARDS.map((k) => (
                  <div key={k} className="rounded-xl bg-card border border-border shadow-soft p-4">
                    <div className="font-semibold text-sm text-foreground">{t(`home.culture.${k}.label`)}</div>
                    <div className="text-[12px] text-muted-foreground mt-1 leading-snug">{t(`home.culture.${k}.copy`)}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* Deportes teaser */}
            <section className="rounded-2xl bg-card border border-border shadow-card p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <div className="h-11 w-11 shrink-0 rounded-2xl bg-emerald-500/15 flex items-center justify-center">
                  <Trophy className="h-5 w-5 text-emerald-600 dark:text-emerald-400" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-lg font-semibold tracking-tight">{t('home.sports.title')}</h2>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                    {t('home.sports.subtitle')}
                  </p>
                  <Button
                    onClick={() => setAppMode('deportes')}
                    className="mt-4 min-h-[44px] px-4 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {t('home.sports.cta')} <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </section>

            {/* Bloque institucional — compacto, al final */}
            <InstitutionalStrip />

            {/* Final CTA */}
            <section className="rounded-2xl bg-card border border-border shadow-card p-6 sm:p-8 text-center">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-sunset text-white mb-3 shadow-lift">
                <Users className="h-6 w-6" aria-hidden />
              </div>
              <h2 className="font-display text-xl sm:text-2xl font-semibold tracking-tight">{t('home.finalCta.title')}</h2>
              <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto leading-relaxed">
                {t('home.finalCta.subtitle')}
              </p>
              <div className="flex flex-wrap justify-center gap-2 mt-5">
                <Button onClick={() => navigate('/events')} className="min-h-[44px] px-5 font-semibold">
                  {t('home.finalCta.exploreEvents')}
                </Button>
                <Button onClick={() => navigate('/pharmacies')} variant="outline" className="min-h-[44px] px-5 font-semibold">
                  <Pill className="h-4 w-4 mr-1.5" />
                  {t('home.finalCta.pharmacies')}
                </Button>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
};

export default Index;

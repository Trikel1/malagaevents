import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Search, MapPin, Calendar, Pill, ChevronRight, Sparkles, Baby,
  Music, Drama, PartyPopper, Building2, Trees, Users, Ticket, Map as MapIcon,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
import SEO from '@/components/common/SEO';

const LOCALITIES = [
  'Málaga', 'Fuengirola', 'Marbella', 'Torremolinos', 'Benalmádena',
  'Vélez-Málaga', 'Rincón de la Victoria', 'Estepona', 'Mijas', 'Nerja',
  'Antequera', 'Ronda',
];

const DISCOVER_CARDS = [
  { icon: Music, key: 'music', label: 'Conciertos', copy: 'Salas, festivales y música en vivo.', to: '/events?category=music' },
  { icon: Drama, key: 'theater', label: 'Teatro', copy: 'Cervantes, Soho y más escenarios.', to: '/events?category=theater' },
  { icon: PartyPopper, key: 'festivals', label: 'Festivales', copy: 'Grandes citas de la ciudad.', to: '/events?category=festivals' },
  { icon: Building2, key: 'museums', label: 'Museos y exposiciones', copy: 'Arte, historia y descubrimientos.', to: '/events?category=exhibitions' },
  { icon: Baby, key: 'family', label: 'Infantil / Familiar', copy: 'Planes pensados para niñas y niños.', to: '/events?filter=family' },
  { icon: Ticket, key: 'markets', label: 'Ferias y mercados', copy: 'Mercadillos, artesanía y sabores.', to: '/events?category=markets' },
  { icon: Trees, key: 'outdoor', label: 'Al aire libre', copy: 'Parques, playas y actividades outdoor.', to: '/events?filter=outdoor' },
  { icon: MapIcon, key: 'near', label: 'Cerca de mí', copy: 'Descubre qué pasa a tu alrededor.', to: '/events?filter=nearby' },
];

const CULTURA_CARDS = [
  { label: 'Teatros', copy: 'Programación de las principales salas.' },
  { label: 'Festivales', copy: 'Grandes citas del calendario cultural.' },
  { label: 'Salas de conciertos', copy: 'Directos, clubs y música en vivo.' },
  { label: 'Museos', copy: 'Colecciones y exposiciones temporales.' },
  { label: 'Programación familiar', copy: 'Talleres y espectáculos para todas las edades.' },
  { label: 'Provincia', copy: 'Municipios más allá de la capital.' },
];

const FLOATING_TAGS = ['Hoy', 'Este finde', 'Infantil', 'Conciertos', 'Gratis', 'Cerca de mí'];

const Index = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
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

  return (
    <div className="min-h-screen bg-gradient-warm">
      <SEO
        title="Agenda de Málaga — Eventos, Deportes y Planes"
        description="Descubre eventos, planes culturales, deportes y farmacias de guardia en Málaga ciudad y provincia. Tu agenda completa, actualizada cada día."
        path="/"
      />

      {/* ============== HERO — Liquid Glass ============== */}
      <header className={cn(
        "relative text-white px-4 pt-5 pb-16 overflow-hidden",
        appMode === 'deportes' ? 'bg-gradient-hero-sports' : 'bg-gradient-hero'
      )}>
        {/* Translucent blobs for depth */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 -left-16 h-72 w-72 rounded-full bg-white/25 blur-3xl" />
          <div className="absolute top-24 -right-20 h-80 w-80 rounded-full bg-accent/30 blur-3xl" />
          <div className="absolute bottom-0 left-1/4 h-64 w-64 rounded-full bg-secondary/25 blur-3xl" />
        </div>

        {/* Top controls */}
        <div className="relative flex justify-between items-center gap-2 mb-8 min-w-0">
          <div className="glass-button flex p-0.5 min-w-0 shrink text-white">
            <button
              onClick={() => setAppMode('eventos')}
              aria-pressed={appMode === 'eventos'}
              className={cn(
                'px-3 sm:px-4 py-1.5 rounded-full text-[13px] sm:text-sm font-semibold transition-all min-h-[36px] whitespace-nowrap',
                appMode === 'eventos' ? 'bg-white text-slate-900 shadow-sm' : 'text-white/90 hover:text-white'
              )}
            >
              {t('sports.events')}
            </button>
            <button
              onClick={() => setAppMode('deportes')}
              aria-pressed={appMode === 'deportes'}
              className={cn(
                'px-3 sm:px-4 py-1.5 rounded-full text-[13px] sm:text-sm font-semibold transition-all min-h-[36px] whitespace-nowrap',
                appMode === 'deportes' ? 'bg-white text-slate-900 shadow-sm' : 'text-white/90 hover:text-white'
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

        {/* Editorial title */}
        <div className="relative">
          <p className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-white/95 font-semibold mb-3">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Málaga Connect
          </p>
          <h1 className="text-[30px] sm:text-4xl leading-[1.08] font-bold tracking-tight max-w-xl">
            Descubre qué hacer hoy en Málaga
          </h1>
          <p className="text-[15px] sm:text-base text-white/95 mt-3 max-w-md leading-relaxed">
            Eventos, planes familiares, cultura, conciertos, teatros, festivales, farmacias y deporte en una sola app para Málaga ciudad y provincia.
          </p>
        </div>

        {/* Search - glass */}
        <form onSubmit={handleSearch} className="relative mt-5" role="search">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground z-10" aria-hidden="true" />
          <label htmlFor="home-search" className="sr-only">Buscar</label>
          <Input
            id="home-search"
            type="search"
            placeholder="Buscar concierto, teatro, niños, museo…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="glass-input pl-12 h-14 text-foreground border-0 focus-visible:ring-2 focus-visible:ring-white/60 placeholder:text-muted-foreground"
          />
        </form>

        {/* CTAs */}
        {appMode === 'eventos' && (
          <div className="relative mt-4 flex flex-wrap gap-2">
            <Button
              onClick={() => navigate('/events')}
              className="glass-button liquid-press bg-white text-slate-900 hover:bg-white/95 border-0 h-11 px-5 font-semibold"
            >
              Explorar eventos
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
            <Button
              onClick={() => navigate('/events?filter=family')}
              className="glass-button liquid-press bg-white/15 hover:bg-white/25 text-white border-white/30 h-11 px-5 font-semibold"
            >
              <Baby className="h-4 w-4 mr-1.5" />
              Planes infantiles
            </Button>
            <Button
              onClick={() => navigate('/map')}
              className="glass-button liquid-press bg-white/15 hover:bg-white/25 text-white border-white/30 h-11 px-5 font-semibold"
            >
              <MapIcon className="h-4 w-4 mr-1.5" />
              Ver mapa
            </Button>
          </div>
        )}

        {/* Floating tag pills */}
        {appMode === 'eventos' && (
          <div className="relative mt-6 flex flex-wrap gap-2">
            {FLOATING_TAGS.map((tag) => (
              <button
                key={tag}
                onClick={() => navigate(`/events?q=${encodeURIComponent(tag)}`)}
                className="glass-chip liquid-press text-xs sm:text-sm font-medium text-white px-3.5 py-1.5 border-white/25 bg-white/15 hover:bg-white/25"
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </header>

      <main className="px-4 -mt-10 space-y-8 pb-8 relative z-10">
        {appMode === 'deportes' ? (
          <div className="pt-6"><SportsContent /></div>
        ) : (
          <>
            {/* ============== Bloque INFANTIL / FAMILIAR (prioritario) ============== */}
            <section className="glass-panel p-5 sm:p-6 animate-fade-in">
              <div className="flex items-start gap-3 mb-4">
                <div className="h-11 w-11 shrink-0 rounded-2xl bg-primary/15 flex items-center justify-center">
                  <Baby className="h-5 w-5 text-primary" aria-hidden />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg sm:text-xl font-bold tracking-tight">Planes infantiles y familiares</h2>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                    Encuentra actividades para niños, talleres, teatro familiar, museos, planes gratuitos y eventos para este fin de semana.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                {[
                  { label: 'Infantil', to: '/events?filter=family' },
                  { label: 'Familiar', to: '/events?filter=family' },
                  { label: '0–3 años', to: '/events?filter=family&age=0-3' },
                  { label: '4–8 años', to: '/events?filter=family&age=4-8' },
                  { label: '9–12 años', to: '/events?filter=family&age=9-12' },
                  { label: 'Gratis', to: '/events?filter=free' },
                  { label: 'Este finde', to: '/events?filter=weekend' },
                  { label: 'Al aire libre', to: '/events?filter=outdoor' },
                ].map((c) => (
                  <button
                    key={c.label}
                    onClick={() => navigate(c.to)}
                    className="glass-chip liquid-press px-4 py-2 text-sm font-medium hover:bg-primary/10"
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              <Button
                onClick={() => navigate('/events?filter=family')}
                className="liquid-press h-11 px-5 font-semibold"
              >
                Ver planes para niños
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </section>

            {/* ============== Qué puedes encontrar ============== */}
            <section>
              <h2 className="text-lg font-bold tracking-tight mb-3 px-1">Qué puedes encontrar</h2>
              <div className="grid grid-cols-2 gap-3">
                {DISCOVER_CARDS.map((card) => (
                  <button
                    key={card.key}
                    onClick={() => navigate(card.to)}
                    className="glass-card liquid-hover liquid-press text-left p-4 min-h-[112px] flex flex-col gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <div className="h-9 w-9 rounded-xl bg-gradient-sunset/10 bg-primary/10 flex items-center justify-center">
                      <card.icon className="h-4.5 w-4.5 text-primary" aria-hidden />
                    </div>
                    <div>
                      <div className="font-semibold text-sm leading-tight">{card.label}</div>
                      <div className="text-[12px] text-muted-foreground leading-snug mt-1 line-clamp-2">{card.copy}</div>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            {/* ============== Categorías generales ============== */}
            <section>
              <h2 className="text-lg font-bold tracking-tight mb-3 px-1">Categorías</h2>
              <div className="flex gap-2 overflow-x-auto liquid-scroll pb-2 px-0.5 -mx-0.5">
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

            {/* ============== Today Events ============== */}
            <section>
              <div className="flex justify-between items-center mb-3 px-1">
                <h2 className="text-lg font-bold tracking-tight">{t('home.todayEvents', 'Hoy en Málaga')}</h2>
                <Button variant="ghost" size="sm" className="text-primary gap-1" onClick={() => navigate('/events?filter=today')}>
                  {t('common.seeAll', 'Ver todo')}
                  <ChevronRight className="h-4 w-4" />
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

            {/* ============== Weekend ============== */}
            <section>
              <div className="flex justify-between items-center mb-3 px-1">
                <h2 className="text-lg font-bold tracking-tight">{t('home.weekendEvents', 'Este finde')}</h2>
                <Button variant="ghost" size="sm" className="text-primary gap-1" onClick={() => navigate('/events?filter=weekend')}>
                  {t('common.seeAll', 'Ver todo')}
                  <ChevronRight className="h-4 w-4" />
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

            {/* ============== Málaga ciudad y provincia ============== */}
            <section className="glass-panel p-5 sm:p-6">
              <div className="flex items-start gap-3 mb-4">
                <div className="h-11 w-11 shrink-0 rounded-2xl bg-secondary/15 flex items-center justify-center">
                  <MapPin className="h-5 w-5 text-secondary" aria-hidden />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-bold tracking-tight">Málaga ciudad y provincia</h2>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                    Explora planes en Málaga capital y en los principales municipios de la provincia.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {LOCALITIES.map((loc) => (
                  <button
                    key={loc}
                    onClick={() => goLocality(loc)}
                    className="glass-chip liquid-press px-3.5 py-1.5 text-sm font-medium hover:bg-secondary/10"
                  >
                    {loc}
                  </button>
                ))}
              </div>
            </section>

            {/* ============== Cultura viva ============== */}
            <section>
              <div className="flex items-center gap-2 mb-3 px-1">
                <Sparkles className="h-4 w-4 text-accent" aria-hidden />
                <h2 className="text-lg font-bold tracking-tight">Cultura viva</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-4 px-1 leading-relaxed">
                Estamos ampliando fuentes culturales, teatros, festivales, salas y programación familiar para ofrecer una agenda cada vez más completa.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {CULTURA_CARDS.map((c) => (
                  <div key={c.label} className="glass-card p-4">
                    <div className="font-semibold text-sm">{c.label}</div>
                    <div className="text-[12px] text-muted-foreground mt-1 leading-snug">{c.copy}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* ============== Final CTA ============== */}
            <section className="glass-card-strong p-6 sm:p-8 text-center">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-sunset text-white mb-3 shadow-lift">
                <Users className="h-6 w-6" aria-hidden />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Una guía viva para Málaga</h2>
              <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto leading-relaxed">
                Una forma más clara, rápida y bonita de descubrir qué ocurre cerca de ti.
              </p>
              <div className="flex flex-wrap justify-center gap-2 mt-5">
                <Button onClick={() => navigate('/events')} className="liquid-press h-11 px-5 font-semibold">
                  Explorar eventos
                </Button>
                <Button onClick={() => navigate('/events?filter=family')} variant="outline" className="liquid-press h-11 px-5 font-semibold glass-button border-primary/20">
                  <Baby className="h-4 w-4 mr-1.5" />
                  Ver planes infantiles
                </Button>
              </div>
            </section>

            {/* Pharmacy shortcut */}
            <section>
              <button
                onClick={() => navigate('/pharmacies')}
                className="glass-card liquid-hover liquid-press w-full p-4 flex items-center gap-4 text-left"
              >
                <div className="h-11 w-11 rounded-2xl bg-accent/15 flex items-center justify-center">
                  <Pill className="h-5 w-5 text-accent" aria-hidden />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">Farmacias de guardia</div>
                  <div className="text-[12px] text-muted-foreground">Encuentra tu farmacia abierta ahora mismo.</div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            </section>
          </>
        )}
      </main>
    </div>
  );
};

export default Index;

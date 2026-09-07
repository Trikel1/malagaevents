
import { lazy, Suspense, useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Search, Calendar, Pill, ChevronRight, Sparkles, Baby,
  Music, Drama, PartyPopper, Building2, Trees, Users, Ticket, Map as MapIcon,
  Landmark, Trophy, Radar, Heart, X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import LanguageSelector from '@/components/common/LanguageSelector';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import EventCard from '@/components/events/EventCard';

import { EventCardSkeleton } from '@/components/common/LoadingSkeleton';
import { useEvents } from '@/hooks/useEvents';
import { useFavorites, useToggleFavorite } from '@/hooks/useFavorites';
import { useAuthContext } from '@/contexts/AuthContext';
import { useAppMode } from '@/contexts/AppModeContext';
import SEO from '@/components/common/SEO';
import { MUNICIPALITIES, VENUE_ZONES } from '@/lib/venuesCatalog';

const SportsContent = lazy(() => import('@/components/sports/SportsContent'));



const FeaturedEvent = lazy(() => import('@/components/home/FeaturedEvent'));
const ForYouSection = lazy(() => import('@/components/home/ForYouSection'));
const TwoHoursSheet = lazy(() => import('@/components/home/TwoHoursSheet'));


const Index = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const { appMode, setAppMode } = useAppMode();
  const { isAuthenticated } = useAuthContext();

  // `/sports` is the shareable address of the sports section: opening it (or
  // coming back to it from a detail page) must land in Deportes.
  useEffect(() => {
    if (pathname === '/sports' && appMode !== 'deportes') setAppMode('deportes');
  }, [pathname, appMode, setAppMode]);

  const switchMode = (mode: 'eventos' | 'deportes') => {
    setAppMode(mode);
    const target = mode === 'deportes' ? '/sports' : '/';
    if (pathname !== target) navigate(target);
  };


  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchToggleRef = useRef<HTMLButtonElement>(null);
  const searchPanelRef = useRef<HTMLDivElement>(null);

  // The panel is only CSS-collapsed, so its controls stay in the tab order and
  // keyboard users land on an invisible field. Keep them out of the tree until
  // the panel is actually open.
  useEffect(() => {
    const el = searchPanelRef.current;
    if (el) (el as HTMLDivElement & { inert?: boolean }).inert = !searchOpen;
  }, [searchOpen]);

  const closeSearch = () => {
    setSearchOpen(false);
    searchToggleRef.current?.focus();
  };

  useEffect(() => {
    if (searchOpen) {
      // focus on next tick so the slide-down transition has started
      const id = window.setTimeout(() => searchInputRef.current?.focus(), 50);
      return () => window.clearTimeout(id);
    }
  }, [searchOpen]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    navigate(`/events?q=${encodeURIComponent(q)}`);
    setSearchOpen(false);
  };

  const { data: weekendEvents, isLoading: loadingWeekend, isError: weekendError, refetch: refetchWeekend } = useEvents({
    weekendOnly: true,
    limit: 6,
    // Deportes has its own data source and landing; avoid fetching cultural
    // events while that mode is active.
    enabled: appMode === 'eventos',
  });

  // The featured block already shows one event; drop it from the weekend grid
  // so the same plan never appears twice on the first screen.
  const [featuredId, setFeaturedId] = useState<string | null>(null);
  const weekendList = (weekendEvents ?? []).filter((e) => e.id !== featuredId);

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



  const goLocality = (name: string) => navigate(`/events?q=${encodeURIComponent(name)}`);

  // Capital vs. province: an explicit, keyboard-reachable choice that works
  // without location permission.
  const [areaScope, setAreaScope] = useState<'capital' | 'province'>('capital');
  const [municipality, setMunicipality] = useState('');

  const QUICK_ACTIONS = [
    { k: 'today', icon: Sparkles, to: '/events?filter=today' },
    { k: 'weekend', icon: Calendar, to: '/events?filter=weekend' },
    { k: 'family', icon: Baby, to: '/events?filter=family' },
    { k: 'pharmacies', icon: Pill, to: '/pharmacies' },
    { k: 'map', icon: MapIcon, to: '/map' },
    { k: 'free', icon: Heart, to: '/events?filter=free' },
  ] as const;

  const isSports = appMode === 'deportes';

  return (
    <div
      className={cn(
        'min-h-screen',
        // Deportes: the opaque cinematic ramp is owned by `.sports-theme`.
        isSports && 'bg-transparent'
      )}

    >
      <SEO
        title={t('home.seo.title')}
        description={t('home.seo.description')}
        path="/"
      />

      {/* ============== HERO — sobrio, institucional ============== */}
      <header className={cn(
        'relative text-white px-4 sm:px-6 pt-4 overflow-hidden',
        isSports ? 'sports-hero pb-5' : 'bg-gradient-hero pb-20'
      )}>


        {/* Subtle depth layer — only in Eventos to keep Deportes hero clean */}
        {!isSports && (
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="hero-glow hero-glow--warm -top-32 -left-24 h-80 w-80" />
            <div className="hero-glow hero-glow--cool -bottom-24 -right-20 h-72 w-72" />
          </div>
        )}

        {/* Fundido hacia la siguiente sección — sólo Eventos (Deportes es opaco continuo) */}
        {!isSports && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent via-background/40 to-background"
          />
        )}

        {/* Top controls */}
        <div className="relative flex justify-between items-center gap-2 mb-4 min-w-0">
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
              onClick={() => switchMode('eventos')}
              aria-pressed={appMode === 'eventos'}
              className={cn(
                'relative z-[1] px-3 sm:px-4 py-1.5 rounded-full text-[13px] sm:text-sm font-semibold transition-colors duration-300 min-h-[36px] whitespace-nowrap',
                appMode === 'eventos' ? 'text-slate-900' : 'text-white/90 hover:text-white'
              )}
            >
              {t('sports.events')}
            </button>
            <button
              onClick={() => switchMode('deportes')}
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
            <h1 className={cn(
              'font-bold tracking-tight max-w-xl',
              isSports
                ? 'text-[24px] sm:text-[30px] leading-[1.1]'
                : 'text-[26px] sm:text-[38px] leading-[1.08]'
            )}>
              {isSports ? t('sportsHome.heroTitle', 'Deporte en Málaga') : t('home.hero.title')}
            </h1>
            <p className={cn(
              'text-[13.5px] sm:text-sm mt-1.5 max-w-md leading-snug',
              isSports ? 'line-clamp-2 text-sportsx-accent' : 'text-white/90'
            )}>
              {isSports
                ? t('sportsHome.heroSubtitle', 'Agenda, instalaciones y clubes verificados de la provincia')
                : t('home.hero.subtitle')}
            </p>

          </div>

          {!isSports && (
            <button
              type="button"
              ref={searchToggleRef}
              onClick={() => setSearchOpen((v) => !v)}
              aria-label={t('home.hero.searchAria')}
              aria-expanded={searchOpen}
              aria-controls="global-search-panel"
              title={t('home.hero.searchAria')}
              className="liquid-press shrink-0 inline-flex items-center gap-2 h-11 min-w-11 px-4 rounded-full bg-primary text-primary-foreground shadow-md ring-1 ring-primary/30 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              {searchOpen ? (
                <X className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Search className="h-5 w-5" aria-hidden="true" />
              )}
              <span className="text-sm font-semibold">
                {searchOpen
                  ? t('common.close', 'Cerrar')
                  : t('common.search', 'Buscar')}
              </span>
            </button>
          )}
        </div>

        {/* Barra de búsqueda global desplegable */}
        {!isSports && (
          <div
            id="global-search-panel"
            ref={searchPanelRef}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation();
                closeSearch();
              }
            }}
            className={cn(
              'grid transition-all duration-300 ease-out motion-reduce:transition-none',
              searchOpen
                ? 'grid-rows-[1fr] opacity-100 mt-3'
                : 'grid-rows-[0fr] opacity-0 mt-0 pointer-events-none',
            )}
          >
            <div className="overflow-hidden">
              <form
                onSubmit={handleSearchSubmit}
                role="search"
                className="flex items-center gap-2 h-12 px-3 rounded-2xl bg-white/95 dark:bg-slate-900/85 backdrop-blur border border-white/40 shadow-lg"
              >
                <Search className="h-5 w-5 text-slate-500 shrink-0" aria-hidden="true" />
                <input
                  ref={searchInputRef}
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t(
                    'home.hero.searchPlaceholder',
                    'Busca eventos, lugares, categorías…'
                  )}
                  className="flex-1 min-w-0 bg-transparent border-0 outline-none text-sm text-slate-900 dark:text-white placeholder:text-slate-500"
                  aria-label={t('home.hero.searchAria')}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      searchInputRef.current?.focus();
                    }}
                    aria-label={t('common.clear', 'Limpiar')}
                    className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-white px-2 min-h-9"
                  >
                    {t('common.clear', 'Limpiar')}
                  </button>
                )}
                <button
                  type="submit"
                  disabled={!searchQuery.trim()}
                  className="h-9 px-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
                >
                  {t('common.search', 'Buscar')}
                </button>
              </form>
            </div>
          </div>
        )}
      </header>



      <main className={cn(
        'px-4 sm:px-6 pb-8 relative z-10 mx-auto',
        isSports ? 'pt-4 space-y-4 max-w-[1180px]' : '-mt-14 space-y-6 max-w-6xl'
      )}>

        {isSports ? (
          <Suspense fallback={<div className="h-40" />}>
            <SportsContent />
          </Suspense>
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

            {/* ============== DESTACADO REAL — primer contenido útil ============== */}
            <Suspense fallback={null}>
              <FeaturedEvent onSelect={setFeaturedId} />
            </Suspense>

            {/* ============== PARA TI — cultura + deporte según gustos ============== */}
            <Suspense fallback={null}>
              <ForYouSection />
            </Suspense>


            {/* ============== Tengo dos horas — planificador real ============== */}
            <Suspense fallback={null}>
              <TwoHoursSheet />
            </Suspense>

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
                <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-3">
                  {[1,2].map((i) => <EventCardSkeleton key={i} />)}
                </div>
              ) : weekendError ? (
                <div className="glass-card p-6 text-center">
                  <p className="text-sm text-foreground font-medium">
                    {t('home.weekend.errorTitle', 'No hemos podido cargar los planes del finde')}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t('home.weekend.errorHelp', 'Puede ser un problema de conexión. Inténtalo de nuevo.')}
                  </p>
                  <Button variant="outline" className="mt-3 h-11 px-5" onClick={() => refetchWeekend()}>
                    {t('common.retry', 'Reintentar')}
                  </Button>
                </div>
              ) : weekendList.length > 0 ? (
                <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-3">
                  {weekendList.map((event) => (
                    <EventCard key={event.id} event={event} dense
                      isFavorite={isFavorite(event.id)} onToggleFavorite={handleToggleFavorite} />
                  ))}
                </div>

              ) : (
                <div className="glass-card p-6 text-center">
                  <Calendar className="h-10 w-10 mx-auto mb-2 opacity-50 text-muted-foreground" aria-hidden />
                  <p className="text-sm text-foreground font-medium">
                    {t('home.weekend.emptyTitle', 'Aún no hay planes publicados para este fin de semana')}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t('home.weekend.emptyHelp', 'Consulta la agenda completa para ver los próximos días.')}
                  </p>
                  <Button variant="outline" className="mt-3 h-11 px-5" onClick={() => navigate('/events')}>
                    {t('home.weekend.emptyCta', 'Ver toda la agenda')}
                  </Button>
                </div>
              )}
            </section>

            {/* ============== Málaga ciudad y provincia — selector simple ============== */}
            <section className="glass-panel p-5 sm:p-6" aria-labelledby="city-province-title">
              <div className="flex items-start gap-3 mb-4">
                <div className="h-11 w-11 shrink-0 rounded-2xl bg-secondary/15 flex items-center justify-center">
                  <Landmark className="h-5 w-5 text-secondary" aria-hidden />
                </div>
                <div className="min-w-0">
                  <h2 id="city-province-title" className="text-lg sm:text-xl font-bold tracking-tight">
                    {t('home.cityProvince.title')}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                    {t('home.cityProvince.subtitle')}
                  </p>
                  <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed">
                    {t('home.cityProvince.coverageNote', 'Buscamos por nombre de municipio en la agenda publicada; la cobertura por municipio aún es parcial.')}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => goLocality('Málaga')}
                  aria-pressed={areaScope === 'capital'}
                  className={cn(
                    'liquid-press rounded-2xl border p-4 text-left min-h-[76px] transition-colors',
                    areaScope === 'capital'
                      ? 'border-primary bg-primary/10'
                      : 'border-border/60 bg-background/40 hover:bg-primary/5',
                  )}
                >
                  <span className="block text-sm font-semibold text-foreground">
                    {t('home.cityProvince.capital', 'Málaga capital')}
                  </span>
                  <span className="block text-[12.5px] text-muted-foreground mt-0.5">
                    {t('home.cityProvince.capitalHelp', 'Planes en la ciudad')}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setAreaScope('province')}
                  aria-pressed={areaScope === 'province'}
                  className={cn(
                    'liquid-press rounded-2xl border p-4 text-left min-h-[76px] transition-colors',
                    areaScope === 'province'
                      ? 'border-primary bg-primary/10'
                      : 'border-border/60 bg-background/40 hover:bg-primary/5',
                  )}
                >
                  <span className="block text-sm font-semibold text-foreground">
                    {t('home.cityProvince.province', 'Resto de la provincia')}
                  </span>
                  <span className="block text-[12.5px] text-muted-foreground mt-0.5">
                    {t('home.cityProvince.provinceHelp', 'Elige tu municipio')}
                  </span>
                </button>
              </div>

              {areaScope === 'province' && (
                <div className="mt-4 flex flex-col sm:flex-row gap-2.5">
                  <label className="flex-1 min-w-0">
                    <span className="sr-only">{t('home.cityProvince.selectLabel', 'Municipio')}</span>
                    <select
                      value={municipality}
                      onChange={(e) => setMunicipality(e.target.value)}
                      className="w-full h-12 rounded-2xl border border-border/60 bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <option value="">{t('home.cityProvince.selectPlaceholder', 'Elige un municipio…')}</option>
                      {VENUE_ZONES.map((zone) => {
                        const items = MUNICIPALITIES.filter((m) => m.zone === zone.id);
                        if (items.length === 0) return null;
                        return (
                          <optgroup key={zone.id} label={zone.label}>
                            {items.map((loc) => (
                              <option key={loc.name} value={loc.name}>
                                {loc.name}
                              </option>
                            ))}
                          </optgroup>
                        );
                      })}
                    </select>
                  </label>
                  <Button
                    className="h-12 px-5 font-semibold shrink-0"
                    disabled={!municipality}
                    onClick={() => municipality && goLocality(municipality)}
                  >
                    {t('home.cityProvince.go', 'Ver planes')}
                  </Button>
                </div>
              )}
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
                    onClick={() => switchMode('deportes')}
                    className="mt-4 liquid-press h-11 px-4 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {t('home.sports.cta')} <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </section>

          </>
        )}
      </main>
    </div>
  );
};

export default Index;

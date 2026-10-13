
import { lazy, Suspense, useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Search, Calendar, Pill, ChevronRight, Sparkles, Baby,
  Map as MapIcon, Heart, X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import LanguageSelector from '@/components/common/LanguageSelector';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import HomeEventCard from '@/components/home/HomeEventCard';
import HomeModeSwitch from '@/components/home/HomeModeSwitch';

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

  const { data: upcomingEvents, isLoading: loadingUpcoming, isError: upcomingError, refetch: refetchUpcoming } = useEvents({
    limit: 24, enabled: appMode === 'eventos',
  });
  const upcomingList = (upcomingEvents ?? []).filter(event => event.id !== featuredId).slice(0, 3);

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
    { k: 'free', icon: Heart, to: '/events?filter=free' },
    { k: 'family', icon: Baby, to: '/events?filter=family' },
    { k: 'pharmacies', icon: Pill, to: '/pharmacies' },
    { k: 'map', icon: MapIcon, to: '/map' },
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
        isSports ? 'sports-hero pb-5' : 'home-header'
      )}>


        {/* Top controls */}
        <div className={cn("relative flex justify-between items-center gap-2 mb-4 min-w-0", !isSports && "home-toolbar")}>
          <HomeModeSwitch value={appMode} onChange={switchMode} editorial={!isSports} />

          <div className={cn("flex items-center gap-1 shrink-0", !isSports && "home-theme-controls")}>
            <ThemeToggle />
            <LanguageSelector variant="compact" />
          </div>
        </div>

        {/* Título editorial + acceso a búsqueda compacto */}
        <div className={cn("relative flex items-end justify-between gap-3", !isSports && "home-heading-row")}>
          <div className="min-w-0 flex-1">
            {!isSports && <p className="home-brand-name" dir="ltr" translate="no">Málaga Connect</p>}
            <h1 className={cn(
              'font-bold tracking-tight max-w-xl',
              isSports
                ? 'text-[24px] sm:text-[30px] leading-[1.1]'
                : 'home-display'
            )}>
              {isSports ? t('sportsHome.heroTitle', 'Deporte en Málaga') : t('home.hero.title')}
            </h1>
            <p className={cn(
              'text-[13.5px] sm:text-sm mt-1.5 max-w-md leading-snug',
              isSports ? 'line-clamp-2 text-sportsx-accent' : 'home-intro'
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
              className="home-search-action liquid-press shrink-0 inline-flex items-center gap-2 h-11 min-w-11 px-4 rounded-full bg-primary text-primary-foreground shadow-md ring-1 ring-primary/30 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
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
                className="home-search-form flex items-center gap-2 h-12 px-3 rounded-2xl bg-white/95 dark:bg-slate-900/85 backdrop-blur border border-white/40 shadow-lg"
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
        isSports ? 'pt-4 space-y-4 max-w-[1180px]' : 'home-main'
      )}>

        {isSports ? (
          <Suspense fallback={<div className="h-40" />}>
            <SportsContent />
          </Suspense>
        ) : (
          <>
            <section aria-label={t('home.quickActions.aria')} className="home-intents">
              {QUICK_ACTIONS.filter(qa => ['today', 'weekend', 'free', 'family'].includes(qa.k)).map(qa => (
                <button type="button" key={qa.k} onClick={() => navigate(qa.to)} className="home-intent liquid-press">
                  <qa.icon size={18} aria-hidden /><span>{t(`home.quickActions.${qa.k}`)}</span>
                </button>
              ))}
            </section>

            {/* ============== DESTACADO REAL — primer contenido útil ============== */}
            <Suspense fallback={null}>
              <FeaturedEvent onSelect={setFeaturedId} />
            </Suspense>

            <section aria-labelledby="home-upcoming-title">
              <div className="home-section-header">
                <h2 id="home-upcoming-title" className="home-section-title">{t('home.pilot.upcoming')}</h2>
                <Button variant="ghost" className="home-section-action" onClick={() => navigate('/events')}>
                  {t('home.sections.viewAll')} <ChevronRight className="home-arrow" size={16} aria-hidden />
                </Button>
              </div>
              {loadingUpcoming ? <div role="status" aria-label={t('common.loading')} className="home-compact-grid">
                {[1, 2].map(i => <EventCardSkeleton key={i} />)}
              </div> : upcomingError ? <div className="home-notice" role="alert">
                <p>{t('errors.loadFailed')}</p><Button onClick={() => refetchUpcoming()}>{t('common.retry')}</Button>
              </div> : upcomingList.length ? <div className="home-compact-grid">
                {upcomingList.map(event => <HomeEventCard key={event.id} event={event} compact
                  isFavorite={isFavorite(event.id)} onToggleFavorite={handleToggleFavorite} />)}
              </div> : <p className="home-note">{t(upcomingEvents?.length ? 'home.pilot.onlyFeatured' : 'home.pilot.noUpcoming')}</p>}
            </section>

            <Suspense fallback={null}>
              <ForYouSection excludedEventId={featuredId} />
            </Suspense>

            {/* ============== Este finde ============== */}
            <section aria-labelledby="home-weekend-title">
              <div className="home-section-header">
                <div className="min-w-0">
                  <h2 id="home-weekend-title" className="home-section-title">{t('home.sections.thisWeekend')}</h2>

                </div>
                <Button variant="ghost" size="sm" className="home-section-action gap-1" onClick={() => navigate('/events?filter=weekend')}>
                  {t('home.sections.viewAll')} <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {loadingWeekend ? (
                <div className="home-collection">
                  {[1,2].map((i) => <EventCardSkeleton key={i} />)}
                </div>
              ) : weekendError ? (
                <div className="home-notice">
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
                <div className="home-collection">
                  {weekendList.map((event) => (
                    <HomeEventCard key={event.id} event={event}
                      isFavorite={isFavorite(event.id)} onToggleFavorite={handleToggleFavorite} />
                  ))}
                </div>

              ) : (
                <div className="home-notice">
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
            <section className="home-location" aria-labelledby="city-province-title">
              <div className="flex items-start gap-3 mb-4">

                <div className="min-w-0">
                  <h2 id="city-province-title" className="home-section-title">
                    {t('home.cityProvince.title')}
                  </h2>
                  <p className="home-note">
                    {t('home.cityProvince.subtitle')}
                  </p>
                  <p className="home-note">
                    {t('home.cityProvince.coverageNote', 'Buscamos por nombre de municipio en la agenda publicada; la cobertura por municipio aún es parcial.')}
                  </p>
                </div>
              </div>

              <div className="home-location-choices">
                <button
                  type="button"
                  onClick={() => goLocality('Málaga')}
                  aria-pressed={areaScope === 'capital'}
                  className={cn(
                    'home-location-choice liquid-press',
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
                    'home-location-choice liquid-press',
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


            <section className="home-services" aria-label={t('home.pilot.services')}>
              <Button variant="outline" onClick={() => navigate('/pharmacies')}><Pill size={18} aria-hidden />{t('home.quickActions.pharmacies')}</Button>
              <Button variant="outline" onClick={() => navigate('/map')}><MapIcon size={18} aria-hidden />{t('home.quickActions.map')}</Button>
            </section>
            <div className="home-two-hours"><Suspense fallback={null}><TwoHoursSheet /></Suspense></div>

          </>
        )}
      </main>
    </div>
  );
};

export default Index;

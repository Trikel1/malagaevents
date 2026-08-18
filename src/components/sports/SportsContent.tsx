import { useState, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Search, Building2, ChevronRight, CalendarDays, Sparkles,
  MapPin, Megaphone, CalendarClock, Trophy, Waves, Trees, Dumbbell,
  Footprints, Zap, Navigation, AlertTriangle, RotateCcw, ArrowRight,
} from 'lucide-react';
import { addDays } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import SportEventCard from '@/components/sports/SportEventCard';
import SportsVenuesDropdown from '@/components/sports/SportsVenuesDropdown';
import { useSportsEvents, useSportsVenues } from '@/hooks/useSportsEvents';
import { useMunicipalities } from '@/hooks/useMunicipalities';
import SportIcon from '@/components/sports/SportIcon';
import OfficialSourcesPanel from '@/components/sports/OfficialSourcesPanel';
import SportsAgenda from '@/components/sports/SportsAgenda';

const TIMEZONE = 'Europe/Madrid';

type TimeFilter = 'today' | 'weekend' | 'upcoming';

function todayMadrid(): string {
  return formatInTimeZone(new Date(), TIMEZONE, 'yyyy-MM-dd');
}

function getWeekendDates(): { from: string; to: string } {
  const today = new Date(todayMadrid() + 'T12:00:00');
  const dayOfWeek = today.getDay();
  let fri: Date;
  if (dayOfWeek === 5) fri = today;
  else if (dayOfWeek === 6) fri = addDays(today, -1);
  else if (dayOfWeek === 0) fri = addDays(today, -2);
  else fri = addDays(today, 5 - dayOfWeek);
  return {
    from: formatInTimeZone(fri, TIMEZONE, 'yyyy-MM-dd'),
    to: formatInTimeZone(addDays(fri, 2), TIMEZONE, 'yyyy-MM-dd'),
  };
}

/**
 * Category tiles: 8 visual buckets requested for the redesign.
 * Each tile maps to one or more `sport_category` values already used by the
 * data pipeline so filtering works without any backend change.
 */
interface CategoryTile {
  id: string;
  labelKey: string;
  fallback: string;
  icon: (props: { className?: string }) => JSX.Element;
  categories: string[];
}

const CATEGORY_TILES: CategoryTile[] = [
  {
    id: 'futbol',
    labelKey: 'sportsHome.cat.futbol',
    fallback: 'Fútbol',
    icon: (p) => <SportIcon sport="futbol" className={p.className} />,
    categories: ['futbol', 'futsal'],
  },
  {
    id: 'baloncesto',
    labelKey: 'sportsHome.cat.baloncesto',
    fallback: 'Baloncesto',
    icon: (p) => <SportIcon sport="baloncesto" className={p.className} />,
    categories: ['baloncesto'],
  },
  {
    id: 'atletismo',
    labelKey: 'sportsHome.cat.atletismo',
    fallback: 'Atletismo',
    icon: (p) => <Footprints className={p.className} aria-hidden="true" />,
    categories: ['atletismo', 'running'],
  },
  {
    id: 'natacion',
    labelKey: 'sportsHome.cat.natacion',
    fallback: 'Natación',
    icon: (p) => <Waves className={p.className} aria-hidden="true" />,
    categories: ['natacion', 'acuaticos'],
  },
  {
    id: 'padel_tenis',
    labelKey: 'sportsHome.cat.padelTenis',
    fallback: 'Pádel y tenis',
    icon: (p) => <Trophy className={p.className} aria-hidden="true" />,
    categories: ['padel', 'tenis'],
  },
  {
    id: 'raqueta',
    labelKey: 'sportsHome.cat.raqueta',
    fallback: 'Deportes de raqueta',
    icon: (p) => <Zap className={p.className} aria-hidden="true" />,
    categories: ['padel', 'tenis', 'badminton', 'squash', 'tenis_mesa'],
  },
  {
    id: 'aire_libre',
    labelKey: 'sportsHome.cat.aireLibre',
    fallback: 'Actividades al aire libre',
    icon: (p) => <Trees className={p.className} aria-hidden="true" />,
    categories: ['senderismo', 'ciclismo', 'triatlon'],
  },
  {
    id: 'otros',
    labelKey: 'sportsHome.cat.otros',
    fallback: 'Otros deportes',
    icon: (p) => <Dumbbell className={p.className} aria-hidden="true" />,
    categories: ['otros', 'balonmano', 'voleibol', 'rugby', 'motor', 'fitness', 'artes_marciales'],
  },
];

const SportsContent = () => {
  const [selectedTile, setSelectedTile] = useState<string | 'all'>('all');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('upcoming');
  const [selectedVenueNames, setSelectedVenueNames] = useState<string[]>([]);
  const [selectedMunicipality, setSelectedMunicipality] = useState<string | 'all'>('all');
  const [searchQ, setSearchQ] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const resultsRef = useRef<HTMLDivElement>(null);
  const municipalityRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: allVenues = [] } = useSportsVenues();
  const { data: municipalities = [] } = useMunicipalities();
  const municipalityNames = useMemo(() => {
    const names = municipalities.map((m) => m.name).filter(Boolean);
    return names.length ? names : ['Málaga', 'Marbella', 'Fuengirola', 'Benalmádena', 'Torremolinos'];
  }, [municipalities]);

  const activeTile = CATEGORY_TILES.find((c) => c.id === selectedTile);

  const filters = useMemo(() => {
    const today = todayMadrid();
    const f: {
      fromDate?: string;
      toDate?: string;
      categories?: string[];
      venueNames?: string[];
      cities?: string[];
      q?: string;
    } = {};

    if (timeFilter === 'today') {
      f.fromDate = today;
      f.toDate = today;
    } else if (timeFilter === 'weekend') {
      const wd = getWeekendDates();
      f.fromDate = wd.from;
      f.toDate = wd.to;
    } else {
      f.fromDate = today;
      f.toDate = formatInTimeZone(addDays(new Date(), 14), TIMEZONE, 'yyyy-MM-dd');
    }

    if (activeTile) f.categories = activeTile.categories;
    if (selectedVenueNames.length > 0) f.venueNames = selectedVenueNames;
    if (selectedMunicipality !== 'all') f.cities = [selectedMunicipality];
    if (searchQ.trim()) f.q = searchQ.trim();

    return f;
  }, [activeTile, timeFilter, selectedVenueNames, selectedMunicipality, searchQ]);

  const { data: events = [], isLoading, isError, refetch } = useSportsEvents(filters);

  const todayDate = todayMadrid();
  const weekend = useMemo(getWeekendDates, []);
  const todayEvents = useMemo(
    () => events.filter((e) => e.start_at.slice(0, 10) === todayDate),
    [events, todayDate],
  );
  const weekendEvents = useMemo(
    () => events.filter((e) => {
      const day = e.start_at.slice(0, 10);
      return day >= weekend.from && day <= weekend.to;
    }),
    [events, weekend],
  );

  /**
   * "Próximo evento": derived from the events already fetched by the hook
   * above — no extra request. Placeholders without a real date are excluded so
   * the hero card never shows unverified content.
   */
  const nextEvent = useMemo(() => {
    const upcoming = events
      .filter((e) => Boolean(e.start_at) && e.start_at.slice(0, 10) >= todayDate)
      .sort((a, b) => a.start_at.localeCompare(b.start_at));
    return upcoming[0] ?? null;
  }, [events, todayDate]);



  const featuredVenues = useMemo(() => allVenues.slice(0, 6), [allVenues]);
  const municipalitiesWithEvents = useMemo(() => {
    const set = new Set(events.map((e) => e.city).filter(Boolean));
    return set.size;
  }, [events]);

  const scrollTo = (ref: React.RefObject<HTMLElement>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const scrollToResults = () => scrollTo(resultsRef);

  const handleQuickAction = (key: TimeFilter) => {
    setTimeFilter(key);
    // Defer scroll to next tick so the results block reflects the new filter.
    setTimeout(scrollToResults, 60);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQ(searchDraft);
    setTimeout(scrollToResults, 60);
  };

  // -------------------------------------------------------------------------
  // Reusable UI
  // -------------------------------------------------------------------------
  const renderEmpty = (msg: string) => (
    <Card className="bg-sportsx-surface border-dashed border-sportsx-line">
      <CardContent className="py-8 text-center text-muted-foreground">
        <CalendarClock className="h-10 w-10 mx-auto mb-2 text-sportsx-accent" aria-hidden="true" />
        <p className="text-sm">{msg}</p>
      </CardContent>
    </Card>
  );

  const surfaceBtn =
    'bg-sportsx-surface border border-sportsx-line hover:bg-sportsx-elevated ' +
    'transition-[transform,opacity,background-color] duration-200 ease-out ' +
    'motion-reduce:transition-none active:scale-[0.99] ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ' +
    'focus-visible:ring-offset-background';

  // 2×2 quick access grid.
  const quickAccess: {
    key: string;
    icon: typeof Sparkles;
    label: string;
    onClick: () => void;
    active?: boolean;
  }[] = [
    {
      key: 'today',
      icon: Sparkles,
      label: t('sportsHome.quick.today', 'Hoy'),
      onClick: () => handleQuickAction('today'),
      active: timeFilter === 'today',
    },
    {
      key: 'upcoming',
      icon: CalendarDays,
      label: t('sportsHome.quick.upcoming', 'Próximos 14 días'),
      onClick: () => handleQuickAction('upcoming'),
      active: timeFilter === 'upcoming',
    },
    {
      key: 'venues',
      icon: Building2,
      label: t('sportsHome.quick.venues', 'Instalaciones'),
      onClick: () => navigate('/venues'),
    },
    {
      key: 'municipalities',
      icon: MapPin,
      label: t('sportsHome.quick.municipalities', 'Municipios'),
      onClick: () => scrollTo(municipalityRef),
    },
  ];

  const summaryStats = [
    {
      icon: CalendarClock,
      value: events.length,
      label: t('sportsHome.stats.events', 'Eventos próximos'),
    },
    {
      icon: Building2,
      value: allVenues.length,
      label: t('sportsHome.stats.venues', 'Instalaciones'),
    },
    {
      icon: MapPin,
      value: municipalitiesWithEvents || municipalityNames.length,
      label: t('sportsHome.stats.municipalities', 'Municipios'),
    },
  ];

  const formatEventDate = (iso: string) =>
    formatInTimeZone(new Date(iso), TIMEZONE, "d MMM · HH:mm'h'");

  return (
    <div className="relative space-y-5 pt-1 pb-4">
      {/* Compact 48px search bar */}
      <form
        onSubmit={handleSearchSubmit}
        role="search"
        aria-label={t('sportsHome.searchAria', 'Buscar deportes, instalaciones o municipios')}
        className="flex items-center gap-2 h-12 px-3 rounded-2xl border border-sportsx-line bg-sportsx-surface"
      >
        <Search className="h-5 w-5 text-sportsx-accent shrink-0" aria-hidden="true" />
        <input
          type="search"
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          placeholder={t('sportsHome.searchPlaceholder', 'Busca un deporte, instalación o municipio')}
          className="flex-1 min-w-0 h-full bg-transparent border-0 outline-none text-sm text-foreground placeholder:text-muted-foreground"
          aria-label={t('sportsHome.searchAria', 'Buscar deportes, instalaciones o municipios')}
        />
        {searchDraft && (
          <button
            type="button"
            onClick={() => { setSearchDraft(''); setSearchQ(''); }}
            className="text-xs font-semibold text-sportsx-accent hover:underline h-9 px-2"
          >
            {t('common.clear', 'Limpiar')}
          </button>
        )}
        <Button
          type="submit"
          size="sm"
          className="h-9 px-3 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {t('common.search', 'Buscar')}
        </Button>
      </form>

      {/* Próximo evento destacado */}
      <section aria-label={t('sportsHome.next.aria', 'Próximo evento deportivo')}>
        {isLoading ? (
          <Skeleton className="h-[148px] w-full rounded-2xl bg-sportsx-surface" />
        ) : nextEvent ? (
          <article className="rounded-2xl border border-sportsx-line bg-sportsx-elevated p-4">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Badge className="bg-primary text-primary-foreground border-0 gap-1">
                <Sparkles className="h-3 w-3" aria-hidden="true" />
                {t('sportsHome.next.badge', 'Próximo evento')}
              </Badge>
              <span className="text-xs font-semibold text-sportsx-accent">
                {formatEventDate(nextEvent.start_at)}
              </span>
            </div>
            <h2 className="text-lg font-bold leading-tight text-foreground">
              {nextEvent.title}
            </h2>
            <p className="mt-1.5 text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
              {nextEvent.sport && (
                <span className="inline-flex items-center gap-1">
                  <SportIcon sport={nextEvent.sport} className="h-3.5 w-3.5" />
                  {t(`sports.${nextEvent.sport}`, nextEvent.sport)}
                </span>
              )}
              {nextEvent.city && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                  {nextEvent.city}
                </span>
              )}
              {nextEvent.venue && (
                <span className="inline-flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
                  {nextEvent.venue}
                </span>
              )}
            </p>
            <Button
              onClick={scrollToResults}
              className="mt-3 min-h-11 w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
            >
              {t('sportsHome.next.cta', 'Ver evento')}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>

          </article>
        ) : (
          <article className="rounded-2xl border border-dashed border-sportsx-line bg-sportsx-surface p-4">
            <h2 className="text-base font-semibold text-foreground">
              {t('sportsHome.next.emptyTitle', 'Todavía no hay un próximo evento confirmado')}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t(
                'sportsHome.next.emptyBody',
                'Solo publicamos actividades verificadas. Consulta las fuentes oficiales mientras sincronizamos.',
              )}
            </p>
            <p className="mt-3 text-sm font-semibold text-sportsx-info">
              {t('sportsHome.next.verifiedSources', 'Fuentes oficiales verificadas')}
            </p>
          </article>
        )}
      </section>

      {/* Accesos rápidos 2×2 */}
      <section aria-label={t('sportsHome.quickAria', 'Accesos rápidos')}>
        <div className="grid grid-cols-2 gap-2.5">
          {quickAccess.map((q) => (
            <button
              key={q.key}
              type="button"
              onClick={q.onClick}
              aria-pressed={q.active}
              className={cn(
                'flex items-center gap-2.5 rounded-2xl px-3 min-h-[64px] text-left',
                q.active
                  ? 'bg-primary text-primary-foreground border border-primary'
                  : surfaceBtn,
              )}
            >
              <span
                className={cn(
                  'h-9 w-9 rounded-xl flex items-center justify-center shrink-0',
                  q.active ? 'bg-primary-foreground/15' : 'bg-sportsx-elevated',
                )}
              >
                <q.icon
                  className={cn('h-[18px] w-[18px]', q.active ? '' : 'text-sportsx-accent')}
                  aria-hidden="true"
                />
              </span>
              <span className="text-[13px] font-semibold leading-tight">{q.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Agenda deportiva verificada */}
      <SportsAgenda />

      {/* Explora por deporte */}
      <section aria-label={t('sportsHome.categoriesAria', 'Categorías deportivas')}>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-lg font-semibold tracking-tight">
            {t('sportsHome.categoriesTitle', 'Explora por deporte')}
          </h2>
          {selectedTile !== 'all' && (
            <button
              type="button"
              onClick={() => setSelectedTile('all')}
              className="text-xs font-semibold text-sportsx-accent hover:underline min-h-9 px-1"
            >
              {t('sportsHome.clearCategory', 'Ver todos')}
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {CATEGORY_TILES.map((tile) => {
            const active = selectedTile === tile.id;
            return (
              <button
                key={tile.id}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setSelectedTile(active ? 'all' : tile.id);
                  setTimeout(scrollToResults, 60);
                }}
                className={cn(
                  'group flex items-center gap-2.5 rounded-2xl px-3 min-h-[56px] text-left',
                  active
                    ? 'bg-primary text-primary-foreground border border-primary'
                    : surfaceBtn,
                )}
              >
                <span
                  className={cn(
                    'h-8 w-8 rounded-lg flex items-center justify-center shrink-0',
                    active ? 'bg-primary-foreground/15' : 'bg-sportsx-elevated text-sportsx-accent',
                  )}
                >
                  <tile.icon className="h-[18px] w-[18px]" />
                </span>
                <span className="text-[13px] font-semibold leading-tight">
                  {t(tile.labelKey, tile.fallback)}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Desktop: dos columnas a partir de 1024px */}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-6 lg:items-start space-y-5 lg:space-y-0">
        <div className="space-y-5">
          {/* Por municipio */}
          <section ref={municipalityRef} aria-label={t('sports.exploreByMunicipality', 'Explorar por municipio')}>
            <h2 className="text-lg font-semibold tracking-tight mb-3">
              {t('sports.exploreByMunicipality', 'Explorar por municipio')}
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              <Select
                value={selectedMunicipality}
                onValueChange={(v) => { setSelectedMunicipality(v); setTimeout(scrollToResults, 60); }}
              >
                <SelectTrigger
                  aria-label={t('sports.municipalitySelectAria', 'Seleccionar municipio')}
                  className="h-11 w-full sm:w-[260px] bg-sportsx-surface border-sportsx-line"
                >
                  <SelectValue placeholder={t('sports.all', 'Todos')} />
                </SelectTrigger>
                <SelectContent className="bg-popover border-sportsx-line">
                  <SelectItem value="all">{t('sports.all', 'Todos')}</SelectItem>
                  {municipalityNames.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground" aria-live="polite">
                {isLoading
                  ? t('common.loading', 'Cargando…')
                  : t('sportsHome.resultsSummary', '{{count}} resultados', { count: events.length })}
              </p>
            </div>
          </section>

          {/* Próximos eventos */}
          <section ref={resultsRef}>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <h2 className="text-lg font-semibold mr-auto">
                {t('sports.upcomingEvents', 'Próximos eventos deportivos')}
              </h2>
              <SportsVenuesDropdown
                selectedVenueNames={selectedVenueNames}
                onSelectionChange={setSelectedVenueNames}
              />
            </div>

            {isLoading ? (
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-40 w-full rounded-2xl bg-sportsx-surface" />
                ))}
              </div>
            ) : isError ? (
              <Card className="bg-sportsx-surface border-destructive/40">
                <CardContent className="py-8 text-center space-y-3">
                  <AlertTriangle className="h-8 w-8 mx-auto text-destructive" aria-hidden="true" />
                  <p className="text-sm text-foreground">{t('errors.generic')}</p>
                  <Button
                    variant="outline"
                    onClick={() => refetch()}
                    className="min-h-11 gap-2 border-sportsx-line"
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    {t('common.retry', 'Reintentar')}
                  </Button>
                </CardContent>
              </Card>
            ) : events.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {events.map((event) => (
                  <SportEventCard key={event.id} event={event} />
                ))}
              </div>
            ) : (
              renderEmpty(t('sports.empty.results', 'No encontramos actividades con estos filtros.'))
            )}
          </section>

          {/* Hoy / fin de semana destacados */}
          {timeFilter !== 'today' && todayEvents.length > 0 && (
            <section>
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-lg font-semibold">{t('sports.todayInSport', 'Hoy en deporte')}</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-sportsx-accent gap-1 min-h-11"
                  onClick={() => handleQuickAction('today')}
                >
                  {t('common.seeAll')}
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {todayEvents.slice(0, 4).map((event) => (
                  <SportEventCard key={event.id} event={event} />
                ))}
              </div>
            </section>
          )}

          {timeFilter !== 'weekend' && weekendEvents.length > 0 && (
            <section>
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-lg font-semibold">{t('sports.weekendSport', 'Deporte este finde')}</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-sportsx-accent gap-1 min-h-11"
                  onClick={() => handleQuickAction('weekend')}
                >
                  {t('common.seeAll')}
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {weekendEvents.slice(0, 4).map((event) => (
                  <SportEventCard key={event.id} event={event} />
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Columna lateral en escritorio */}
        <aside className="space-y-5">
          {/* Resumen de actividad */}
          <section aria-label={t('sportsHome.summaryAria', 'Resumen de actividad')}>
            <div className="grid grid-cols-3 gap-2 rounded-2xl border border-sportsx-line bg-sportsx-surface p-3">
              {summaryStats.map((s, i) => (
                <div key={i} className="flex flex-col items-center text-center gap-1 rounded-xl py-2 px-1">
                  <div className="h-9 w-9 rounded-full bg-sportsx-elevated text-sportsx-accent flex items-center justify-center">
                    <s.icon className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <span className="text-xl font-bold leading-none tabular-nums">
                    {isLoading ? '—' : s.value}
                  </span>
                  <span className="text-[11px] text-muted-foreground leading-tight">{s.label}</span>
                </div>
              ))}
            </div>
          </section>

          {/* CTA */}
          <section>
            <div className="rounded-2xl border border-sportsx-line bg-sportsx-elevated p-4">
              <h3 className="text-base font-semibold mb-1">
                {t('sportsHome.cta.title', '¿Qué te apetece hacer hoy?')}
              </h3>
              <p className="text-xs text-muted-foreground mb-3">
                {t('sportsHome.cta.subtitle', 'Descubre lo que se mueve en tu entorno.')}
              </p>
              <div className="grid grid-cols-1 gap-2">
                <Button
                  onClick={() => navigate('/map')}
                  className="min-h-11 bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
                >
                  <Navigation className="h-4 w-4" aria-hidden="true" />
                  {t('sportsHome.cta.near', 'Ver actividades cerca de mí')}
                </Button>
                <Button
                  onClick={() => navigate('/venues')}
                  variant="outline"
                  className="min-h-11 border-sportsx-line gap-2"
                >
                  <Building2 className="h-4 w-4" aria-hidden="true" />
                  {t('sportsHome.cta.venues', 'Explorar instalaciones')}
                </Button>
              </div>
            </div>
          </section>

          {/* Recintos destacados */}
          <section>
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-semibold">{t('sports.venuesTitle', 'Recintos deportivos')}</h2>
              <Button
                variant="ghost"
                size="sm"
                className="text-sportsx-accent gap-1 min-h-11"
                onClick={() => navigate('/venues')}
              >
                {t('common.seeAll')}
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
            {featuredVenues.length > 0 ? (
              <div className="grid grid-cols-1 gap-2">
                {featuredVenues.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => navigate('/venues')}
                    className={cn('flex items-start gap-3 p-3 rounded-xl text-left min-h-[64px]', surfaceBtn)}
                  >
                    <div className="h-9 w-9 rounded-full bg-sportsx-elevated text-sportsx-accent flex items-center justify-center shrink-0">
                      <Building2 className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{v.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{v.city}</p>
                      {v.sports?.length > 0 && (
                        <div className="flex gap-1 mt-1.5 flex-wrap">
                          {v.sports.slice(0, 3).map((s) => (
                            <Badge key={s} variant="outline" className="text-[10px] px-1.5 py-0 gap-1 border-sportsx-line">
                              <SportIcon sport={s} className="h-3 w-3" />
                              {t(`sports.${s}`, s)}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              renderEmpty(t('sports.empty.venuesSoon', 'Estamos incorporando recintos deportivos.'))
            )}
          </section>

          {/* Fuentes oficiales */}
          <OfficialSourcesPanel />
        </aside>
      </div>

      {/* Organizadores */}
      <section className="pb-2">
        <Card className="border-dashed border-sportsx-line bg-sportsx-surface">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-full bg-sportsx-elevated text-sportsx-accent">
              <Megaphone className="h-6 w-6" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium">
                {t('sports.organizers.title', '¿Organizas actividades deportivas?')}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t('sports.organizers.subtitle', 'Da visibilidad a tu club, recinto o competición.')}
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => navigate('/submit-event')}
              className="bg-primary text-primary-foreground hover:bg-primary/90 min-h-11"
            >
              {t('sports.organizers.cta', 'Publicar')}
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

export default SportsContent;

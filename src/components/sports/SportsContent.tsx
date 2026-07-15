import { useState, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Search, Loader2, Building2, ChevronRight, CalendarDays, Sparkles,
  MapPin, Megaphone, CalendarClock, Trophy, Waves, Trees, Dumbbell,
  Footprints, Zap, Map as MapIcon, Navigation,
} from 'lucide-react';
import { addDays } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import SportEventCard from '@/components/sports/SportEventCard';
import SportsVenuesDropdown from '@/components/sports/SportsVenuesDropdown';
import { useSportsEvents, useSportsVenues } from '@/hooks/useSportsEvents';
import { useMunicipalities } from '@/hooks/useMunicipalities';
import SportIcon from '@/components/sports/SportIcon';

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

  const { data: events = [], isLoading, isError } = useSportsEvents(filters);

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

  const featuredVenues = useMemo(() => allVenues.slice(0, 6), [allVenues]);
  const municipalitiesWithEvents = useMemo(() => {
    const set = new Set(events.map((e) => e.city).filter(Boolean));
    return set.size;
  }, [events]);

  const scrollToResults = () => {
    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

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
    <Card className="bg-emerald-50/40 dark:bg-emerald-900/10 border-dashed border-emerald-700/20">
      <CardContent className="py-8 text-center text-muted-foreground">
        <CalendarClock className="h-10 w-10 mx-auto mb-2 opacity-50 text-emerald-700 dark:text-emerald-300" />
        <p className="text-sm">{msg}</p>
      </CardContent>
    </Card>
  );

  // Big touchable time-window cards.
  const bigCards: {
    key: TimeFilter;
    icon: typeof Sparkles;
    title: string;
    subtitle: string;
    tone: string;
  }[] = [
    {
      key: 'today',
      icon: Sparkles,
      title: t('sportsHome.big.todayTitle', 'Hoy en Málaga'),
      subtitle: t('sportsHome.big.todaySubtitle', 'Actividades activas hoy'),
      tone: 'from-emerald-500/25 to-teal-500/10',
    },
    {
      key: 'weekend',
      icon: CalendarDays,
      title: t('sportsHome.big.weekendTitle', 'Este fin de semana'),
      subtitle: t('sportsHome.big.weekendSubtitle', 'Planes de viernes a domingo'),
      tone: 'from-teal-500/25 to-cyan-600/10',
    },
    {
      key: 'upcoming',
      icon: CalendarClock,
      title: t('sportsHome.big.upcomingTitle', 'Próximos 14 días'),
      subtitle: t('sportsHome.big.upcomingSubtitle', 'Toda la agenda deportiva'),
      tone: 'from-lime-500/20 to-emerald-600/15',
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

  return (
    <div className="relative space-y-6 pt-1 pb-6">
      {/* Compact search bar — opaque petrol/teal surface for AA contrast */}
      <form
        onSubmit={handleSearchSubmit}
        role="search"
        aria-label={t('sportsHome.searchAria', 'Buscar deportes, instalaciones o municipios')}
        className="flex items-center gap-2 px-3 py-2 rounded-2xl border border-emerald-700/25 bg-white dark:bg-[hsl(190_30%_12%)] shadow-sm"
      >
        <Search className="h-5 w-5 text-emerald-700 dark:text-emerald-300 shrink-0" aria-hidden="true" />
        <input
          type="search"
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          placeholder={t('sportsHome.searchPlaceholder', 'Busca un deporte, instalación o municipio')}
          className="flex-1 bg-transparent border-0 outline-none text-sm text-foreground placeholder:text-muted-foreground min-h-11"
          aria-label={t('sportsHome.searchAria', 'Buscar deportes, instalaciones o municipios')}
        />
        {searchDraft && (
          <button
            type="button"
            onClick={() => { setSearchDraft(''); setSearchQ(''); }}
            className="text-xs font-medium text-emerald-700 dark:text-emerald-300 hover:underline min-h-11 px-2"
          >
            {t('common.clear', 'Limpiar')}
          </button>
        )}
      </form>


      {/* Big quick-action cards — compact, opaque */}
      <section aria-label={t('sportsHome.quickAria', 'Accesos rápidos')}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {bigCards.map((c) => {
            const active = timeFilter === c.key;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => handleQuickAction(c.key)}
                aria-pressed={active}
                className={cn(
                  'relative rounded-xl text-left min-h-[88px] px-3.5 py-3',
                  'border transition-colors liquid-press',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-1',
                  active
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white dark:bg-[hsl(190_30%_12%)] border-emerald-700/20 hover:border-emerald-600/40',
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn(
                    'h-10 w-10 rounded-lg flex items-center justify-center shrink-0',
                    active ? 'bg-white/15 text-white' : 'bg-emerald-600/12 text-emerald-700 dark:text-emerald-200',
                  )}>
                    <c.icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className={cn('text-sm font-semibold leading-tight', active ? 'text-white' : 'text-foreground')}>
                      {c.title}
                    </p>
                    <p className={cn('text-[12px] mt-0.5 leading-snug', active ? 'text-white/85' : 'text-muted-foreground')}>
                      {c.subtitle}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>


      {/* Category grid */}
      <section aria-label={t('sportsHome.categoriesAria', 'Categorías deportivas')}>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-lg font-semibold tracking-tight">
            {t('sportsHome.categoriesTitle', 'Explora por deporte')}
          </h2>
          {selectedTile !== 'all' && (
            <button
              type="button"
              onClick={() => setSelectedTile('all')}
              className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:underline min-h-9 px-1"
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
                  'group relative flex flex-col items-start gap-2 rounded-2xl border p-3 min-h-[96px] text-left transition-all liquid-press',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60',
                  active
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-[0_10px_28px_-14px_hsl(160_60%_25%/0.55)]'
                    : 'bg-card/70 dark:bg-card/50 backdrop-blur border-emerald-700/15 hover:border-emerald-600/40 hover:bg-emerald-50/60 dark:hover:bg-emerald-900/20',
                )}
              >
                <div
                  className={cn(
                    'h-9 w-9 rounded-lg flex items-center justify-center',
                    active
                      ? 'bg-white/15 text-white'
                      : 'bg-emerald-600/12 text-emerald-700 dark:text-emerald-200',
                  )}
                >
                  <tile.icon className="h-5 w-5" />
                </div>
                <p className={cn(
                  'text-[13px] font-semibold leading-tight',
                  active ? 'text-white' : 'text-foreground',
                )}>
                  {t(tile.labelKey, tile.fallback)}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Summary stats */}
      <section aria-label={t('sportsHome.summaryAria', 'Resumen de actividad')}>
        <div className="grid grid-cols-3 gap-2 glass-panel p-3">
          {summaryStats.map((s, i) => (
            <div
              key={i}
              className="flex flex-col items-center text-center gap-1 rounded-xl py-2 px-1"
            >
              <div className="h-9 w-9 rounded-full bg-emerald-600/15 text-emerald-700 dark:text-emerald-200 flex items-center justify-center">
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

      {/* Today highlights */}
      {timeFilter !== 'today' && todayEvents.length > 0 && (
        <section>
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-semibold">{t('sports.todayInSport', 'Hoy en deporte')}</h2>
            <Button
              variant="ghost"
              size="sm"
              className="text-emerald-700 dark:text-emerald-300 gap-1 min-h-11"
              onClick={() => handleQuickAction('today')}
            >
              {t('common.seeAll')}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {todayEvents.slice(0, 4).map((event) => (
              <SportEventCard key={event.id} event={event} />
            ))}
          </div>
        </section>
      )}

      {/* Weekend highlights */}
      {timeFilter !== 'weekend' && weekendEvents.length > 0 && (
        <section>
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-semibold">{t('sports.weekendSport', 'Deporte este finde')}</h2>
            <Button
              variant="ghost"
              size="sm"
              className="text-emerald-700 dark:text-emerald-300 gap-1 min-h-11"
              onClick={() => handleQuickAction('weekend')}
            >
              {t('common.seeAll')}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {weekendEvents.slice(0, 4).map((event) => (
              <SportEventCard key={event.id} event={event} />
            ))}
          </div>
        </section>
      )}

      {/* Municipalities chips */}
      <section>
        <h2 className="text-lg font-semibold tracking-tight mb-3">
          {t('sports.exploreByMunicipality', 'Explorar por municipio')}
        </h2>
        <div className="flex gap-2 overflow-x-auto pb-2 px-0.5 -mx-0.5 scrollbar-hide">
          <button
            onClick={() => setSelectedMunicipality('all')}
            aria-pressed={selectedMunicipality === 'all'}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 min-h-11 rounded-full text-xs font-semibold whitespace-nowrap transition-colors border',
              selectedMunicipality === 'all'
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-card/70 backdrop-blur border-emerald-700/15 text-muted-foreground hover:border-emerald-600/40',
            )}
          >
            <MapPin className="h-3.5 w-3.5" />
            {t('sports.all')}
          </button>
          {municipalityNames.map((m) => {
            const active = selectedMunicipality === m;
            return (
              <button
                key={m}
                onClick={() => setSelectedMunicipality(active ? 'all' : m)}
                aria-pressed={active}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 min-h-11 rounded-full text-xs font-semibold whitespace-nowrap transition-colors border',
                  active
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-card/70 backdrop-blur border-emerald-700/15 text-muted-foreground hover:border-emerald-600/40',
                )}
              >
                <MapPin className="h-3.5 w-3.5" />
                {m}
              </button>
            );
          })}
        </div>
      </section>

      {/* Results block */}
      <section ref={resultsRef}>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <h2 className="text-lg font-semibold mr-auto">
            {t('sports.upcomingEvents', 'Próximos eventos deportivos')}
          </h2>
          <SportsVenuesDropdown
            selectedVenueNames={selectedVenueNames}
            onSelectionChange={setSelectedVenueNames}
          />
          {!isLoading && (
            <span className="text-xs text-muted-foreground">
              {events.length} {t('sportsHome.results', 'resultados')}
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-700 dark:text-emerald-300" />
          </div>
        ) : isError ? (
          <Card className="bg-destructive/10 border-destructive/20">
            <CardContent className="py-8 text-center text-destructive">
              <p className="text-sm">{t('errors.generic')}</p>
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

      {/* CTA: what do you want to do today */}
      <section>
        <div
          className="rounded-2xl border border-emerald-700/20 p-4 sm:p-5"
          style={{
            backgroundImage:
              'linear-gradient(135deg, hsl(160 55% 35% / 0.15), hsl(190 55% 40% / 0.10))',
          }}
        >
          <h3 className="text-base font-semibold mb-1">
            {t('sportsHome.cta.title', '¿Qué te apetece hacer hoy?')}
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            {t('sportsHome.cta.subtitle', 'Descubre lo que se mueve en tu entorno.')}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button
              onClick={() => navigate('/map')}
              className="min-h-11 bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              <Navigation className="h-4 w-4" />
              {t('sportsHome.cta.near', 'Ver actividades cerca de mí')}
            </Button>
            <Button
              onClick={() => navigate('/venues')}
              variant="outline"
              className="min-h-11 border-emerald-700/30 gap-2"
            >
              <Building2 className="h-4 w-4" />
              {t('sportsHome.cta.venues', 'Explorar instalaciones')}
            </Button>
          </div>
        </div>
      </section>

      {/* Featured venues */}
      <section>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold">{t('sports.venuesTitle', 'Recintos deportivos')}</h2>
          <Button
            variant="ghost"
            size="sm"
            className="text-emerald-700 dark:text-emerald-300 gap-1 min-h-11"
            onClick={() => navigate('/venues')}
          >
            {t('common.seeAll')}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {featuredVenues.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {featuredVenues.map((v) => (
              <button
                key={v.id}
                onClick={() => navigate('/venues')}
                className="flex items-start gap-3 p-3 rounded-xl border border-emerald-700/15 bg-card/70 backdrop-blur hover:border-emerald-600/40 hover:bg-emerald-50/40 dark:hover:bg-emerald-900/20 transition-colors text-left min-h-[64px]"
              >
                <div className="h-9 w-9 rounded-full bg-emerald-600/15 text-emerald-700 dark:text-emerald-200 flex items-center justify-center shrink-0">
                  <Building2 className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{v.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{v.city}</p>
                  {v.sports?.length > 0 && (
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {v.sports.slice(0, 3).map((s) => (
                        <Badge key={s} variant="outline" className="text-[10px] px-1.5 py-0 gap-1 border-emerald-700/25">
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

      {/* Organizers CTA */}
      <section className="pb-2">
        <Card className="border-dashed border-emerald-700/25 bg-gradient-to-r from-emerald-500/10 to-teal-500/10">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-full bg-emerald-600/15 text-emerald-700 dark:text-emerald-200">
              <Megaphone className="h-6 w-6" />
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
              className="bg-emerald-600 hover:bg-emerald-700 text-white min-h-11"
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

import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  startOfWeek,
  endOfWeek,
  setMonth,
  setYear,
} from 'date-fns';
import SEO from '@/components/common/SEO';
import { es, enUS, de, fr, it, pt, ja, zhCN, ru, type Locale } from 'date-fns/locale';
import { formatInTimeZone } from 'date-fns-tz';
import {
  ChevronLeft,
  ChevronRight,
  List,
  Grid3X3,
  Calendar as CalendarIcon,
  ChevronDown,
  Check,
  AlertCircle,
  SlidersHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import EventCard from '@/components/events/EventCard';
import EmptyState from '@/components/common/EmptyState';
import { EventCardSkeleton } from '@/components/common/LoadingSkeleton';
import { useCalendarOccurrences } from '@/hooks/useEvents';
import { useFavorites, useToggleFavorite } from '@/hooks/useFavorites';
import { useAuthContext } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useAppMode } from '@/contexts/AppModeContext';
import { useSportsEvents } from '@/hooks/useSportsEvents';
import SportEventCard from '@/components/sports/SportEventCard';
import { getMadridDateKey } from '@/lib/calendarEntries';
import CalendarFilterDrawer from '@/components/calendar/CalendarFilterDrawer';
import {
  EMPTY_CALENDAR_FILTERS,
  applyCulturalFilters,
  applySportsFilters,
  availableCulturalGroups,
  availableSportCategories,
  countActiveGroups,
  type CalendarFilters,
} from '@/lib/calendarFilters';


const TIMEZONE = 'Europe/Madrid';
const LIST_PAGE_SIZE = 30;

const locales: Record<string, Locale> = {
  es, en: enUS, de, fr, it, pt, ja, zh: zhCN, ru,
};

const CalendarPage = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const locale = locales[i18n.language] || es;
  const { appMode } = useAppMode();
  const { isAuthenticated } = useAuthContext();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'list'>('month');
  const [eventSource, setEventSource] = useState<'all' | 'favorites'>('all');
  const [monthSelectorOpen, setMonthSelectorOpen] = useState(false);
  const [listLimit, setListLimit] = useState(LIST_PAGE_SIZE);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<CalendarFilters>(EMPTY_CALENDAR_FILTERS);
  const [draftFilters, setDraftFilters] = useState<CalendarFilters>(EMPTY_CALENDAR_FILTERS);


  // Localised month names for the popover selector
  const localisedMonths = useMemo(
    () => Array.from({ length: 12 }, (_, i) => format(new Date(2020, i, 1), 'MMMM', { locale })),
    [locale],
  );
  // Localised weekday labels, starting Monday
  const localisedWeekdays = useMemo(() => {
    const monday = startOfWeek(new Date(2024, 0, 1), { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return format(d, 'EEEEEE', { locale });
    });
  }, [locale]);

  // Grid range — week starts Monday
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const allGridDays = eachDayOfInterval({ start: gridStart, end: gridEnd });

  // Fetch (occurrences + published events) merged, for the visible grid range
  const {
    occurrences,
    isLoading,
    isError,
    refetch,
  } = useCalendarOccurrences(gridStart, gridEnd);

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

  // Reset source to "all" if user logs out while favorites tab is active
  useEffect(() => {
    if (!isAuthenticated && eventSource === 'favorites') setEventSource('all');
  }, [isAuthenticated, eventSource]);

  // Filter by source (all or favorites)
  const filteredOccurrences = useMemo(() => {
    if (appMode === 'deportes') return [];
    if (!occurrences) return [];
    if (eventSource === 'favorites' && favorites) {
      const favoriteIds = new Set(favorites.map((f) => f.event_id));
      return occurrences.filter((occ) => favoriteIds.has(occ.event_id));
    }
    return occurrences;
  }, [occurrences, eventSource, favorites, appMode]);

  // Apply user-chosen calendar filters (moment, categories, free, tickets)
  const visibleOccurrences = useMemo(
    () => applyCulturalFilters(filteredOccurrences, filters),
    [filteredOccurrences, filters],
  );


  // Sports events for the range — only in sports mode
  const sportGridStartStr = formatInTimeZone(gridStart, TIMEZONE, 'yyyy-MM-dd');
  const sportGridEndStr = formatInTimeZone(gridEnd, TIMEZONE, 'yyyy-MM-dd');
  const {
    data: sportEventsForMonth = [],
    isLoading: sportsLoading,
    isError: sportsError,
    refetch: refetchSports,
  } = useSportsEvents({
    fromDate: sportGridStartStr,
    toDate: sportGridEndStr,
    enabled: appMode === 'deportes',
  });

  const visibleSportEvents = useMemo(
    () => applySportsFilters(sportEventsForMonth, filters),
    [sportEventsForMonth, filters],
  );


  // Occurrences for a specific day (filters already applied)
  const getOccurrencesForDay = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    return visibleOccurrences.filter(
      (occ) => getMadridDateKey(occ.start_datetime) === dateKey,
    );
  };

  const getSportEventsForDay = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    return visibleSportEvents.filter(
      (e) => getMadridDateKey(e.start_at) === dateKey,
    );
  };

  // Count per day for the grid indicator (filters applied)
  const eventCountByDay = useMemo(() => {
    const map = new Map<string, number>();
    const bump = (key: string) => map.set(key, (map.get(key) || 0) + 1);
    if (appMode === 'deportes') {
      visibleSportEvents.forEach((e) => bump(getMadridDateKey(e.start_at)));
    } else {
      visibleOccurrences.forEach((occ) => bump(getMadridDateKey(occ.start_datetime)));
    }
    return map;
  }, [visibleOccurrences, visibleSportEvents, appMode]);

  const selectedDayOccurrences = selectedDate ? getOccurrencesForDay(selectedDate) : [];
  const selectedDaySportEvents = selectedDate ? getSportEventsForDay(selectedDate) : [];

  const goToMonth = (delta: number) => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta));
    setSelectedDate(null);
    setListLimit(LIST_PAGE_SIZE);
  };

  const goToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
    setListLimit(LIST_PAGE_SIZE);
  };

  const handleMonthSelect = (monthIndex: number) => {
    setCurrentDate((prev) => setMonth(prev, monthIndex));
    setSelectedDate(null);
    setListLimit(LIST_PAGE_SIZE);
    setMonthSelectorOpen(false);
  };

  const handleYearChange = (delta: number) => {
    setCurrentDate((prev) => setYear(prev, prev.getFullYear() + delta));
    setSelectedDate(null);
    setListLimit(LIST_PAGE_SIZE);
  };

  const handleDayClick = (day: Date) => {
    if (!isSameMonth(day, currentDate)) {
      // Tapping an adjacent-month cell changes the month too
      setCurrentDate(new Date(day.getFullYear(), day.getMonth(), 1));
      setListLimit(LIST_PAGE_SIZE);
    }
    setSelectedDate(day);
  };

  // Month-wide entries (whole current month, not just selected day) for List view
  const monthOccurrences = useMemo(() => {
    const start = format(monthStart, 'yyyy-MM-dd');
    const end = format(monthEnd, 'yyyy-MM-dd');
    return visibleOccurrences.filter((occ) => {
      const key = getMadridDateKey(occ.start_datetime);
      return key >= start && key <= end;
    });
  }, [visibleOccurrences, monthStart, monthEnd]);

  const monthSportEvents = useMemo(() => {
    const start = format(monthStart, 'yyyy-MM-dd');
    const end = format(monthEnd, 'yyyy-MM-dd');
    return visibleSportEvents.filter((e) => {
      const key = getMadridDateKey(e.start_at);
      return key >= start && key <= end;
    });
  }, [visibleSportEvents, monthStart, monthEnd]);

  // ----- Filter drawer inputs -----
  // Available categories in the current month (before user filters apply)
  const monthRawOccurrences = useMemo(() => {
    const start = format(monthStart, 'yyyy-MM-dd');
    const end = format(monthEnd, 'yyyy-MM-dd');
    return filteredOccurrences.filter((occ) => {
      const key = getMadridDateKey(occ.start_datetime);
      return key >= start && key <= end;
    });
  }, [filteredOccurrences, monthStart, monthEnd]);

  const monthRawSportEvents = useMemo(() => {
    const start = format(monthStart, 'yyyy-MM-dd');
    const end = format(monthEnd, 'yyyy-MM-dd');
    return sportEventsForMonth.filter((e) => {
      const key = getMadridDateKey(e.start_at);
      return key >= start && key <= end;
    });
  }, [sportEventsForMonth, monthStart, monthEnd]);

  const availableCategories = useMemo<string[]>(() => {
    return appMode === 'deportes'
      ? availableSportCategories(monthRawSportEvents)
      : availableCulturalGroups(monthRawOccurrences);
  }, [appMode, monthRawOccurrences, monthRawSportEvents]);

  // Preview count for the drawer footer, using the draft (or applied) filters
  const draftResultCount = useMemo(() => {
    if (appMode === 'deportes') {
      return applySportsFilters(monthRawSportEvents, draftFilters).length;
    }
    return applyCulturalFilters(monthRawOccurrences, draftFilters).length;
  }, [appMode, monthRawOccurrences, monthRawSportEvents, draftFilters]);

  const activeFilterGroups = countActiveGroups(filters);

  // Reset filters when switching between eventos/deportes
  useEffect(() => {
    setFilters(EMPTY_CALENDAR_FILTERS);
    setDraftFilters(EMPTY_CALENDAR_FILTERS);
  }, [appMode]);

  // Reset list pagination whenever the underlying dataset changes size or view
  useEffect(() => {
    setListLimit(LIST_PAGE_SIZE);
  }, [viewMode, currentDate, eventSource, appMode, filters]);


  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  // Loading + error states applicable to current mode
  const loading = appMode === 'deportes' ? sportsLoading : isLoading;
  const errored = appMode === 'deportes' ? sportsError : isError;
  const retry = () => (appMode === 'deportes' ? refetchSports() : refetch());

  const showFavoritesTab = isAuthenticated && appMode !== 'deportes';

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Calendario de eventos en Málaga"
        description="Calendario mensual con todos los eventos, conciertos y planes en Málaga capital y provincia. Filtra por día y descubre qué hacer."
        path="/calendar"
      />

      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-40 p-4">
        <div className="flex justify-between items-center mb-4 gap-2">
          <h1 className="text-xl font-bold truncate">{t('calendar.title')}</h1>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="h-11 px-3 font-semibold"
              onClick={goToday}
            >
              {t('calendar.today')}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="relative h-11 w-11 shrink-0"
              onClick={() => {
                setDraftFilters(filters);
                setFiltersOpen(true);
              }}
              aria-label="Afina tu agenda"
              aria-haspopup="dialog"
            >
              <SlidersHorizontal className="h-4 w-4" />
              {activeFilterGroups > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold leading-4 text-center tabular-nums"
                >
                  {activeFilterGroups}
                </span>
              )}
              <span className="sr-only">{activeFilterGroups > 0 ? `${activeFilterGroups} filtros activos` : 'Sin filtros'}</span>
            </Button>

            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'month' | 'list')}>
              <TabsList className="h-11">
                <TabsTrigger
                  value="month"
                  className="min-w-11 h-9 px-3"
                  aria-label={t('calendar.monthView')}
                >
                  <Grid3X3 className="h-4 w-4" />
                </TabsTrigger>
                <TabsTrigger
                  value="list"
                  className="min-w-11 h-9 px-3"
                  aria-label={t('calendar.listView')}
                >
                  <List className="h-4 w-4" />
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* Source selector — hidden when not authenticated */}
        {showFavoritesTab && (
          <Tabs value={eventSource} onValueChange={(v) => setEventSource(v as 'all' | 'favorites')}>
            <TabsList className="w-full h-11">
              <TabsTrigger value="all" className="flex-1 h-9">
                {t('calendar.allEvents')}
              </TabsTrigger>
              <TabsTrigger value="favorites" className="flex-1 h-9">
                {t('calendar.myFavorites')}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </header>

      <main className="p-4">
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-4">
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11"
            onClick={() => goToMonth(-1)}
            aria-label={t('calendar.prevMonth')}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>

          <Popover open={monthSelectorOpen} onOpenChange={setMonthSelectorOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                className="text-lg font-semibold capitalize gap-1 hover:bg-muted h-11"
                aria-label={t('calendar.openMonthSelector')}
              >
                {format(currentDate, 'MMMM yyyy', { locale })}
                <ChevronDown className={cn('h-4 w-4 transition-transform', monthSelectorOpen && 'rotate-180')} />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-64 p-0 bg-popover z-50"
              align="center"
              side="bottom"
              sideOffset={4}
              collisionPadding={16}
              avoidCollisions
            >
              <div className="flex items-center justify-between p-3 border-b">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11"
                  onClick={() => handleYearChange(-1)}
                  aria-label={t('calendar.prevYear')}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="font-semibold">{currentYear}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11"
                  onClick={() => handleYearChange(1)}
                  aria-label={t('calendar.nextYear')}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>

              </div>
              <ScrollArea className="h-auto max-h-64 overscroll-contain">
                <div className="grid grid-cols-3 gap-1 p-2" style={{ WebkitOverflowScrolling: 'touch' }}>
                  {localisedMonths.map((month, index) => {
                    const isSelected = index === currentMonth;
                    const now = new Date();
                    const isCurrentRealMonth = index === now.getMonth() && currentYear === now.getFullYear();
                    return (
                      <button
                        key={month}
                        onClick={() => handleMonthSelect(index)}
                        className={cn(
                          'relative px-2 py-2.5 min-h-11 text-sm rounded-md transition-colors capitalize',
                          'hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring',
                          isSelected && 'bg-primary text-primary-foreground hover:bg-primary/90',
                          !isSelected && isCurrentRealMonth && 'bg-primary/10 font-medium',
                          !isSelected && !isCurrentRealMonth && 'hover:bg-muted',
                        )}
                      >
                        {month.substring(0, 3)}
                        {isSelected && <Check className="absolute right-1 top-1/2 -translate-y-1/2 h-3 w-3" />}
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>

          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11"
            onClick={() => goToMonth(1)}
            aria-label={t('calendar.nextMonth')}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        {errored && (
          <Card className="mb-4 border-destructive/40">
            <CardContent className="py-6 text-center space-y-3">
              <AlertCircle className="h-6 w-6 mx-auto text-destructive" aria-hidden />
              <p className="text-sm text-muted-foreground">{t('calendar.loadError')}</p>
              <Button size="sm" onClick={retry}>{t('common.retry')}</Button>
            </CardContent>
          </Card>
        )}

        {viewMode === 'month' ? (
          <>
            {/* Calendar grid */}
            <Card className="mb-4">
              <CardContent className="p-2">
                <div className="grid grid-cols-7 mb-2" role="row">
                  {localisedWeekdays.map((day, i) => (
                    <div key={i} className="text-center text-xs font-medium text-muted-foreground py-2 capitalize" role="columnheader">
                      {day}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {allGridDays.map((day) => {
                    const dateKey = format(day, 'yyyy-MM-dd');
                    const count = eventCountByDay.get(dateKey) || 0;
                    const isSelected = !!(selectedDate && isSameDay(day, selectedDate));
                    const inMonth = isSameMonth(day, currentDate);
                    const today = isToday(day);

                    return (
                      <button
                        key={day.toISOString()}
                        onClick={() => handleDayClick(day)}
                        aria-pressed={isSelected}
                        aria-current={today ? 'date' : undefined}
                        aria-label={format(day, "EEEE d 'de' MMMM", { locale })}
                        className={cn(
                          'min-h-11 aspect-square rounded-lg flex flex-col items-center justify-center text-sm transition-colors relative',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          !inMonth && 'text-muted-foreground/70',
                          today && !isSelected && 'bg-primary/10 font-bold',
                          isSelected && 'bg-primary text-primary-foreground',
                          !isSelected && 'hover:bg-muted',
                        )}
                      >
                        <span>{format(day, 'd')}</span>
                        {count > 0 && (
                          <span
                            className={cn(
                              'text-[10px] leading-none font-semibold mt-0.5 tabular-nums',
                              isSelected ? 'text-primary-foreground/90' : 'text-primary',
                            )}
                          >
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Selected day panel */}
            {selectedDate && (
              <div className="space-y-4">
                <h3 className="font-semibold capitalize">
                  {format(selectedDate, "EEEE d 'de' MMMM", { locale })}
                </h3>

                {appMode === 'deportes' ? (
                  sportsLoading ? (
                    <div className="space-y-4">
                      <EventCardSkeleton />
                      <EventCardSkeleton />
                    </div>
                  ) : selectedDaySportEvents.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                      {selectedDaySportEvents.map((ev) => (
                        <SportEventCard key={ev.id} event={ev} />
                      ))}
                    </div>
                  ) : (
                    <EmptyDayCard
                      hasFilters={activeFilterGroups > 0}
                      onClear={() => setFilters(EMPTY_CALENDAR_FILTERS)}
                      t={t}
                    />
                  )

                ) : loading ? (
                  <div className="space-y-4">
                    <EventCardSkeleton />
                    <EventCardSkeleton />
                  </div>
                ) : selectedDayOccurrences.length > 0 ? (
                  selectedDayOccurrences.map((occ) => occ.event && (
                    <EventCard
                      key={occ.id}
                      event={{
                        ...occ.event,
                        start_at: occ.start_datetime,
                        end_at: occ.end_datetime,
                      }}
                      compact
                      isFavorite={isFavorite(occ.event_id)}
                      onToggleFavorite={handleToggleFavorite}
                    />
                  ))
                ) : (
                  <EmptyDayCard
                    hasFilters={activeFilterGroups > 0}
                    onClear={() => setFilters(EMPTY_CALENDAR_FILTERS)}
                    t={t}
                  />
                )}

              </div>
            )}
          </>
        ) : (
          /* List view — the WHOLE current month, grouped by date, paginated */
          <ListView
            appMode={appMode}
            loading={loading}
            monthOccurrences={monthOccurrences}
            monthSportEvents={monthSportEvents}
            locale={locale}
            listLimit={listLimit}
            onLoadMore={() => setListLimit((n) => n + LIST_PAGE_SIZE)}
            isFavorite={isFavorite}
            onToggleFavorite={handleToggleFavorite}
            hasActiveFilters={activeFilterGroups > 0}
            onClearFilters={() => setFilters(EMPTY_CALENDAR_FILTERS)}
            t={t}
          />

        )}
      </main>

      <CalendarFilterDrawer
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        mode={appMode === 'deportes' ? 'deportes' : 'eventos'}
        filters={filters}
        onApply={setFilters}
        onClear={() => {
          setFilters(EMPTY_CALENDAR_FILTERS);
          setDraftFilters(EMPTY_CALENDAR_FILTERS);
        }}
        onDraftChange={setDraftFilters}
        availableCategories={availableCategories}
        resultCount={draftResultCount}
      />
    </div>
  );
};


// -------- List view (month-wide, grouped by date) --------

type ListViewProps = {
  appMode: 'deportes' | 'eventos';
  loading: boolean;
  monthOccurrences: ReturnType<typeof useCalendarOccurrences>['occurrences'];
  monthSportEvents: ReturnType<typeof useSportsEvents>['data'];
  locale: Locale;
  listLimit: number;
  onLoadMore: () => void;
  isFavorite: (id: string) => boolean;
  onToggleFavorite: (id: string) => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  t: (key: string, opts?: any) => string;
};

const ListView = ({
  appMode,
  loading,
  monthOccurrences,
  monthSportEvents,
  locale,
  listLimit,
  onLoadMore,
  isFavorite,
  onToggleFavorite,
  hasActiveFilters,
  onClearFilters,
  t,
}: ListViewProps) => {
  if (loading) {
    return (
      <div className="space-y-4">
        <EventCardSkeleton />
        <EventCardSkeleton />
        <EventCardSkeleton />
      </div>
    );
  }

  const renderEmpty = () => (
    <div className="space-y-3">
      <EmptyState
        icon={CalendarIcon}
        title={hasActiveFilters ? 'Sin coincidencias con tus filtros' : t('calendar.monthEmpty')}
        description={hasActiveFilters ? 'Prueba a quitar algún filtro para ver más planes.' : t('events.noEventsDesc')}
      />
      {hasActiveFilters && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={onClearFilters} className="h-11 px-5">
            Limpiar filtros
          </Button>
        </div>
      )}
    </div>
  );

  if (appMode === 'deportes') {
    const items = (monthSportEvents ?? []).slice(0, listLimit);
    if (items.length === 0) return renderEmpty();
    const grouped = groupByDayKey(items, (e) => getMadridDateKey(e.start_at));
    return (
      <div className="space-y-6">
        {Object.entries(grouped).map(([key, evs]) => (
          <section key={key} className="space-y-3">
            <h3 className="font-semibold capitalize sticky top-[7.5rem] bg-background/95 backdrop-blur-none py-1 z-10">
              {format(parseDayKey(key), "EEEE d 'de' MMMM", { locale })}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {evs.map((ev) => (
                <SportEventCard key={ev.id} event={ev} />
              ))}
            </div>
          </section>
        ))}
        {(monthSportEvents ?? []).length > listLimit && (
          <div className="flex justify-center pt-2">
            <Button variant="outline" onClick={onLoadMore} className="h-11 px-5">
              {t('calendar.seeMore')}
            </Button>
          </div>
        )}
      </div>
    );
  }

  const items = monthOccurrences.slice(0, listLimit);
  if (items.length === 0) return renderEmpty();

  const grouped = groupByDayKey(items, (occ) => getMadridDateKey(occ.start_datetime));

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([key, occs]) => (
        <section key={key} className="space-y-3">
          <h3 className="font-semibold capitalize sticky top-[7.5rem] bg-background/95 py-1 z-10">
            {format(parseDayKey(key), "EEEE d 'de' MMMM", { locale })}
          </h3>
          <div className="space-y-3">
            {occs.map((occ) => occ.event && (
              <EventCard
                key={occ.id}
                event={{
                  ...occ.event,
                  start_at: occ.start_datetime,
                  end_at: occ.end_datetime,
                }}
                compact
                isFavorite={isFavorite(occ.event_id)}
                onToggleFavorite={onToggleFavorite}
              />
            ))}
          </div>
        </section>
      ))}
      {monthOccurrences.length > listLimit && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" onClick={onLoadMore} className="h-11 px-5">
            {t('calendar.seeMore')}
          </Button>
        </div>
      )}
    </div>
  );
};

function groupByDayKey<T>(items: T[], getKey: (item: T) => string): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const it of items) {
    const key = getKey(it);
    if (!out[key]) out[key] = [];
    out[key].push(it);
  }
  return out;
}

function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export default CalendarPage;

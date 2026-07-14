import { useState, useMemo } from 'react';
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
import { getDateLocale } from '@/i18n/dateLocale';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { ChevronLeft, ChevronRight, List, Grid3X3, Calendar, ChevronDown, Check } from 'lucide-react';
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

const TIMEZONE = 'Europe/Madrid';





const CalendarPage = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const locale = getDateLocale(i18n.language);
  const { appMode } = useAppMode();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'list'>('month');
  const [eventSource, setEventSource] = useState<'all' | 'favorites'>('all');
  const [monthSelectorOpen, setMonthSelectorOpen] = useState(false);
  const { isAuthenticated } = useAuthContext();

  // Calculate grid range (includes days from prev/next month visible in grid)
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  
  // All days in the month grid
  const allGridDays = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Fetch occurrences for the visible grid range
  const { data: occurrencesGrouped, occurrences, isLoading } = useCalendarOccurrences(gridStart, gridEnd);

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

  // Filter by source (all or favorites)
  const filteredOccurrences = useMemo(() => {
    if (appMode === 'deportes') return []; // Sports uses its own data
    if (!occurrences) return [];
    if (eventSource === 'favorites' && favorites) {
      const favoriteIds = new Set(favorites.map(f => f.event_id));
      return occurrences.filter(occ => favoriteIds.has(occ.event_id));
    }
    return occurrences;
  }, [occurrences, eventSource, favorites, appMode]);

  // Sports events from DB for current month range
  const sportGridStartStr = formatInTimeZone(gridStart, TIMEZONE, 'yyyy-MM-dd');
  const sportGridEndStr = formatInTimeZone(gridEnd, TIMEZONE, 'yyyy-MM-dd');
  const { data: sportEventsForMonth = [], isLoading: sportsLoading } = useSportsEvents(
    appMode === 'deportes'
      ? { fromDate: sportGridStartStr, toDate: sportGridEndStr }
      : { fromDate: '2099-01-01', toDate: '2099-01-01' } // no-op query when not in sports mode
  );

  // Get day of week for first day (0 = Sunday)
  const startDayOfWeek = monthStart.getDay();
  const emptyDays = Array.from({ length: startDayOfWeek }, (_, i) => i);

  // Get occurrences for a specific day (using Europe/Madrid timezone)
  const getOccurrencesForDay = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    return filteredOccurrences.filter((occ) => {
      const occDate = toZonedTime(new Date(occ.start_datetime), TIMEZONE);
      const occDateKey = format(occDate, 'yyyy-MM-dd');
      return occDateKey === dateKey;
    });
  };

  // Get sport events for a specific day
  const getSportEventsForDay = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    return sportEventsForMonth.filter(e => {
      const d = toZonedTime(new Date(e.start_at), TIMEZONE);
      return format(d, 'yyyy-MM-dd') === dateKey;
    });
  };

  // Get event count per day for the dots
  const daysWithEvents = useMemo(() => {
    const map = new Map<string, number>();
    if (appMode === 'deportes') {
      sportEventsForMonth.forEach(e => {
        const d = toZonedTime(new Date(e.start_at), TIMEZONE);
        const dateKey = format(d, 'yyyy-MM-dd');
        map.set(dateKey, (map.get(dateKey) || 0) + 1);
      });
    } else {
      filteredOccurrences.forEach(occ => {
        const occDate = toZonedTime(new Date(occ.start_datetime), TIMEZONE);
        const dateKey = format(occDate, 'yyyy-MM-dd');
        map.set(dateKey, (map.get(dateKey) || 0) + 1);
      });
    }
    return map;
  }, [filteredOccurrences, sportEventsForMonth, appMode]);

  const selectedDayOccurrences = selectedDate ? getOccurrencesForDay(selectedDate) : [];
  const selectedDaySportEvents = selectedDate ? getSportEventsForDay(selectedDate) : [];

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));

  // Handle month selection from dropdown
  const handleMonthSelect = (monthIndex: number) => {
    const newDate = setMonth(currentDate, monthIndex);
    setCurrentDate(newDate);
    setMonthSelectorOpen(false);
  };

  // Handle year change
  const handleYearChange = (delta: number) => {
    const newDate = setYear(currentDate, currentDate.getFullYear() + delta);
    setCurrentDate(newDate);
  };

  // For list view, get unique events from occurrences (deduped by event_id)
  const uniqueEventsForList = useMemo(() => {
    const seen = new Set<string>();
    return filteredOccurrences
      .filter(occ => {
        if (seen.has(occ.event_id)) return false;
        seen.add(occ.event_id);
        return true;
      })
      .map(occ => occ.event)
      .filter(Boolean);
  }, [filteredOccurrences]);

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={t('seo.calendar.title')}
        description={t('seo.calendar.description')}
        path="/calendar"
      />
      {/* Header — editorial */}
      <header className="bg-card border-b border-border sticky top-0 z-40 px-4 pt-4 pb-3">
        <div className="max-w-5xl mx-auto space-y-3">
          <div className="flex justify-between items-center gap-3">
            <h1 className="font-serif text-2xl sm:text-3xl leading-tight tracking-tight">{t('calendar.title')}</h1>
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'month' | 'list')}>
              <TabsList className="h-11">
                <TabsTrigger value="month" className="px-3 h-9" aria-label={t('calendar.viewMonth', 'Vista mes')}>
                  <Grid3X3 className="h-4 w-4" />
                </TabsTrigger>
                <TabsTrigger value="list" className="px-3 h-9" aria-label={t('calendar.viewList', 'Vista lista')}>
                  <List className="h-4 w-4" />
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Source selector */}
          <Tabs value={eventSource} onValueChange={(v) => setEventSource(v as 'all' | 'favorites')}>
            <TabsList className="w-full h-11">
              <TabsTrigger value="all" className="flex-1 h-9">{t('calendar.allEvents')}</TabsTrigger>
              <TabsTrigger value="favorites" className="flex-1 h-9">{t('calendar.myFavorites')}</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4">
        {viewMode === 'month' ? (
          <>
            {/* Month Navigation with Dropdown */}
            <div className="flex items-center justify-between mb-4 gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={prevMonth}
                className="h-11 w-11"
                aria-label={t('calendar.prevMonth', 'Mes anterior')}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>

              {/* Month/Year Selector */}
              <Popover open={monthSelectorOpen} onOpenChange={setMonthSelectorOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    className="min-h-11 px-3 text-lg font-semibold capitalize gap-1 hover:bg-muted"
                    aria-haspopup="dialog"
                    aria-expanded={monthSelectorOpen}
                    aria-label={t('calendar.selectMonth', 'Seleccionar mes y año')}
                  >
                    {format(currentDate, 'MMMM yyyy', { locale })}
                    <ChevronDown className={cn(
                      "h-4 w-4 transition-transform",
                      monthSelectorOpen && "rotate-180"
                    )} />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-72 p-0 bg-popover z-50"
                  align="center"
                  side="bottom"
                  sideOffset={4}
                  collisionPadding={16}
                  avoidCollisions={true}
                >
                  {/* Year Navigation */}
                  <div className="flex items-center justify-between p-2 border-b">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11"
                      onClick={() => handleYearChange(-1)}
                      aria-label={t('calendar.prevYear', 'Año anterior')}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="font-semibold text-base" aria-live="polite">{currentYear}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11"
                      onClick={() => handleYearChange(1)}
                      aria-label={t('calendar.nextYear', 'Año siguiente')}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Month Grid — locale-aware */}
                  <ScrollArea className="h-auto max-h-72 overscroll-contain">
                    <div
                      className="grid grid-cols-3 gap-1 p-2"
                      style={{ WebkitOverflowScrolling: 'touch' }}
                      role="listbox"
                      aria-label={t('calendar.months', 'Meses')}
                    >
                      {Array.from({ length: 12 }, (_, index) => {
                        const monthDate = setMonth(new Date(currentYear, 0, 1), index);
                        const monthLabel = format(monthDate, 'MMM', { locale });
                        const isSelected = index === currentMonth;
                        const isCurrentMonth = index === new Date().getMonth() && currentYear === new Date().getFullYear();

                        return (
                          <button
                            key={index}
                            role="option"
                            aria-selected={isSelected}
                            onClick={() => handleMonthSelect(index)}
                            className={cn(
                              "relative min-h-11 px-2 py-2 text-sm rounded-md capitalize transition-colors",
                              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              isSelected
                                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                                : isCurrentMonth
                                ? "bg-primary/10 font-medium hover:bg-primary/15"
                                : "hover:bg-muted"
                            )}
                          >
                            {monthLabel}
                            {isSelected && (
                              <Check className="absolute right-1 top-1/2 -translate-y-1/2 h-3 w-3" aria-hidden />
                            )}
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
                onClick={nextMonth}
                className="h-11 w-11"
                aria-label={t('calendar.nextMonth', 'Mes siguiente')}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>

            {/* Calendar Grid — reserve height while loading to avoid layout jumps */}
            <Card className="mb-4">
              <CardContent className="p-2">
                {/* Day headers */}
                <div className="grid grid-cols-7 mb-2">
                  {['D', 'L', 'M', 'X', 'J', 'V', 'S'].map((day, i) => (
                    <div key={i} className="text-center text-xs font-medium text-muted-foreground py-2">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Days */}
                <div
                  className="grid grid-cols-7 gap-1"
                  role="grid"
                  aria-label={format(currentDate, 'MMMM yyyy', { locale })}
                  aria-busy={isLoading || sportsLoading}
                >
                  {allGridDays.map((day) => {
                    const dateKey = format(day, 'yyyy-MM-dd');
                    const eventCount = daysWithEvents.get(dateKey) || 0;
                    const isSelected = selectedDate && isSameDay(day, selectedDate);
                    const hasEvents = eventCount > 0;
                    const inMonth = isSameMonth(day, currentDate);
                    const dayIsToday = isToday(day);

                    return (
                      <button
                        key={day.toISOString()}
                        onClick={() => setSelectedDate(day)}
                        aria-label={format(day, 'PPPP', { locale }) + (hasEvents ? `, ${eventCount} ${t('calendar.eventsShort', 'eventos')}` : '')}
                        aria-pressed={!!isSelected}
                        aria-current={dayIsToday ? 'date' : undefined}
                        className={cn(
                          'relative aspect-square min-h-[44px] rounded-lg flex flex-col items-center justify-center text-sm transition-colors',
                          'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          !inMonth && 'text-muted-foreground/70',
                          dayIsToday && !isSelected && 'ring-1 ring-primary/40 font-bold',
                          isSelected && 'bg-primary text-primary-foreground font-semibold shadow-sm',
                          !isSelected && 'hover:bg-muted'
                        )}
                      >
                        <span className={cn('leading-none', hasEvents && 'mb-1')}>{format(day, 'd')}</span>
                        {hasEvents && (
                          <span
                            aria-hidden
                            className={cn(
                              'absolute bottom-1 flex items-center gap-0.5',
                            )}
                          >
                            {Array.from({ length: Math.min(eventCount, 3) }).map((_, i) => (
                              <span
                                key={i}
                                className={cn(
                                  'w-1.5 h-1.5 rounded-full',
                                  isSelected ? 'bg-primary-foreground' : 'bg-primary'
                                )}
                              />
                            ))}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Selected Day Events */}
            {selectedDate && (
              <section className="space-y-3" aria-live="polite">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="font-serif text-xl capitalize leading-tight">
                    {format(selectedDate, 'PPPP', { locale })}
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    {(appMode === 'deportes' ? selectedDaySportEvents.length : selectedDayOccurrences.length)}{' '}
                    {t('calendar.eventsShort', 'eventos')}
                  </span>
                </div>
                {appMode === 'deportes' ? (
                  sportsLoading ? (
                    <div className="grid grid-cols-2 gap-3">
                      <EventCardSkeleton />
                      <EventCardSkeleton />
                    </div>
                  ) : selectedDaySportEvents.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                      {selectedDaySportEvents.map(ev => (
                        <SportEventCard key={ev.id} event={ev} />
                      ))}
                    </div>
                  ) : (
                    <Card className="bg-muted/40 border-dashed">
                      <CardContent className="py-5 text-center text-sm text-muted-foreground">
                        {t('calendar.noEventsDay')}
                      </CardContent>
                    </Card>
                  )
                ) : isLoading ? (
                  <div className="space-y-3">
                    <EventCardSkeleton />
                    <EventCardSkeleton />
                  </div>
                ) : selectedDayOccurrences.length > 0 ? (
                  <div className="space-y-3">
                    {selectedDayOccurrences.map((occ) => occ.event && (
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
                    ))}
                  </div>
                ) : (
                  <Card className="bg-muted/40 border-dashed">
                    <CardContent className="py-5 text-center text-sm text-muted-foreground">
                      {t('calendar.noEventsDay')}
                    </CardContent>
                  </Card>
                )}
              </section>
            )}
          </>
        ) : (

          /* List View - respects selectedDate */
          <div className="space-y-4">
            {selectedDate && (
              <h3 className="font-semibold capitalize">
                {format(selectedDate, 'PPPP', { locale })}
              </h3>
            )}
            {appMode === 'deportes' ? (() => {
              const dayEvents = selectedDate ? getSportEventsForDay(selectedDate) : sportEventsForMonth;
              return dayEvents.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {dayEvents.map(ev => (
                    <SportEventCard key={ev.id} event={ev} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Calendar}
                  title={selectedDate ? t('calendar.noEventsDay') : t('sports.noEvents')}
                  description={t('events.noEventsDesc')}
                />
              );
            })() : isLoading ? (
              <>
                <EventCardSkeleton />
                <EventCardSkeleton />
                <EventCardSkeleton />
              </>
            ) : (() => {
              const listOccurrences = selectedDate
                ? filteredOccurrences.filter(occ => {
                    const occDate = toZonedTime(new Date(occ.start_datetime), TIMEZONE);
                    return format(occDate, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
                  })
                : filteredOccurrences;

              return listOccurrences.length > 0 ? (
                listOccurrences.map((occ) => occ.event && (
                  <EventCard
                    key={occ.id}
                    event={{
                      ...occ.event,
                      start_at: occ.start_datetime,
                      end_at: occ.end_datetime,
                    }}
                    isFavorite={isFavorite(occ.event_id)}
                    onToggleFavorite={handleToggleFavorite}
                  />
                ))
              ) : (
                <EmptyState
                  icon={Calendar}
                  title={selectedDate ? t('calendar.noEventsDay') : t('events.noEvents')}
                  description={t('events.noEventsDesc')}
                />
              );
            })()}
          </div>
        )}
      </main>
    </div>
  );
};

export default CalendarPage;

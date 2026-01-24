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
import { es, enUS, de, fr, it, pt, ja, zhCN, ru, type Locale } from 'date-fns/locale';
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

const TIMEZONE = 'Europe/Madrid';

const locales: Record<string, Locale> = {
  es, en: enUS, de, fr, it, pt, ja, zh: zhCN, ru
};

// Month names for the selector
const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const CalendarPage = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const locale = locales[i18n.language] || es;
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
    if (!occurrences) return [];
    if (eventSource === 'favorites' && favorites) {
      const favoriteIds = new Set(favorites.map(f => f.event_id));
      return occurrences.filter(occ => favoriteIds.has(occ.event_id));
    }
    return occurrences;
  }, [occurrences, eventSource, favorites]);

  // Get day of week for first day (0 = Sunday)
  const startDayOfWeek = monthStart.getDay();
  const emptyDays = Array.from({ length: startDayOfWeek }, (_, i) => i);

  // Get occurrences for a specific day (using Europe/Madrid timezone)
  const getOccurrencesForDay = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    return filteredOccurrences.filter((occ) => {
      // Parse the occurrence datetime and convert to Madrid timezone
      const occDate = toZonedTime(new Date(occ.start_datetime), TIMEZONE);
      const occDateKey = format(occDate, 'yyyy-MM-dd');
      return occDateKey === dateKey;
    });
  };

  // Get event count per day for the dots
  const daysWithEvents = useMemo(() => {
    const map = new Map<string, number>();
    filteredOccurrences.forEach(occ => {
      const occDate = toZonedTime(new Date(occ.start_datetime), TIMEZONE);
      const dateKey = format(occDate, 'yyyy-MM-dd');
      map.set(dateKey, (map.get(dateKey) || 0) + 1);
    });
    return map;
  }, [filteredOccurrences]);

  const selectedDayOccurrences = selectedDate ? getOccurrencesForDay(selectedDate) : [];

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
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-40 p-4">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-bold">{t('calendar.title')}</h1>
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'month' | 'list')}>
            <TabsList className="h-8">
              <TabsTrigger value="month" className="px-2">
                <Grid3X3 className="h-4 w-4" />
              </TabsTrigger>
              <TabsTrigger value="list" className="px-2">
                <List className="h-4 w-4" />
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Source selector */}
        <Tabs value={eventSource} onValueChange={(v) => setEventSource(v as 'all' | 'favorites')}>
          <TabsList className="w-full">
            <TabsTrigger value="all" className="flex-1">{t('calendar.allEvents')}</TabsTrigger>
            <TabsTrigger value="favorites" className="flex-1">{t('calendar.myFavorites')}</TabsTrigger>
          </TabsList>
        </Tabs>
      </header>

      <main className="p-4">
        {viewMode === 'month' ? (
          <>
            {/* Month Navigation with Dropdown */}
            <div className="flex items-center justify-between mb-4">
              <Button variant="ghost" size="icon" onClick={prevMonth}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              
              {/* Month/Year Selector */}
              <Popover open={monthSelectorOpen} onOpenChange={setMonthSelectorOpen}>
                <PopoverTrigger asChild>
                  <Button 
                    variant="ghost" 
                    className="text-lg font-semibold capitalize gap-1 hover:bg-muted"
                  >
                    {format(currentDate, 'MMMM yyyy', { locale })}
                    <ChevronDown className={cn(
                      "h-4 w-4 transition-transform",
                      monthSelectorOpen && "rotate-180"
                    )} />
                  </Button>
                </PopoverTrigger>
                <PopoverContent 
                  className="w-64 p-0 bg-popover z-50" 
                  align="center"
                  side="bottom"
                  sideOffset={4}
                  collisionPadding={16}
                  avoidCollisions={true}
                >
                  {/* Year Navigation */}
                  <div className="flex items-center justify-between p-3 border-b">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8"
                      onClick={() => handleYearChange(-1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="font-semibold">{currentYear}</span>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8"
                      onClick={() => handleYearChange(1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {/* Month Grid */}
                  <ScrollArea className="h-auto max-h-64 overscroll-contain">
                    <div 
                      className="grid grid-cols-3 gap-1 p-2"
                      style={{ WebkitOverflowScrolling: 'touch' }}
                    >
                      {MONTHS.map((month, index) => {
                        const isSelected = index === currentMonth;
                        const isCurrentMonth = index === new Date().getMonth() && currentYear === new Date().getFullYear();
                        
                        return (
                          <button
                            key={month}
                            onClick={() => handleMonthSelect(index)}
                            className={cn(
                              "relative px-2 py-2.5 text-sm rounded-md transition-colors",
                              "hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring",
                              isSelected && "bg-primary text-primary-foreground hover:bg-primary/90",
                              !isSelected && isCurrentMonth && "bg-primary/10 font-medium",
                              !isSelected && !isCurrentMonth && "hover:bg-muted"
                            )}
                          >
                            {month.substring(0, 3)}
                            {isSelected && (
                              <Check className="absolute right-1 top-1/2 -translate-y-1/2 h-3 w-3" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
              
              <Button variant="ghost" size="icon" onClick={nextMonth}>
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>

            {/* Calendar Grid */}
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
                <div className="grid grid-cols-7 gap-1">
                  {emptyDays.map((_, i) => (
                    <div key={`empty-${i}`} className="aspect-square" />
                  ))}
                  {monthDays.map((day) => {
                    const dateKey = format(day, 'yyyy-MM-dd');
                    const eventCount = daysWithEvents.get(dateKey) || 0;
                    const isSelected = selectedDate && isSameDay(day, selectedDate);
                    const hasEvents = eventCount > 0;

                    return (
                      <button
                        key={day.toISOString()}
                        onClick={() => setSelectedDate(day)}
                        className={cn(
                          'aspect-square rounded-lg flex flex-col items-center justify-center text-sm transition-colors relative',
                          !isSameMonth(day, currentDate) && 'text-muted-foreground/50',
                          isToday(day) && 'bg-primary/10 font-bold',
                          isSelected && 'bg-primary text-primary-foreground',
                          !isSelected && 'hover:bg-muted'
                        )}
                      >
                        {format(day, 'd')}
                        {hasEvents && (
                          <span className={cn(
                            'absolute bottom-1 w-1.5 h-1.5 rounded-full',
                            isSelected ? 'bg-primary-foreground' : 'bg-primary'
                          )} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Selected Day Events */}
            {selectedDate && (
              <div className="space-y-4">
                <h3 className="font-semibold capitalize">
                  {format(selectedDate, "EEEE d 'de' MMMM", { locale })}
                </h3>
                {isLoading ? (
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
                        // Use occurrence start_datetime as the event's start_at for display
                        start_at: occ.start_datetime,
                        end_at: occ.end_datetime,
                      }} 
                      compact
                      isFavorite={isFavorite(occ.event_id)}
                      onToggleFavorite={handleToggleFavorite}
                    />
                  ))
                ) : (
                  <Card className="bg-muted/50 border-dashed">
                    <CardContent className="py-6 text-center text-muted-foreground">
                      {t('calendar.noEventsDay')}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </>
        ) : (
          /* List View */
          <div className="space-y-4">
            {isLoading ? (
              <>
                <EventCardSkeleton />
                <EventCardSkeleton />
                <EventCardSkeleton />
              </>
            ) : uniqueEventsForList.length > 0 ? (
              filteredOccurrences.map((occ) => occ.event && (
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
                title={t('events.noEvents')}
                description={t('events.noEventsDesc')}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default CalendarPage;

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday } from 'date-fns';
import { es, enUS, de, fr, it, pt, ja, zhCN, ru, type Locale } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, List, Grid3X3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import EventCard from '@/components/events/EventCard';
import EmptyState from '@/components/common/EmptyState';
import type { Event as EventType } from '@/types';

const locales: Record<string, Locale> = {
  es, en: enUS, de, fr, it, pt, ja, zh: zhCN, ru
};

// Mock events
const mockEvents: EventType[] = [
  {
    id: '1',
    title: 'Festival de Música',
    description: 'Concierto al aire libre',
    category: 'music',
    start_at: new Date().toISOString(),
    venue_name: 'Plaza Mayor',
    address: 'Plaza Mayor, Málaga',
    is_free: true,
    status: 'published',
    source_type: 'official_feed',
    created_at: new Date().toISOString(),
  },
  {
    id: '2',
    title: 'Exposición de Arte',
    description: 'Arte contemporáneo',
    category: 'art',
    start_at: new Date(Date.now() + 86400000 * 2).toISOString(),
    venue_name: 'Museo Picasso',
    address: 'Museo Picasso, Málaga',
    is_free: false,
    status: 'published',
    source_type: 'official_feed',
    created_at: new Date().toISOString(),
  },
];

const CalendarPage = () => {
  const { t, i18n } = useTranslation();
  const locale = locales[i18n.language] || es;
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<'month' | 'list'>('month');
  const [eventSource, setEventSource] = useState<'all' | 'favorites'>('all');

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get day of week for first day (0 = Sunday)
  const startDayOfWeek = monthStart.getDay();
  const emptyDays = Array.from({ length: startDayOfWeek }, (_, i) => i);

  const getEventsForDay = (date: Date) => {
    return mockEvents.filter((event) => isSameDay(new Date(event.start_at), date));
  };

  const selectedDayEvents = selectedDate ? getEventsForDay(selectedDate) : [];

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));

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
            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-4">
              <Button variant="ghost" size="icon" onClick={prevMonth}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <h2 className="text-lg font-semibold capitalize">
                {format(currentDate, 'MMMM yyyy', { locale })}
              </h2>
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
                  {days.map((day) => {
                    const dayEvents = getEventsForDay(day);
                    const isSelected = selectedDate && isSameDay(day, selectedDate);
                    const hasEvents = dayEvents.length > 0;

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
                            'absolute bottom-1 w-1 h-1 rounded-full',
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
                {selectedDayEvents.length > 0 ? (
                  selectedDayEvents.map((event) => (
                    <EventCard key={event.id} event={event} compact />
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
            {mockEvents.length > 0 ? (
              mockEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))
            ) : (
              <EmptyState
                icon={List}
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

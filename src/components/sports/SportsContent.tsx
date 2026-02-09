import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar } from 'lucide-react';
import { isToday, isWeekend, isSameDay, addDays, isBefore, isAfter, startOfDay } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import SportEventCard from '@/components/sports/SportEventCard';
import { MOCK_SPORT_EVENTS, SPORT_CATEGORIES, SPORT_ICONS } from '@/types/sports';
import type { SportCategory } from '@/types/sports';

type TimeFilter = 'today' | 'weekend' | 'upcoming';

const SportsContent = () => {
  const [selectedSport, setSelectedSport] = useState<SportCategory | 'all'>('all');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('upcoming');
  const { t } = useTranslation();

  const now = new Date();
  const today = startOfDay(now);
  const dayOfWeek = now.getDay(); // 0=Sun

  // Weekend logic (Europe/Madrid style)
  const getWeekendDays = () => {
    if (dayOfWeek === 5) return [today, addDays(today, 1), addDays(today, 2)]; // Fri
    if (dayOfWeek === 6) return [today, addDays(today, 1)]; // Sat
    if (dayOfWeek === 0) return [today]; // Sun
    // Mon-Thu: next weekend
    const daysToFri = (5 - dayOfWeek + 7) % 7;
    const fri = addDays(today, daysToFri);
    return [fri, addDays(fri, 1), addDays(fri, 2)];
  };

  const filtered = useMemo(() => {
    let events = MOCK_SPORT_EVENTS;

    if (selectedSport !== 'all') {
      events = events.filter(e => e.sport === selectedSport);
    }

    if (timeFilter === 'today') {
      events = events.filter(e => isToday(new Date(e.start_at)));
    } else if (timeFilter === 'weekend') {
      const weekendDays = getWeekendDays();
      events = events.filter(e => {
        const d = startOfDay(new Date(e.start_at));
        return weekendDays.some(wd => isSameDay(d, wd));
      });
    } else {
      // upcoming 14 days
      const limit = addDays(today, 14);
      events = events.filter(e => {
        const d = new Date(e.start_at);
        return !isBefore(d, today) && !isAfter(d, limit);
      });
    }

    return events;
  }, [selectedSport, timeFilter]);

  const timeFilters: { key: TimeFilter; label: string }[] = [
    { key: 'today', label: t('sports.today') },
    { key: 'weekend', label: t('sports.thisWeekend') },
    { key: 'upcoming', label: t('sports.upcoming') },
  ];

  return (
    <div className="space-y-4">
      {/* Time filters */}
      <div className="flex gap-2">
        {timeFilters.map(f => (
          <button
            key={f.key}
            onClick={() => setTimeFilter(f.key)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border',
              timeFilter === f.key
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background border-border text-muted-foreground hover:bg-muted'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Sport filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        <button
          onClick={() => setSelectedSport('all')}
          className={cn(
            'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border',
            selectedSport === 'all'
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background border-border text-muted-foreground hover:bg-muted'
          )}
        >
          🏅 {t('sports.all')}
        </button>
        {SPORT_CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedSport(cat)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border',
              selectedSport === cat
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background border-border text-muted-foreground hover:bg-muted'
            )}
          >
            {SPORT_ICONS[cat]} {t(`sports.${cat}`)}
          </button>
        ))}
      </div>

      {/* Results */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-2 gap-3">
          {filtered.map(event => (
            <SportEventCard key={event.id} event={event} />
          ))}
        </div>
      ) : (
        <Card className="bg-muted/50 border-dashed">
          <CardContent className="py-8 text-center text-muted-foreground">
            <Calendar className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">{t('sports.noEvents')}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SportsContent;

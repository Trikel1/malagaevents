import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, Loader2 } from 'lucide-react';
import { addDays } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import SportEventCard from '@/components/sports/SportEventCard';
import SportsVenuesDropdown from '@/components/sports/SportsVenuesDropdown';
import { useSportsEvents } from '@/hooks/useSportsEvents';
import { SPORT_CATEGORIES } from '@/types/sports';
import type { SportCategory } from '@/types/sports';
import SportIcon from '@/components/sports/SportIcon';
import { Trophy } from 'lucide-react';

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

const SportsContent = () => {
  const [selectedSport, setSelectedSport] = useState<SportCategory | 'all'>('all');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('upcoming');
  const [selectedVenueNames, setSelectedVenueNames] = useState<string[]>([]);
  const { t } = useTranslation();

  const filters = useMemo(() => {
    const today = todayMadrid();
    const f: any = {};

    if (timeFilter === 'today') {
      f.fromDate = today;
      f.toDate = today;
    } else if (timeFilter === 'weekend') {
      const wd = getWeekendDates();
      f.fromDate = wd.from;
      f.toDate = wd.to;
    } else {
      // upcoming 14 days
      f.fromDate = today;
      f.toDate = formatInTimeZone(addDays(new Date(), 14), TIMEZONE, 'yyyy-MM-dd');
    }

    if (selectedSport !== 'all') {
      f.categories = [selectedSport];
    }
    if (selectedVenueNames.length > 0) {
      f.venueNames = selectedVenueNames;
    }

    return f;
  }, [selectedSport, timeFilter, selectedVenueNames]);

  const { data: events = [], isLoading, isError } = useSportsEvents(filters);

  const timeFilters: { key: TimeFilter; label: string }[] = [
    { key: 'today', label: t('sports.today') },
    { key: 'weekend', label: t('sports.thisWeekend') },
    { key: 'upcoming', label: t('sports.upcoming') },
  ];

  return (
    <div className="space-y-4">
      {/* Time filters */}
      <div className="flex gap-2 flex-wrap">
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
        {/* Venues dropdown */}
        <SportsVenuesDropdown
          selectedVenueNames={selectedVenueNames}
          onSelectionChange={setSelectedVenueNames}
        />
      </div>

      {/* Sport filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        <button
          onClick={() => setSelectedSport('all')}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border',
            selectedSport === 'all'
              ? 'bg-primary/10 text-primary border-primary/30'
              : 'bg-background border-border text-muted-foreground hover:bg-muted hover:border-primary/20'
          )}
        >
          <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
          {t('sports.all')}
        </button>
        {SPORT_CATEGORIES.map((cat) => {
          const active = selectedSport === cat;
          return (
            <button
              key={cat}
              onClick={() => setSelectedSport(cat)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border',
                active
                  ? 'bg-primary/10 text-primary border-primary/30'
                  : 'bg-background border-border text-muted-foreground hover:bg-muted hover:border-primary/20'
              )}
            >
              <SportIcon sport={cat} className={cn('h-3.5 w-3.5', active ? 'text-primary' : 'text-muted-foreground')} />
              {t(`sports.${cat}`)}
            </button>
          );
        })}
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <Card className="bg-destructive/10 border-destructive/20">
          <CardContent className="py-8 text-center text-destructive">
            <p className="text-sm">{t('errors.generic')}</p>
          </CardContent>
        </Card>
      ) : events.length > 0 ? (
        <div className="grid grid-cols-2 gap-3">
          {events.map(event => (
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

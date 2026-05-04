import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Calendar, Loader2, MapPin, Building2, ChevronRight, CalendarDays, Sparkles } from 'lucide-react';
import { addDays } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  const navigate = useNavigate();

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
      f.fromDate = today;
      f.toDate = formatInTimeZone(addDays(new Date(), 14), TIMEZONE, 'yyyy-MM-dd');
    }

    if (selectedSport !== 'all') f.categories = [selectedSport];
    if (selectedVenueNames.length > 0) f.venueNames = selectedVenueNames;

    return f;
  }, [selectedSport, timeFilter, selectedVenueNames]);

  const { data: events = [], isLoading, isError } = useSportsEvents(filters);

  // Independent feeds for the home sections (highlights), kept lightweight.
  const todayDate = todayMadrid();
  const weekend = useMemo(getWeekendDates, []);
  const { data: todayEvents = [], isLoading: loadingToday } = useSportsEvents({
    fromDate: todayDate,
    toDate: todayDate,
  });
  const { data: weekendEvents = [], isLoading: loadingWeekend } = useSportsEvents({
    fromDate: weekend.from,
    toDate: weekend.to,
  });

  const quickActions = [
    {
      icon: Calendar,
      label: t('sports.today', 'Hoy'),
      onClick: () => setTimeFilter('today'),
    },
    {
      icon: CalendarDays,
      label: t('sports.thisWeekend', 'Este finde'),
      onClick: () => setTimeFilter('weekend'),
    },
    {
      icon: Sparkles,
      label: t('sports.upcoming', 'Próximos'),
      onClick: () => setTimeFilter('upcoming'),
    },
    {
      icon: Building2,
      label: t('nav.venues', 'Recintos'),
      onClick: () => navigate('/venues'),
    },
  ];

  const timeFilters: { key: TimeFilter; label: string }[] = [
    { key: 'today', label: t('sports.today') },
    { key: 'weekend', label: t('sports.thisWeekend') },
    { key: 'upcoming', label: t('sports.upcoming') },
  ];

  const renderEmpty = (msg: string) => (
    <Card className="bg-muted/50 border-dashed">
      <CardContent className="py-8 text-center text-muted-foreground">
        <Calendar className="h-10 w-10 mx-auto mb-2 opacity-50" />
        <p className="text-sm">{msg}</p>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-7">
      {/* Quick actions — sports themed */}
      <div className="grid grid-cols-4 gap-1 p-3 bg-card rounded-2xl shadow-card border border-border/60">
        {quickActions.map((action, i) => (
          <button
            key={i}
            onClick={action.onClick}
            className="flex flex-col items-center gap-2 py-2 px-1 group rounded-xl hover:bg-muted/60 active:scale-[0.97] transition-all min-h-[88px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <div className="h-11 w-11 flex items-center justify-center rounded-full bg-primary/10 group-hover:bg-primary/15 transition-colors">
              <action.icon className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <span className="text-xs font-medium text-foreground/85 group-hover:text-foreground text-center leading-tight line-clamp-2">
              {action.label}
            </span>
          </button>
        ))}
      </div>

      {/* Explore by sport */}
      <section>
        <h2 className="text-lg font-semibold tracking-tight mb-3">
          {t('sports.exploreBySport', 'Explorar deportes')}
        </h2>
        <div className="flex gap-2 overflow-x-auto pb-2 px-0.5 -mx-0.5 scrollbar-hide">
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
      </section>

      {/* Today highlights */}
      <section>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold">{t('sports.todayInSport', 'Hoy en deporte')}</h2>
          <Button
            variant="ghost"
            size="sm"
            className="text-primary gap-1"
            onClick={() => setTimeFilter('today')}
          >
            {t('common.seeAll')}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {loadingToday ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : todayEvents.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {todayEvents.slice(0, 4).map((event) => (
              <SportEventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          renderEmpty(t('sports.noEventsToday', 'Sin actividades deportivas hoy.'))
        )}
      </section>

      {/* Weekend highlights */}
      <section>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold">{t('sports.weekendSport', 'Deporte este finde')}</h2>
          <Button
            variant="ghost"
            size="sm"
            className="text-primary gap-1"
            onClick={() => setTimeFilter('weekend')}
          >
            {t('common.seeAll')}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {loadingWeekend ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : weekendEvents.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {weekendEvents.slice(0, 4).map((event) => (
              <SportEventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          renderEmpty(t('sports.noEventsWeekend', 'Sin actividades deportivas este fin de semana.'))
        )}
      </section>

      {/* Filtered results */}
      <section>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <h2 className="text-lg font-semibold mr-auto">
            {t('sports.allActivities', 'Todas las actividades')}
          </h2>
          <SportsVenuesDropdown
            selectedVenueNames={selectedVenueNames}
            onSelectionChange={setSelectedVenueNames}
          />
        </div>

        {/* Time filter chips */}
        <div className="flex gap-2 flex-wrap mb-3">
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
          renderEmpty(t('sports.noEvents'))
        )}
      </section>

      {/* Venues CTA */}
      <section className="pb-4">
        <Card className="bg-gradient-to-r from-primary/10 to-secondary/10 border-dashed">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-full bg-primary/15">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium">{t('sports.venuesTitle', 'Instalaciones deportivas')}</h3>
              <p className="text-sm text-muted-foreground">
                {t('sports.venuesDesc', 'Descubre recintos y polideportivos en Málaga.')}
              </p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => navigate('/venues')}>
              {t('common.explore', 'Explorar')}
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

export default SportsContent;

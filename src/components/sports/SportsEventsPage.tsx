import { useState, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, SlidersHorizontal, X, Calendar } from 'lucide-react';
import { addDays } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import SportEventCard from '@/components/sports/SportEventCard';
import SportsVenuesDropdown from '@/components/sports/SportsVenuesDropdown';
import { EventListSkeleton } from '@/components/common/LoadingSkeleton';
import { useSportsEvents } from '@/hooks/useSportsEvents';
import { SPORT_CATEGORIES, SPORT_ICONS } from '@/types/sports';
import type { SportCategory } from '@/types/sports';

const TIMEZONE = 'Europe/Madrid';

type TimeFilter = 'today' | 'weekend' | 'upcoming';

function todayMadrid(): string {
  return formatInTimeZone(new Date(), TIMEZONE, 'yyyy-MM-dd');
}

function getWeekendRange(): { from: string; to: string } {
  const today = new Date(todayMadrid() + 'T12:00:00');
  const dow = today.getDay(); // 0=Sun
  let fri: Date;

  if (dow === 5) fri = today; // Friday
  else if (dow === 6) fri = today; // Sat: show Sat-Sun only
  else if (dow === 0) fri = today; // Sun: show Sun only
  else fri = addDays(today, 5 - dow); // Mon-Thu: next Fri

  // Compute "to" based on current day
  let to: Date;
  if (dow === 0) to = today; // Sun only
  else if (dow === 6) to = addDays(today, 1); // Sat-Sun
  else to = addDays(fri, 2); // Fri-Sun

  return {
    from: formatInTimeZone(dow === 6 ? today : fri, TIMEZONE, 'yyyy-MM-dd'),
    to: formatInTimeZone(to, TIMEZONE, 'yyyy-MM-dd'),
  };
}

const SportsEventsPage = () => {
  const { t } = useTranslation();
  const [selectedSport, setSelectedSport] = useState<SportCategory | 'all'>('all');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('upcoming');
  const [selectedVenueNames, setSelectedVenueNames] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showSearchInput, setShowSearchInput] = useState(false);
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Debounce search
  useEffect(() => {
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    debounceTimeout.current = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => { if (debounceTimeout.current) clearTimeout(debounceTimeout.current); };
  }, [searchQuery]);

  useEffect(() => {
    if (showSearchInput && searchInputRef.current) searchInputRef.current.focus();
  }, [showSearchInput]);

  const filters = useMemo(() => {
    const today = todayMadrid();
    const f: any = {};

    if (timeFilter === 'today') {
      f.fromDate = today;
      f.toDate = today;
    } else if (timeFilter === 'weekend') {
      const wd = getWeekendRange();
      f.fromDate = wd.from;
      f.toDate = wd.to;
    } else {
      f.fromDate = today;
      f.toDate = formatInTimeZone(addDays(new Date(), 14), TIMEZONE, 'yyyy-MM-dd');
    }

    if (selectedSport !== 'all') f.categories = [selectedSport];
    if (selectedVenueNames.length > 0) f.venueNames = selectedVenueNames;
    if (debouncedSearch.trim()) f.q = debouncedSearch.trim();

    return f;
  }, [selectedSport, timeFilter, selectedVenueNames, debouncedSearch]);

  const { data: events = [], isLoading } = useSportsEvents(filters);

  const timeFilters: { key: TimeFilter; label: string }[] = [
    { key: 'today', label: t('sports.today', 'Hoy') },
    { key: 'weekend', label: t('sports.thisWeekend', 'Este finde') },
    { key: 'upcoming', label: t('sports.upcoming', 'Próximos') },
  ];

  const clearAllFilters = () => {
    setSelectedSport('all');
    setTimeFilter('upcoming');
    setSelectedVenueNames([]);
    setSearchQuery('');
    setDebouncedSearch('');
    setShowSearchInput(false);
  };

  const totalActiveFilters =
    (selectedSport !== 'all' ? 1 : 0) +
    selectedVenueNames.length +
    (debouncedSearch ? 1 : 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-40">
        <div className="p-4 space-y-3">
          {/* Row 1: Recintos + Filtros + Buscar */}
          <div className="flex items-center justify-center gap-2">
            <div className="flex-1 flex justify-center">
              <SportsVenuesDropdown
                selectedVenueNames={selectedVenueNames}
                onSelectionChange={setSelectedVenueNames}
              />
            </div>

            <div className="flex-1 flex justify-center">
              <Button
                variant={showSearchInput ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setShowSearchInput(!showSearchInput)}
                className="h-9 px-3 gap-1.5 whitespace-nowrap"
              >
                <Search className="h-4 w-4 shrink-0" />
                <span className="text-sm">{t('common.search', 'Buscar')}</span>
              </Button>
            </div>
          </div>

          {/* Clear filters */}
          {totalActiveFilters > 0 && (
            <div className="flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="text-muted-foreground h-7 px-2 text-xs"
              >
                <X className="h-3.5 w-3.5 mr-1" />
                {t('events.clearFilters', 'Limpiar filtros')}
              </Button>
            </div>
          )}

          {/* Search input */}
          {showSearchInput && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                type="search"
                placeholder={t('common.search', 'Buscar')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-10"
              />
              {searchQuery && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                  onClick={() => { setSearchQuery(''); setDebouncedSearch(''); }}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}

          {/* Time filter chips */}
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
          </div>

          {/* Sport category chips */}
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
              🏅 {t('sports.all', 'Todos')}
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
                {SPORT_ICONS[cat]} {t(`sports.${cat}`, cat)}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="p-4">
        {isLoading ? (
          <EventListSkeleton count={4} />
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
              <p className="text-sm">{t('sports.noEvents', 'No hay eventos deportivos')}</p>
              <p className="text-xs mt-2 opacity-70">
                Si eres admin, ve a Admin &gt; Deportes y pulsa &quot;Sync Deportes ahora&quot;.
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default SportsEventsPage;

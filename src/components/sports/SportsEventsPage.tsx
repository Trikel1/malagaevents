import { useState, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, X, Calendar, Trophy, MapPinned, Activity } from 'lucide-react';
import { addDays } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import SportEventCard from '@/components/sports/SportEventCard';
import SportsVenuesDropdown from '@/components/sports/SportsVenuesDropdown';
import { EventListSkeleton } from '@/components/common/LoadingSkeleton';
import { useSportsEvents } from '@/hooks/useSportsEvents';
import { useMunicipalities } from '@/hooks/useMunicipalities';
import { SPORT_CATEGORIES } from '@/types/sports';
import SportIcon from '@/components/sports/SportIcon';
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
  const [selectedMunicipality, setSelectedMunicipality] = useState('all');
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { data: municipalities = [] } = useMunicipalities();
  const municipalityNames = useMemo(() => {
    const names = municipalities.map((m) => m.name).filter(Boolean);
    return names.length ? names : ['Málaga', 'Marbella', 'Fuengirola', 'Benalmádena', 'Torremolinos'];
  }, [municipalities]);

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
    if (selectedMunicipality !== 'all') f.cities = [selectedMunicipality];
    if (debouncedSearch.trim()) f.q = debouncedSearch.trim();

    return f;
  }, [selectedSport, timeFilter, selectedVenueNames, selectedMunicipality, debouncedSearch]);

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
    setSelectedMunicipality('all');
    setSearchQuery('');
    setDebouncedSearch('');
    setShowSearchInput(false);
  };

  const totalActiveFilters =
    (selectedSport !== 'all' ? 1 : 0) +
    selectedVenueNames.length +
    (selectedMunicipality !== 'all' ? 1 : 0) +
    (debouncedSearch ? 1 : 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-gradient-to-br from-slate-950 via-slate-900 to-primary/80 text-white border-b border-slate-800 sticky top-0 z-40">
        <div className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200">Agenda deportiva</p>
              <h1 className="mt-1 font-display text-2xl font-bold tracking-tight">Deporte en Málaga</h1>
              <p className="mt-1 text-xs text-slate-300">Competiciones, actividad local y recintos de toda la provincia.</p>
            </div>
            <div className="hidden sm:flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-3 py-2 text-xs text-slate-200">
              <Activity className="h-4 w-4 text-cyan-200" aria-hidden="true" />
              <span>En movimiento</span>
            </div>
          </div>
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
                className="h-9 px-3 gap-1.5 whitespace-nowrap text-white hover:bg-white/10"
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

          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide" aria-label="Filtrar por municipio">
            <button
              type="button"
              onClick={() => setSelectedMunicipality('all')}
              aria-pressed={selectedMunicipality === 'all'}
              className={cn('inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-full text-xs font-semibold whitespace-nowrap border transition-colors', selectedMunicipality === 'all' ? 'bg-white text-slate-900 border-white' : 'bg-white/10 text-white border-white/20 hover:bg-white/15')}
            >
              <MapPinned className="h-3.5 w-3.5" aria-hidden="true" /> Toda la provincia
            </button>
            {municipalityNames.map((name) => (
              <button
                type="button"
                key={name}
                onClick={() => setSelectedMunicipality(selectedMunicipality === name ? 'all' : name)}
                aria-pressed={selectedMunicipality === name}
                className={cn('inline-flex items-center min-h-[44px] px-3 rounded-full text-xs font-medium whitespace-nowrap border transition-colors', selectedMunicipality === name ? 'bg-cyan-300 text-slate-950 border-cyan-200' : 'bg-white/10 text-slate-100 border-white/20 hover:bg-white/15')}
              >
                {name}
              </button>
            ))}
          </div>

          {/* Sport category chips */}
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
              {t('sports.all', 'Todos')}
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
                  {t(`sports.${cat}`, cat)}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto w-full max-w-[1240px] p-4 sm:p-6 lg:p-8">
        {!isLoading && (
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">{selectedMunicipality === 'all' ? 'Málaga y provincia' : selectedMunicipality}</p>
              <h2 className="mt-1 text-lg font-semibold">Actividad deportiva</h2>
            </div>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{events.length} resultados</span>
          </div>
        )}
        {isLoading ? (
          <EventListSkeleton count={4} />
        ) : events.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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

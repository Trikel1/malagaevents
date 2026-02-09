import { useState, useMemo } from 'react';
import { Calendar } from 'lucide-react';
import { isToday, isWeekend, isSameDay, addDays } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import SportEventCard from '@/components/sports/SportEventCard';
import { MOCK_SPORT_EVENTS, SPORT_CATEGORIES, SPORT_ICONS, SPORT_LABELS } from '@/types/sports';
import type { SportCategory } from '@/types/sports';

const SportsContent = () => {
  const [selectedSport, setSelectedSport] = useState<SportCategory | 'all'>('all');

  const filtered = useMemo(() => {
    if (selectedSport === 'all') return MOCK_SPORT_EVENTS;
    return MOCK_SPORT_EVENTS.filter(e => e.sport === selectedSport);
  }, [selectedSport]);

  // For demo purposes, treat "today" as any event and split by weekend
  const now = new Date();
  const friday = addDays(now, ((5 - now.getDay() + 7) % 7) || 7);
  const saturday = addDays(friday, 1);
  const sunday = addDays(friday, 2);

  const todayEvents = filtered.filter(e => {
    const d = new Date(e.start_at);
    return isToday(d);
  });

  const weekendEvents = filtered.filter(e => {
    const d = new Date(e.start_at);
    return isSameDay(d, friday) || isSameDay(d, saturday) || isSameDay(d, sunday) || isWeekend(d);
  });

  // If no today events, show all as "Próximos"
  const showToday = todayEvents.length > 0;

  return (
    <div className="space-y-6">
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
          🏅 Todos
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
            {SPORT_ICONS[cat]} {SPORT_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Today */}
      {showToday && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Hoy</h2>
          <div className="grid grid-cols-2 gap-3">
            {todayEvents.map(event => (
              <SportEventCard key={event.id} event={event} />
            ))}
          </div>
        </section>
      )}

      {/* Weekend */}
      <section>
        <h2 className="text-lg font-semibold mb-3">
          {showToday ? 'Este fin de semana' : 'Próximos eventos'}
        </h2>
        {weekendEvents.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {weekendEvents.map(event => (
              <SportEventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <Card className="bg-muted/50 border-dashed">
            <CardContent className="py-8 text-center text-muted-foreground">
              <Calendar className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No hay eventos deportivos próximos</p>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
};

export default SportsContent;

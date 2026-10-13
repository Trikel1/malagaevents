import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { dateLocale } from '@/lib/dateLocale';
import { madridDayKey, addDaysToKey, formatMadrid } from '@/lib/madridTime';
import EventCard from '@/components/events/EventCard';
import type { Event } from '@/types';

interface GroupedEventsListProps {
  events: Event[];
  isFavorite: (eventId: string) => boolean;
  onToggleFavorite: (eventId: string) => void;
}

type Bucket = {
  key: string;
  label: string;
  date: Date;
  items: Event[];
};

/**
 * Groups events into day buckets ("Hoy", "Mañana", "Vie 17 nov", …) and
 * renders each bucket as a 2-column dense card grid.
 *
 * Uses ONLY the events already returned by the query — no fetching, no
 * fabrication. Skips events whose start date is unparsable.
 */
const GroupedEventsList = ({
  events,
  isFavorite,
  onToggleFavorite,
}: GroupedEventsListProps) => {
  const { t, i18n } = useTranslation();

  const buckets = useMemo<Bucket[]>(() => {
    const map = new Map<string, Bucket>();
    for (const event of events) {
      const d = new Date(event.start_at);
      if (Number.isNaN(d.getTime())) continue;
      const key = madridDayKey(d);
      let bucket = map.get(key);
      if (!bucket) {
        bucket = {
          key,
          label: labelFor(d, t, i18n.language),
          date: new Date(`${key}T12:00:00Z`),
          items: [],
        };
        map.set(key, bucket);
      }
      bucket.items.push(event);
    }
    return Array.from(map.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [events, t, i18n.language]);

  return (
    <div className="space-y-6">
      {buckets.map((bucket) => (
        <section key={bucket.key} aria-labelledby={`day-${bucket.key}`}>
          <div className="sticky top-[var(--events-header-h,0px)] z-10 -mx-4 px-4 py-1.5 bg-background/85 backdrop-blur-md">
            <div className="flex items-baseline justify-between gap-3">
              <h3
                id={`day-${bucket.key}`}
                className="text-sm font-semibold uppercase tracking-wide text-foreground"
              >
                {bucket.label}
              </h3>
              <span className="text-[11px] text-muted-foreground font-medium">
                {bucket.items.length}{' '}
                {bucket.items.length === 1
                  ? t('events.eventSingular', 'evento')
                  : t('events.eventPlural', 'eventos')}
              </span>
            </div>
            <div className="mt-1 h-px bg-gradient-to-r from-primary/40 via-border to-transparent" />
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            {bucket.items.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                dense
                isFavorite={isFavorite(event.id)}
                onToggleFavorite={onToggleFavorite}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};

function labelFor(d: Date, t: TFunction, language: string): string {
  if (madridDayKey(d) === madridDayKey()) return t('events.today', 'Hoy');
  if (madridDayKey(d) === addDaysToKey(madridDayKey(), 1)) return t('events.tomorrow', 'Mañana');
  const label = formatMadrid(d, language.startsWith('es') ? "EEE d 'de' MMM" : 'EEE d MMM', dateLocale(language));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export default GroupedEventsList;

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { CalendarDays, MapPin, Ticket, ChevronRight } from 'lucide-react';

import EventImage from '@/components/events/EventImage';
import { EventCardSkeleton } from '@/components/common/LoadingSkeleton';
import { useEvents } from '@/hooks/useEvents';
import { formatMadrid } from '@/lib/madridTime';

interface FeaturedEventProps {
  /** Reports the featured event id so other Home sections can avoid repeating it. */
  onSelect?: (id: string | null) => void;
}

/**
 * First useful block of the Home screen: one real upcoming event with its own
 * poster when there is one. Never fabricated — if the agenda is empty the
 * section stays silent and the rest of Home keeps working.
 */
const FeaturedEvent = ({ onSelect }: FeaturedEventProps) => {
  const { t } = useTranslation();
  const { data, isLoading } = useEvents({ limit: 8 });

  const events = data ?? [];
  const featured = events.find((e) => Boolean(e.image_url)) ?? events[0] ?? null;

  useEffect(() => {
    onSelect?.(featured?.id ?? null);
  }, [featured?.id, onSelect]);

  // Compact placeholder: the old one reserved a full-width 21:9 block that
  // pushed everything below the fold on a desktop screen.
  if (isLoading) {
    return (
      <div className="glass-card overflow-hidden p-3 sm:p-4" aria-hidden>
        <div className="grid gap-3 sm:gap-4 md:grid-cols-[minmax(0,320px)_1fr] md:items-center">
          <div className="aspect-[16/9] w-full rounded-xl bg-muted animate-pulse" />
          <div className="space-y-2">
            <div className="h-4 w-24 rounded bg-muted animate-pulse" />
            <div className="h-5 w-3/4 rounded bg-muted animate-pulse" />
            <div className="h-4 w-1/2 rounded bg-muted animate-pulse" />
          </div>
        </div>
      </div>
    );
  }
  if (!featured) return null;

  const isToday =
    formatMadrid(new Date(featured.start_at), 'yyyy-MM-dd') === formatMadrid(new Date(), 'yyyy-MM-dd');

  return (
    <section aria-labelledby="featured-event-title" className="glass-card overflow-hidden">
      <Link
        to={`/events/${featured.id}`}
        className="grid md:grid-cols-[minmax(0,340px)_1fr] md:items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-2xl"
      >
        {/* Real poster only; on desktop it sits beside the text instead of
            filling the whole first screen. */}
        <div className="md:p-3 md:pr-0">
          <div className="md:rounded-xl md:overflow-hidden">
            <EventImage
              src={featured.image_url}
              alt={featured.title}
              variant="card"
              category={featured.category}
              priority
            />
          </div>
        </div>
        <div className="p-4 sm:p-5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/12 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
            {isToday ? t('home.featured.badgeToday') : t('home.featured.badgeNext')}
          </span>
          <h2 id="featured-event-title" className="mt-2 text-lg sm:text-xl font-bold tracking-tight leading-tight">
            {featured.title}
          </h2>
          <div className="mt-2 space-y-1 text-[13px] text-muted-foreground">
            <p className="flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />
              <span className="capitalize">
                {formatMadrid(new Date(featured.start_at), "EEEE d 'de' MMMM · HH:mm")}
              </span>
            </p>
            {featured.venue_name && (
              <p className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4 shrink-0" aria-hidden />
                <span className="truncate">{featured.venue_name}</span>
              </p>
            )}
            <p className="flex items-center gap-1.5">
              <Ticket className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate">
                {featured.is_free
                  ? t('home.featured.free')
                  : featured.price_info || t('home.featured.priceUnknown')}
              </span>
            </p>
          </div>
          <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary">
            {t('home.featured.cta')}
            <ChevronRight className="h-4 w-4" aria-hidden />
          </span>
        </div>
      </Link>
    </section>
  );
};

export default FeaturedEvent;

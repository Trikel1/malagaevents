import { useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { format, isToday, isTomorrow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import EventImage from '@/components/events/EventImage';
import { sanitizeText, generateAltText } from '@/lib/sanitize';
import { hasExplicitTime } from '@/lib/eventTime';
import type { Event } from '@/types';

interface UpcomingHighlightsProps {
  events: Event[];
  maxItems?: number;
}

/**
 * "Destacados próximos" — a curated horizontal-scroll strip of the next few
 * upcoming real events, shown right above the main grouped list. Never
 * invents data: purely a re-projection of the events already returned by
 * useEventsOptimized. If the list is empty (no future items at all), the
 * component renders nothing.
 */
const UpcomingHighlights = ({ events, maxItems = 6 }: UpcomingHighlightsProps) => {
  const { t } = useTranslation();
  const scrollerRef = useRef<HTMLDivElement>(null);

  const items = useMemo(() => {
    const now = Date.now();
    const future = events.filter((e) => {
      const t = new Date(e.start_at).getTime();
      return !Number.isNaN(t) && t >= now - 6 * 3600 * 1000; // include today onward
    });
    // Rank: events with a real image first, then earliest date
    const scored = future.map((e) => ({
      e,
      score: (e.image_url ? 0 : 1) * 100 + new Date(e.start_at).getTime() / 1e9,
    }));
    scored.sort((a, b) => a.score - b.score);
    return scored.slice(0, maxItems).map((s) => s.e);
  }, [events, maxItems]);

  if (items.length === 0) return null;

  const scrollBy = (dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: 'smooth' });
  };

  return (
    <section aria-labelledby="upcoming-highlights-title" className="mb-5">
      <div className="flex items-center justify-between mb-2 px-1">
        <h2
          id="upcoming-highlights-title"
          className="text-base sm:text-lg font-semibold flex items-center gap-1.5"
        >
          <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
          {t('events.upcomingHighlights', 'Destacados próximos')}
        </h2>
        <div className="hidden sm:flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label={t('common.scrollLeft', 'Anterior')}
            onClick={() => scrollBy(-1)}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label={t('common.scrollRight', 'Siguiente')}
            onClick={() => scrollBy(1)}
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div
        ref={scrollerRef}
        className={cn(
          'flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory',
          '[-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        )}
      >
        {items.map((event) => (
          <HighlightCard key={event.id} event={event} />
        ))}
      </div>
    </section>
  );
};

const HighlightCard = ({ event }: { event: Event }) => {
  const { t } = useTranslation();
  const startDate = new Date(event.start_at);
  const showTime = hasExplicitTime(event.start_at);

  const dayBadge = isToday(startDate)
    ? t('events.today', 'Hoy')
    : isTomorrow(startDate)
      ? t('events.tomorrow', 'Mañana')
      : format(startDate, "EEE d MMM", { locale: es });

  const timeLabel = showTime
    ? format(startDate, 'HH:mm', { locale: es })
    : t('events.timeTBC', 'Hora por confirmar');

  const title = sanitizeText(event.title) || t('events.untitled', 'Sin título');
  const venue = sanitizeText(event.venue?.name || event.venue_name || '') || null;
  const locality =
    sanitizeText(event.location?.name || event.location_normalized || event.province || '') || null;

  return (
    <Link
      to={`/events/${event.id}`}
      className="group snap-start shrink-0 w-[70%] sm:w-[46%] md:w-[32%] lg:w-[24%]"
      aria-label={`${title}, ${dayBadge}${showTime ? `, ${timeLabel}` : ''}`}
    >
      <article className="rounded-2xl overflow-hidden border border-border/60 bg-card shadow-soft hover:shadow-card transition-all duration-300 hover:-translate-y-0.5 h-full flex flex-col">
        <div className="relative">
          <EventImage
            src={event.image_url}
            alt={generateAltText(event.title, event.venue_name)}
            variant="card"
            category={event.category}
            aspectRatio="16/9"
            className="group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/60 via-black/20 to-transparent pointer-events-none" />
          <div className="absolute top-2 left-2 flex flex-col gap-1.5">
            <Badge className="bg-primary text-primary-foreground shadow-sm capitalize">
              {dayBadge}
            </Badge>
            {event.is_free && (
              <Badge className="bg-green-500 hover:bg-green-500 text-[10px]">
                {t('common.free', 'Gratis')}
              </Badge>
            )}
          </div>
          <span className="absolute bottom-2 left-2 text-xs font-semibold text-white/95 drop-shadow">
            {timeLabel}
          </span>
        </div>
        <div className="p-3 flex flex-col gap-1 flex-1">
          <h3 className="text-sm font-semibold line-clamp-2 leading-snug">{title}</h3>
          {(venue || locality) && (
            <p className="text-[11px] text-muted-foreground truncate">
              {[venue, locality].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      </article>
    </Link>
  );
};

export default UpcomingHighlights;

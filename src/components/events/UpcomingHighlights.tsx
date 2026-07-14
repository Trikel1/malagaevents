import { useMemo, useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { format, isToday, isTomorrow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Sparkles, Pause, Play } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import EventImage from '@/components/events/EventImage';
import { sanitizeText, generateAltText } from '@/lib/sanitize';
import { hasExplicitTime } from '@/lib/eventTime';
import type { Event } from '@/types';

interface UpcomingHighlightsProps {
  events: Event[];
  /** Optional cap. When omitted, shows every future event. */
  maxItems?: number;
}

/**
 * "Destacados próximos" — auto-scrolling marquee of upcoming real events.
 * Purely a re-projection of events already loaded; never invents data.
 * Pauses on hover / focus and respects prefers-reduced-motion.
 */
const UpcomingHighlights = ({ events, maxItems }: UpcomingHighlightsProps) => {
  const { t } = useTranslation();
  // Sprint UI 5: no aggressive auto-motion. The strip renders as a swipeable
  // list by default; the Pause/Play toggle lets users opt into the marquee.
  const [paused, setPaused] = useState(true);
  const trackRef = useRef<HTMLDivElement>(null);

  const items = useMemo(() => {
    const now = Date.now();
    const future = events.filter((e) => {
      const t = new Date(e.start_at).getTime();
      return !Number.isNaN(t) && t >= now - 6 * 3600 * 1000;
    });
    const scored = future.map((e) => ({
      e,
      score: (e.image_url ? 0 : 1) * 100 + new Date(e.start_at).getTime() / 1e9,
    }));
    scored.sort((a, b) => a.score - b.score);
    const limited = typeof maxItems === 'number' ? scored.slice(0, maxItems) : scored;
    return limited.map((s) => s.e);
  }, [events, maxItems]);

  // Auto-pause when user interacts with the strip (touch, wheel, pointer drag).
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const pause = () => setPaused(true);
    el.addEventListener('touchstart', pause, { passive: true });
    el.addEventListener('wheel', pause, { passive: true });
    el.addEventListener('pointerdown', pause);
    return () => {
      el.removeEventListener('touchstart', pause);
      el.removeEventListener('wheel', pause);
      el.removeEventListener('pointerdown', pause);
    };
  }, []);

  if (items.length === 0) return null;

  // When playing we duplicate the list so the marquee loop is seamless.
  // When paused we render the list once and let the user scroll manually.
  const loop = paused ? items : [...items, ...items];
  const durationSec = Math.max(24, Math.min(120, items.length * 6));

  return (
    <section aria-labelledby="upcoming-highlights-title" className="mb-5">
      <div className="flex items-center justify-between mb-2">
        <h2
          id="upcoming-highlights-title"
          className="text-sm sm:text-base font-semibold flex items-center gap-1.5"
        >
          <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
          {t('events.upcomingHighlights', 'Destacados próximos')}
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            aria-pressed={paused}
            aria-label={
              paused
                ? t('events.resumeCarousel', 'Reanudar carrusel')
                : t('events.pauseCarousel', 'Pausar carrusel')
            }
            className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/70 backdrop-blur px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground hover:border-border transition-colors"
          >
            {paused ? (
              <>
                <Play className="h-3 w-3" aria-hidden="true" />
                {t('events.play', 'Reanudar')}
              </>
            ) : (
              <>
                <Pause className="h-3 w-3" aria-hidden="true" />
                {t('events.pause', 'Pausar')}
              </>
            )}
          </button>
          <span className="text-[11px] text-muted-foreground">{items.length}</span>
        </div>
      </div>

      <div
        className="highlights-marquee relative"
        style={{
          maskImage:
            'linear-gradient(to right, transparent 0, #000 24px, #000 calc(100% - 24px), transparent 100%)',
          WebkitMaskImage:
            'linear-gradient(to right, transparent 0, #000 24px, #000 calc(100% - 24px), transparent 100%)',
          overflowX: paused ? 'auto' : 'hidden',
          overflowY: 'hidden',
          WebkitOverflowScrolling: 'touch',
          scrollSnapType: paused ? 'x mandatory' : undefined,
        }}
      >
        <div
          ref={trackRef}
          className={`highlights-marquee-track flex gap-3 ${paused ? '' : 'w-max'}`}
          style={{
            ['--marquee-duration' as string]: `${durationSec}s`,
            animationPlayState: paused ? 'paused' : undefined,
          }}
          aria-live="off"
        >
          {loop.map((event, i) => (
            <HighlightCard
              key={`${event.id}-${i}`}
              event={event}
              aria-hidden={!paused && i >= items.length}
              snap={paused}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

interface HighlightCardProps {
  event: Event;
  'aria-hidden'?: boolean;
  snap?: boolean;
}

const HighlightCard = ({ event, 'aria-hidden': ariaHidden, snap }: HighlightCardProps) => {
  const { t } = useTranslation();
  const startDate = new Date(event.start_at);
  const showTime = hasExplicitTime(event.start_at);

  const dayBadge = isToday(startDate)
    ? t('events.today', 'Hoy')
    : isTomorrow(startDate)
      ? t('events.tomorrow', 'Mañana')
      : format(startDate, 'EEE d MMM', { locale: es });

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
      className="group shrink-0 w-[220px] sm:w-[240px] md:w-[260px]"
      style={snap ? { scrollSnapAlign: 'start' } : undefined}
      aria-label={`${title}, ${dayBadge}${showTime ? `, ${timeLabel}` : ''}`}
      aria-hidden={ariaHidden || undefined}
      tabIndex={ariaHidden ? -1 : undefined}
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
          <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/60 via-black/20 to-transparent pointer-events-none" />
          <div className="absolute top-1.5 left-1.5 flex flex-col gap-1">
            <Badge className="bg-primary text-primary-foreground shadow-sm capitalize text-[10px] h-5 px-1.5">
              {dayBadge}
            </Badge>
            {event.is_free && (
              <Badge className="bg-green-500 hover:bg-green-500 text-[10px] h-5 px-1.5">
                {t('common.free', 'Gratis')}
              </Badge>
            )}
          </div>
          <span className="absolute bottom-1.5 left-2 text-[11px] font-semibold text-white/95 drop-shadow">
            {timeLabel}
          </span>
        </div>
        <div className="p-2.5 flex flex-col gap-0.5 flex-1">
          <h3 className="text-[13px] font-semibold line-clamp-2 leading-snug">{title}</h3>
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

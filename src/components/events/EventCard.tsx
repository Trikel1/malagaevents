import { forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { MapPin, Heart, Calendar, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import { es, enUS, de, fr, it, pt, ja, zhCN, ru, type Locale } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import EventImage from '@/components/events/EventImage';
import { sanitizeText, generateAltText } from '@/lib/sanitize';
import type { Event } from '@/types';

const locales: Record<string, Locale> = {
  es, en: enUS, de, fr, it, pt, ja, zh: zhCN, ru
};

interface EventCardProps {
  event: Event;
  isFavorite?: boolean;
  onToggleFavorite?: (eventId: string) => void;
  compact?: boolean;
  dense?: boolean;
}

const EventCard = forwardRef<HTMLAnchorElement, EventCardProps>(({ event, isFavorite, onToggleFavorite, compact, dense }, ref) => {
  const { t, i18n } = useTranslation();
  const locale = locales[i18n.language] || es;

  const formattedDate = format(new Date(event.start_at), "EEE d MMM · HH:mm", { locale });
  const dayShort = format(new Date(event.start_at), "d", { locale });
  const monthShort = format(new Date(event.start_at), "MMM", { locale }).replace('.', '');
  const timeShort = format(new Date(event.start_at), "HH:mm", { locale });

  // Strict cleaner: filter null/undefined/placeholders. Used for visible metadata only.
  const cleanMetaPart = (val: string | null | undefined): string | null => {
    if (val == null) return null;
    const s = sanitizeText(String(val)).trim();
    if (!s) return null;
    const lower = s.toLowerCase();
    if (
      lower === 'null' || lower === 'undefined' ||
      lower === '...' || lower === '…' ||
      lower === 'n/a' || lower === 'na' ||
      lower === 'no especificado' || lower === 'por confirmar' ||
      /^[.\s·•|–—-]+$/.test(s)
    ) return null;
    // Reject raw slugs (lowercase with hyphens, no spaces) — likely venue_normalized fallback
    if (/^[a-z0-9]+(-[a-z0-9]+)+$/.test(s)) return null;
    return s;
  };

  const venueDisplay = cleanMetaPart(event.venue?.name) || cleanMetaPart(event.venue_name);
  const locationDisplay = cleanMetaPart(event.location?.name) || cleanMetaPart(event.location_normalized) || cleanMetaPart(event.province);

  const venueName = venueDisplay || t('events.venueUnconfirmed', 'Por confirmar'); // for aria-label only
  const locationName = locationDisplay || 'Málaga'; // for aria-label only
  const eventTitle = sanitizeText(event.title) || t('events.untitled', 'Sin título');
  const imageAlt = generateAltText(event.title, event.venue_name);

  // Build dense-mode metadata parts (time + venue), filtering empties
  const denseMetaParts = [cleanMetaPart(timeShort), venueDisplay].filter((p): p is string => !!p);

  // Should we show the location row in normal mode? Hide if redundant with venue or just "Málaga" duplicate
  const showLocationRow = !!locationDisplay
    && (!venueDisplay || locationDisplay.toLowerCase() !== venueDisplay.toLowerCase());

  // Dense mode: compact vertical card for 2-column grids
  if (dense) {
    return (
      <Link
        ref={ref}
        to={`/events/${event.id}`}
        aria-label={`${eventTitle}, ${formattedDate}, ${venueName}`}
        className="block animate-fade-in"
      >
        <Card className="overflow-hidden border-border/60 shadow-soft hover:shadow-card transition-all duration-300 group focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 h-full hover:-translate-y-0.5">
          <div className="relative overflow-hidden">
            <EventImage
              src={event.image_url}
              alt={imageAlt}
              variant="card"
              category={event.category}
              className="group-hover:scale-105 transition-transform duration-500"
              aspectRatio="3/2"
            />
            {/* Floating date badge */}
            <div className="absolute top-1.5 left-1.5 z-10 flex flex-col items-center justify-center bg-card/95 backdrop-blur-sm rounded-lg px-1.5 py-0.5 shadow-soft min-w-[34px]">
              <span className="text-[11px] font-bold leading-none text-primary">{dayShort}</span>
              <span className="text-[8px] font-semibold uppercase leading-none text-muted-foreground mt-0.5">{monthShort}</span>
            </div>
            {event.is_free && (
              <Badge className="absolute top-1.5 right-1.5 bg-green-500 hover:bg-green-500 z-10 text-[10px] px-1.5 py-0">
                {t('common.free')}
              </Badge>
            )}
            {/* Subtle bottom gradient for legibility */}
            <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />
          </div>
          <CardContent className="p-2.5">
            <h3 className="text-sm font-semibold line-clamp-1 mb-0.5 leading-tight">{eventTitle}</h3>
            {denseMetaParts.length > 0 && (
              <p className="text-[11px] text-muted-foreground truncate">
                {denseMetaParts.join(' · ')}
              </p>
            )}
          </CardContent>
        </Card>
      </Link>
    );
  }

  return (
    <Link 
      ref={ref}
      to={`/events/${event.id}`}
      aria-label={`${eventTitle}, ${formattedDate}, ${venueName}`}
    >
      <Card className={cn(
        'overflow-hidden border-border/60 shadow-soft hover:shadow-card transition-all duration-300 group focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 hover:-translate-y-0.5',
        compact ? 'flex-row flex' : ''
      )}>
        {/* Image */}
        <div className={cn(
          'relative overflow-hidden',
          compact ? 'w-24 flex-shrink-0' : ''
        )}>
          <EventImage
            src={event.image_url}
            alt={imageAlt}
            variant={compact ? 'compact' : 'card'}
            category={event.category}
            className="group-hover:scale-105 transition-transform duration-300"
          />
          
          {/* Free badge */}
          {event.is_free && !compact && (
            <Badge className="absolute top-2 left-2 bg-green-500 hover:bg-green-500 z-10">
              {t('common.free')}
            </Badge>
          )}
          
          {/* Favorite button */}
          {onToggleFavorite && !compact && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 h-11 w-11 min-h-[44px] min-w-[44px] bg-background/80 hover:bg-background z-10 focus:ring-2 focus:ring-primary"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleFavorite(event.id);
              }}
              aria-label={isFavorite ? t('events.removeFromFavorites', 'Quitar de favoritos') : t('events.addToFavorites', 'Añadir a favoritos')}
              aria-pressed={isFavorite}
            >
              <Heart
                className={cn(
                  'h-5 w-5',
                  isFavorite ? 'fill-red-500 text-red-500' : 'text-muted-foreground'
                )}
                aria-hidden="true"
              />
            </Button>
          )}
        </div>

        <CardContent className={cn('p-3', compact && 'flex-1 flex flex-col justify-center')}>
          {/* Category */}
          <Badge variant="secondary" className="mb-2 text-xs">
            {t(`categories.${event.category}`)}
          </Badge>

          {/* Title */}
          <h3 className={cn(
            'font-semibold line-clamp-2 mb-2',
            compact ? 'text-sm' : 'text-base'
          )}>
            {eventTitle}
          </h3>

          {/* Date & Location */}
          <div className="space-y-1 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
              <time dateTime={event.start_at} className="capitalize">{formattedDate}</time>
            </div>
            <div className="flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
              <span className="line-clamp-1">{venueName}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
              <span className="line-clamp-1">{locationName}</span>
            </div>
          </div>

          {/* Tags */}
          {!compact && event.tags && event.tags.length > 0 && (
            <div className="flex gap-1 mt-2 flex-wrap" role="list" aria-label={t('events.tags', 'Etiquetas')}>
              {event.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs" role="listitem">
                  {sanitizeText(tag)}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
});

EventCard.displayName = 'EventCard';

export default EventCard;

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

  const venueName = sanitizeText(event.venue?.name || event.venue_name || event.venue_normalized) || t('events.venueUnconfirmed', 'Por confirmar');
  const locationName = sanitizeText(event.location?.name || event.location_normalized || event.province) || 'Málaga';
  const eventTitle = sanitizeText(event.title) || t('events.untitled', 'Sin título');
  const imageAlt = generateAltText(event.title, event.venue_name);

  // Dense mode: compact vertical card for 2-column grids
  if (dense) {
    return (
      <Link
        ref={ref}
        to={`/events/${event.id}`}
        aria-label={`${eventTitle}, ${formattedDate}, ${venueName}`}
      >
        <Card className="overflow-hidden hover:shadow-lg transition-shadow group focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 h-full">
          <div className="relative overflow-hidden">
            <EventImage
              src={event.image_url}
              alt={imageAlt}
              variant="card"
              category={event.category}
              className="group-hover:scale-105 transition-transform duration-300"
              aspectRatio="3/2"
            />
            {event.is_free && (
              <Badge className="absolute top-1.5 left-1.5 bg-green-500 hover:bg-green-500 z-10 text-[10px] px-1.5 py-0">
                {t('common.free')}
              </Badge>
            )}
          </div>
          <CardContent className="p-2">
            <h3 className="text-sm font-semibold line-clamp-1 mb-1">{eventTitle}</h3>
            <p className="text-xs text-muted-foreground line-clamp-1">
              <span className="capitalize">{formattedDate}</span>
            </p>
            <p className="text-xs text-muted-foreground line-clamp-1">
              {venueName}
            </p>
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
        'overflow-hidden hover:shadow-lg transition-shadow group focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2',
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

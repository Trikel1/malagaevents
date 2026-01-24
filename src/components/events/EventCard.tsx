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
}

const EventCard = ({ event, isFavorite, onToggleFavorite, compact }: EventCardProps) => {
  const { t, i18n } = useTranslation();
  const locale = locales[i18n.language] || es;

  const formattedDate = format(new Date(event.start_at), "EEE d MMM · HH:mm", { locale });

  // Get venue and location display names with fallbacks
  const venueName = sanitizeText(event.venue?.name || event.venue_name || event.venue_normalized) || t('events.venueUnconfirmed', 'Por confirmar');
  const locationName = sanitizeText(event.location?.name || event.location_normalized || event.province) || 'Málaga';
  const eventTitle = sanitizeText(event.title) || t('events.untitled', 'Sin título');

  // Generate accessible alt text
  const imageAlt = generateAltText(event.title, event.venue_name);

  return (
    <Link 
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
          
          {/* Favorite button - ensure minimum 44px tap target */}
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
};

export default EventCard;

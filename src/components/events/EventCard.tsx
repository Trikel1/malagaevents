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

  // Get venue and location display names
  const venueName = event.venue?.name || event.venue_name || event.venue_normalized || t('events.noVenue', 'Sin sala');
  const locationName = event.location?.name || event.location_normalized || event.province || 'Málaga';

  return (
    <Link to={`/events/${event.id}`}>
      <Card className={cn(
        'overflow-hidden hover:shadow-lg transition-shadow group',
        compact ? 'flex-row flex' : ''
      )}>
        {/* Image */}
        <div className={cn(
          'relative overflow-hidden',
          compact ? 'w-24 flex-shrink-0' : ''
        )}>
          <EventImage
            src={event.image_url}
            alt={event.title}
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
              className="absolute top-2 right-2 h-8 w-8 bg-background/80 hover:bg-background z-10"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleFavorite(event.id);
              }}
            >
              <Heart
                className={cn(
                  'h-4 w-4',
                  isFavorite ? 'fill-red-500 text-red-500' : 'text-muted-foreground'
                )}
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
            {event.title}
          </h3>

          {/* Date & Location */}
          <div className="space-y-1 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="capitalize">{formattedDate}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="line-clamp-1">{venueName}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="line-clamp-1">{locationName}</span>
            </div>
          </div>

          {/* Tags */}
          {!compact && event.tags && event.tags.length > 0 && (
            <div className="flex gap-1 mt-2 flex-wrap">
              {event.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
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

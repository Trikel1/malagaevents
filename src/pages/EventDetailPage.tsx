import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { es, enUS, de, fr, it, pt, ja, zhCN, ru, type Locale } from 'date-fns/locale';
import { 
  ArrowLeft, Calendar, MapPin, Euro, Users, Baby, 
  Accessibility, Heart, Share2, ExternalLink, Navigation, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import EventCard from '@/components/events/EventCard';
import EventImage, { EventImageSkeleton } from '@/components/events/EventImage';
import EmptyState from '@/components/common/EmptyState';
import { useEvent, useSimilarEvents } from '@/hooks/useEvents';
import { useFavorites, useToggleFavorite } from '@/hooks/useFavorites';
import { useAuthContext } from '@/contexts/AuthContext';

const locales: Record<string, Locale> = {
  es, en: enUS, de, fr, it, pt, ja, zh: zhCN, ru
};

const EventDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const locale = locales[i18n.language] || es;
  const { isAuthenticated } = useAuthContext();

  // Fetch event
  const { data: event, isLoading, error } = useEvent(id);
  
  // Fetch similar events
  const { data: similarEvents } = useSimilarEvents(event);
  
  // Favorites
  const { data: favorites } = useFavorites();
  const toggleFavorite = useToggleFavorite();
  
  const isFavorite = favorites?.some((f) => f.event_id === id) ?? false;

  const handleToggleFavorite = () => {
    if (!isAuthenticated) {
      navigate('/auth');
      return;
    }
    if (id) {
      toggleFavorite.mutate({ eventId: id, isFavorite });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <EventImageSkeleton variant="detail" />
        <div className="p-4 space-y-4">
          <div className="h-8 w-3/4 bg-muted animate-pulse rounded" />
          <div className="h-6 w-1/2 bg-muted animate-pulse rounded" />
          <div className="h-32 w-full bg-muted animate-pulse rounded" />
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-background p-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <EmptyState
          icon={Calendar}
          title={t('errors.notFound')}
          description={t('events.noEventsDesc')}
          actionLabel={t('common.back')}
          onAction={() => navigate('/events')}
        />
      </div>
    );
  }

  const formattedDate = format(new Date(event.start_at), "EEEE d 'de' MMMM", { locale });
  const formattedTime = format(new Date(event.start_at), 'HH:mm', { locale });
  const formattedEndTime = event.end_at ? format(new Date(event.end_at), 'HH:mm', { locale }) : null;

  const handleOpenMaps = () => {
    if (event.lat && event.lng) {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const url = isIOS
        ? `maps://maps.apple.com/?daddr=${event.lat},${event.lng}`
        : `https://www.google.com/maps/dir/?api=1&destination=${event.lat},${event.lng}`;
      window.open(url, '_blank');
    } else {
      // Fallback to address search
      const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.address)}`;
      window.open(url, '_blank');
    }
  };

  const handleAddToCalendar = () => {
    const startDate = new Date(event.start_at);
    const endDate = event.end_at ? new Date(event.end_at) : new Date(startDate.getTime() + 7200000);
    
    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:${startDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z
DTEND:${endDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z
SUMMARY:${event.title}
DESCRIPTION:${event.description.replace(/\n/g, '\\n')}
LOCATION:${event.venue_name}, ${event.address}
END:VEVENT
END:VCALENDAR`;

    const blob = new Blob([icsContent], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${event.title}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({
        title: event.title,
        text: event.description.substring(0, 100),
        url: window.location.href,
      });
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Hero Image */}
      <div className="relative">
        <EventImage
          src={event.image_url}
          alt={event.title}
          variant="detail"
          category={event.category}
          showLightbox={!!event.image_url}
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
        
        {/* Back button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 bg-background/80 hover:bg-background"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>

        {/* Actions */}
        <div className="absolute top-4 right-4 flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleShare}
            className="bg-background/80 hover:bg-background"
          >
            <Share2 className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleToggleFavorite}
            disabled={toggleFavorite.isPending}
            className="bg-background/80 hover:bg-background"
          >
            {toggleFavorite.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Heart className={cn('h-5 w-5', isFavorite && 'fill-red-500 text-red-500')} />
            )}
          </Button>
        </div>

        {/* Free badge */}
        {event.is_free && (
          <Badge className="absolute bottom-4 left-4 bg-green-500 hover:bg-green-500 text-white">
            {t('common.free')}
          </Badge>
        )}
      </div>

      {/* Content */}
      <main className="p-4 space-y-6">
        {/* Title & Category */}
        <div>
          <Badge variant="secondary" className="mb-2">
            {t(`categories.${event.category}`)}
          </Badge>
          <h1 className="text-2xl font-bold">{event.title}</h1>
        </div>

        {/* Quick Info */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium capitalize">{formattedDate}</p>
                <p className="text-xs text-muted-foreground">
                  {formattedTime}{formattedEndTime && ` - ${formattedEndTime}`}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="p-2 rounded-full bg-secondary/10">
                <MapPin className="h-5 w-5 text-secondary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium break-words" style={{ overflowWrap: 'anywhere', whiteSpace: 'normal' }}>{event.venue_name}</p>
                <p className="text-xs text-muted-foreground break-words" style={{ overflowWrap: 'anywhere', whiteSpace: 'normal' }}>{event.address}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button onClick={handleAddToCalendar} variant="outline" className="flex-1">
            <Calendar className="h-4 w-4 mr-2" />
            {t('eventDetail.addToCalendar')}
          </Button>
          <Button onClick={handleOpenMaps} variant="outline" className="flex-1">
            <Navigation className="h-4 w-4 mr-2" />
            {t('eventDetail.howToGet')}
          </Button>
        </div>

        {event.ticket_url && (
          <Button 
            className="w-full" 
            size="lg"
            onClick={() => window.open(event.ticket_url, '_blank')}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            {t('eventDetail.buyTickets')}
          </Button>
        )}

        <Separator />

        {/* Description */}
        <div>
          <h2 className="font-semibold mb-2">{t('eventDetail.when')}</h2>
          <p className="text-muted-foreground whitespace-pre-line">{event.description}</p>
        </div>

        {/* Additional Info */}
        {(event.price_info || event.age_restriction || event.accessibility_info || event.capacity_info) && (
          <>
            <Separator />
            <div className="space-y-3">
              {event.price_info && (
                <div className="flex items-center gap-3">
                  <Euro className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{t('eventDetail.price')}</p>
                    <p className="text-sm text-muted-foreground">{event.price_info}</p>
                  </div>
                </div>
              )}
              {event.age_restriction && (
                <div className="flex items-center gap-3">
                  <Baby className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{t('eventDetail.age')}</p>
                    <p className="text-sm text-muted-foreground">{event.age_restriction}</p>
                  </div>
                </div>
              )}
              {event.accessibility_info && (
                <div className="flex items-center gap-3">
                  <Accessibility className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{t('eventDetail.accessibility')}</p>
                    <p className="text-sm text-muted-foreground">{event.accessibility_info}</p>
                  </div>
                </div>
              )}
              {event.capacity_info && (
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{t('eventDetail.capacity')}</p>
                    <p className="text-sm text-muted-foreground">{event.capacity_info}</p>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Tags */}
        {event.tags && event.tags.length > 0 && (
          <>
            <Separator />
            <div className="flex flex-wrap gap-2">
              {event.tags.map((tag) => (
                <Badge key={tag} variant="outline">
                  {tag}
                </Badge>
              ))}
            </div>
          </>
        )}

        {/* Similar Events */}
        {similarEvents && similarEvents.length > 0 && (
          <>
            <Separator />
            <div>
              <h2 className="font-semibold mb-3">{t('events.similarEvents')}</h2>
              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                {similarEvents.map((evt) => (
                  <div key={evt.id} className="min-w-[240px] max-w-[240px]">
                    <EventCard event={evt} compact />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default EventDetailPage;

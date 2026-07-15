import { useEffect, useRef, useState } from 'react';
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
import { hasExplicitTime } from '@/lib/eventTime';
import EventCard from '@/components/events/EventCard';
import EventImage, { EventImageSkeleton } from '@/components/events/EventImage';
import EmptyState from '@/components/common/EmptyState';
import { useEvent, useSimilarEvents } from '@/hooks/useEvents';
import { useFavorites, useToggleFavorite } from '@/hooks/useFavorites';
import { useAuthContext } from '@/contexts/AuthContext';
import SEO from '@/components/common/SEO';

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

  // Hide sticky CTA on scroll-down, show on scroll-up (mobile-friendly)
  const [ctaHidden, setCtaHidden] = useState(false);
  const lastScrollY = useRef(0);
  const accumDelta = useRef(0);
  useEffect(() => {
    const TOP_OFFSET = 96;        // siempre visible cerca del top
    const HIDE_THRESHOLD = 80;    // bajar 80px seguidos para ocultar
    const SHOW_THRESHOLD = 24;    // subir 24px para reaparecer
    const handleScroll = () => {
      const y = window.scrollY;
      const delta = y - lastScrollY.current;
      lastScrollY.current = y;

      if (y < TOP_OFFSET) {
        accumDelta.current = 0;
        setCtaHidden(false);
        return;
      }

      // reset acumulador si cambia la dirección
      if ((delta > 0 && accumDelta.current < 0) || (delta < 0 && accumDelta.current > 0)) {
        accumDelta.current = 0;
      }
      accumDelta.current += delta;

      if (accumDelta.current > HIDE_THRESHOLD) {
        setCtaHidden(true);
        accumDelta.current = 0;
      } else if (accumDelta.current < -SHOW_THRESHOLD) {
        setCtaHidden(false);
        accumDelta.current = 0;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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

  const showTime = hasExplicitTime(event.start_at);
  const formattedDate = format(new Date(event.start_at), "EEEE d 'de' MMMM", { locale });
  const formattedTime = showTime
    ? format(new Date(event.start_at), 'HH:mm', { locale })
    : t('events.timeTBC', 'Hora por confirmar');
  const formattedEndTime = showTime && event.end_at && hasExplicitTime(event.end_at)
    ? format(new Date(event.end_at), 'HH:mm', { locale })
    : null;

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
    <div className="min-h-screen bg-background pb-32">
      <SEO
        title={`${event.title.slice(0, 42)} — MalagaEvents`}
        description={(event.description?.replace(/\s+/g, ' ').trim().slice(0, 155) || `${event.title} en Málaga el ${formattedDate}. Detalles, ubicación y entradas.`)}
        path={`/events/${event.id}`}
        type="article"
        image={event.image_url || undefined}
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "Event",
            name: event.title,
            description: event.description || undefined,
            startDate: event.start_at,
            endDate: event.end_at || undefined,
            eventStatus: "https://schema.org/EventScheduled",
            eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
            image: event.image_url || undefined,
            url: `https://malagaevents.lovable.app/events/${event.id}`,
            location: {
              "@type": "Place",
              name: event.venue_name,
              address: {
                "@type": "PostalAddress",
                streetAddress: event.address || undefined,
                addressLocality: "Málaga",
                addressRegion: "Málaga",
                addressCountry: "ES",
              },
              ...(event.lat && event.lng ? { geo: { "@type": "GeoCoordinates", latitude: event.lat, longitude: event.lng } } : {}),
            },
            ...(event.is_free || event.ticket_url
              ? {
                  offers: {
                    "@type": "Offer",
                    price: event.is_free ? "0" : undefined,
                    priceCurrency: "EUR",
                    url: event.ticket_url || undefined,
                    availability: "https://schema.org/InStock",
                  },
                }
              : {}),
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Inicio", item: "https://malagaevents.lovable.app/" },
              { "@type": "ListItem", position: 2, name: "Eventos", item: "https://malagaevents.lovable.app/events" },
              { "@type": "ListItem", position: 3, name: event.title, item: `https://malagaevents.lovable.app/events/${event.id}` },
            ],
          },
        ]}
      />
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
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight leading-tight">{event.title}</h1>
        </div>

        {/* Quick Info — ficha 2x2 */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="rounded-2xl shadow-soft">
            <CardContent className="p-3 flex items-start gap-3">
              <div className="p-2 rounded-full bg-primary/10 shrink-0">
                <Calendar className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{t('eventDetail.date', 'Fecha')}</p>
                <p className="text-sm font-semibold capitalize leading-snug">{formattedDate}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-soft">
            <CardContent className="p-3 flex items-start gap-3">
              <div className="p-2 rounded-full bg-primary/10 shrink-0">
                <Calendar className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{t('eventDetail.time', 'Hora')}</p>
                <p className="text-sm font-semibold leading-snug">
                  {formattedTime}{formattedEndTime && ` – ${formattedEndTime}`}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-soft col-span-2">
            <CardContent className="p-3 flex items-start gap-3">
              <div className="p-2 rounded-full bg-secondary/10 shrink-0">
                <MapPin className="h-4 w-4 text-secondary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{t('eventDetail.place', 'Lugar')}</p>
                <p className="text-sm font-semibold break-words leading-snug" style={{ overflowWrap: 'anywhere' }}>{event.venue_name}</p>
                <p className="text-xs text-muted-foreground break-words mt-0.5" style={{ overflowWrap: 'anywhere' }}>{event.address}</p>
              </div>
            </CardContent>
          </Card>

          {(event.is_free || event.price_info) && (
            <Card className="rounded-2xl shadow-soft col-span-2">
              <CardContent className="p-3 flex items-start gap-3">
                <div className="p-2 rounded-full bg-primary/10 shrink-0">
                  <Euro className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{t('eventDetail.price', 'Precio')}</p>
                  <p className="text-sm font-semibold leading-snug">
                    {event.is_free ? t('common.free', 'Gratis') : event.price_info}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
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

        {/* Discreet provenance line — only when the event carries a real source URL */}
        {(() => {
          const rawUrl = (event as any).url || (event as any).source_url || null;
          let host: string | null = null;
          if (rawUrl) {
            try { host = new URL(rawUrl).host.replace(/^www\./, ''); } catch { host = null; }
          }
          const updated = (event as any).updated_at as string | undefined;
          if (!host && !updated) return null;
          return (
            <div className="pt-4 border-t border-border/50 text-[11px] text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1">
              {host && (
                <>
                  <span>{t('eventDetail.source', 'Fuente:')}</span>
                  <a
                    href={rawUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-foreground/80 hover:text-primary hover:underline underline-offset-2 truncate max-w-[240px]"
                  >
                    {host}
                  </a>
                </>
              )}
              {updated && (
                <span className="opacity-80">
                  {host ? '· ' : ''}
                  {t('eventDetail.updatedOn', 'Actualizado')} {new Date(updated).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              )}
            </div>
          );
        })()}
      </main>


      {/* Sticky bottom CTA */}
      <div className={cn(
        "fixed bottom-0 left-0 right-0 z-40 bg-card/90 backdrop-blur-xl border-t border-border/60 px-4 py-3 pb-safe shadow-soft transition-transform duration-300 ease-out",
        ctaHidden ? "translate-y-full" : "translate-y-0"
      )}>
        <div className="max-w-lg mx-auto flex gap-2">
          <Button
            variant="outline"
            size="lg"
            onClick={handleToggleFavorite}
            disabled={toggleFavorite.isPending}
            className="flex-shrink-0"
            aria-label={isFavorite ? t('events.removeFromFavorites', 'Quitar de favoritos') : t('events.addToFavorites', 'Guardar')}
          >
            <Heart className={cn('h-5 w-5', isFavorite && 'fill-red-500 text-red-500')} />
          </Button>
          {event.ticket_url ? (
            <Button
              size="lg"
              className="flex-1 shadow-lift"
              onClick={() => window.open(event.ticket_url, '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              {t('eventDetail.buyTickets')}
            </Button>
          ) : (
            <Button
              size="lg"
              variant="secondary"
              className="flex-1"
              onClick={handleAddToCalendar}
            >
              <Calendar className="h-4 w-4 mr-2" />
              {t('eventDetail.addToCalendar')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default EventDetailPage;

import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { getDateLocale } from '@/i18n/dateLocale';
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


const EventDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const locale = getDateLocale(i18n.language);
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
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="mb-4" aria-label={t('common.back', 'Volver')}>
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
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
  const formattedDate = format(new Date(event.start_at), 'PPPP', { locale });
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
    <div className="min-h-screen bg-background pb-24 lg:pb-8">
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

      {/* Top action bar — always visible; separate from hero image */}
      <div className="sticky top-0 z-30 bg-background/85 backdrop-blur-md border-b border-border/60">
        <div className="mx-auto w-full max-w-[1180px] px-4 lg:px-8 h-14 flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            aria-label={t('common.back', 'Volver')}
            className="rounded-full"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </Button>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleShare}
              aria-label={t('common.share', 'Compartir')}
              className="rounded-full"
            >
              <Share2 className="h-5 w-5" aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleToggleFavorite}
              disabled={toggleFavorite.isPending}
              aria-label={
                isFavorite
                  ? t('events.removeFromFavorites', 'Quitar de favoritos')
                  : t('events.addToFavorites', 'Guardar')
              }
              aria-pressed={isFavorite}
              className="rounded-full"
            >
              {toggleFavorite.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              ) : (
                <Heart className={cn('h-5 w-5', isFavorite && 'fill-red-500 text-red-500')} aria-hidden />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Editorial two-column layout */}
      <div className="mx-auto w-full max-w-[1180px] px-4 lg:px-8 pt-4 lg:pt-6 pb-6">
        <div className="grid gap-6 lg:gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-start">
          {/* Media column */}
          <div className="relative order-1 lg:order-1">
            <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-muted aspect-[4/3] sm:aspect-[16/10] lg:aspect-[4/3] max-h-[520px]">
              <EventImage
                src={event.image_url}
                alt={event.title}
                variant="detail"
                category={event.category}
                showLightbox={!!event.image_url}
                priority
                className="absolute inset-0 h-full w-full object-cover"
              />
              {event.is_free && (
                <Badge className="absolute bottom-3 left-3 bg-green-500 hover:bg-green-500 text-white shadow-sm">
                  {t('common.free', 'Gratis')}
                </Badge>
              )}
            </div>
          </div>

          {/* Info column */}
          <div className="order-2 lg:order-2 space-y-5 min-w-0">
            <div>
              <Badge variant="secondary" className="mb-2">
                {t(`categories.${event.category}`)}
              </Badge>
              <h1 className="font-display text-2xl sm:text-3xl lg:text-[34px] font-semibold tracking-tight leading-tight text-foreground break-words">
                {event.title}
              </h1>
            </div>

            {/* Key facts */}
            <div className="grid grid-cols-2 gap-3">
              <FactCard
                icon={<Calendar className="h-4 w-4 text-primary" />}
                label={t('eventDetail.date', 'Fecha')}
                value={<span className="capitalize">{formattedDate}</span>}
              />
              <FactCard
                icon={<Calendar className="h-4 w-4 text-primary" />}
                label={t('eventDetail.time', 'Hora')}
                value={`${formattedTime}${formattedEndTime ? ` – ${formattedEndTime}` : ''}`}
              />
              <FactCard
                className="col-span-2"
                icon={<MapPin className="h-4 w-4 text-secondary" />}
                label={t('eventDetail.place', 'Lugar')}
                value={
                  <>
                    <span className="break-words" style={{ overflowWrap: 'anywhere' }}>
                      {event.venue_name}
                    </span>
                    {event.address && (
                      <span
                        className="block text-xs text-muted-foreground break-words mt-0.5"
                        style={{ overflowWrap: 'anywhere' }}
                      >
                        {event.address}
                      </span>
                    )}
                  </>
                }
              />
              {(event.is_free || event.price_info) && (
                <FactCard
                  className="col-span-2"
                  icon={<Euro className="h-4 w-4 text-primary" />}
                  label={t('eventDetail.price', 'Precio')}
                  value={event.is_free ? t('common.free', 'Gratis') : event.price_info}
                />
              )}
            </div>

            {/* Primary CTA — Tickets. Desktop-visible; mobile also has sticky CTA below. */}
            {event.ticket_url && (
              <Button
                size="lg"
                className="w-full shadow-lift hidden lg:inline-flex"
                onClick={() => window.open(event.ticket_url, '_blank', 'noopener,noreferrer')}
              >
                <ExternalLink className="h-4 w-4 mr-2" aria-hidden />
                {t('eventDetail.buyTickets')}
              </Button>
            )}

            <div className="flex gap-2">
              <Button onClick={handleAddToCalendar} variant="outline" className="flex-1">
                <Calendar className="h-4 w-4 mr-2" aria-hidden />
                {t('eventDetail.addToCalendar')}
              </Button>
              <Button onClick={handleOpenMaps} variant="outline" className="flex-1">
                <Navigation className="h-4 w-4 mr-2" aria-hidden />
                {t('eventDetail.howToGet')}
              </Button>
            </div>
          </div>
        </div>


        {/* Long-form content — full-width inside container */}
        <div className="mt-8 lg:mt-10 space-y-6 max-w-3xl">
          <div>
            <h2 className="font-display text-lg font-semibold mb-2">{t('eventDetail.when')}</h2>
            <p className="text-muted-foreground whitespace-pre-line leading-relaxed">{event.description}</p>
          </div>

          {(event.price_info || event.age_restriction || event.accessibility_info || event.capacity_info) && (
            <>
              <Separator />
              <div className="space-y-3">
                {event.price_info && (
                  <div className="flex items-start gap-3">
                    <Euro className="h-5 w-5 text-muted-foreground mt-0.5" aria-hidden />
                    <div>
                      <p className="text-sm font-medium">{t('eventDetail.price')}</p>
                      <p className="text-sm text-muted-foreground">{event.price_info}</p>
                    </div>
                  </div>
                )}
                {event.age_restriction && (
                  <div className="flex items-start gap-3">
                    <Baby className="h-5 w-5 text-muted-foreground mt-0.5" aria-hidden />
                    <div>
                      <p className="text-sm font-medium">{t('eventDetail.age')}</p>
                      <p className="text-sm text-muted-foreground">{event.age_restriction}</p>
                    </div>
                  </div>
                )}
                {event.accessibility_info && (
                  <div className="flex items-start gap-3">
                    <Accessibility className="h-5 w-5 text-muted-foreground mt-0.5" aria-hidden />
                    <div>
                      <p className="text-sm font-medium">{t('eventDetail.accessibility')}</p>
                      <p className="text-sm text-muted-foreground">{event.accessibility_info}</p>
                    </div>
                  </div>
                )}
                {event.capacity_info && (
                  <div className="flex items-start gap-3">
                    <Users className="h-5 w-5 text-muted-foreground mt-0.5" aria-hidden />
                    <div>
                      <p className="text-sm font-medium">{t('eventDetail.capacity')}</p>
                      <p className="text-sm text-muted-foreground">{event.capacity_info}</p>
                    </div>
                  </div>
                )}
                {event.source_ref && (
                  <div className="flex items-start gap-3">
                    <ExternalLink className="h-5 w-5 text-muted-foreground mt-0.5" aria-hidden />
                    <div>
                      <p className="text-sm font-medium">{t('eventDetail.source', 'Fuente')}</p>
                      <a
                        href={event.source_ref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline break-all"
                      >
                        {event.source_ref}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

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
        </div>

        {/* Similar events */}
        {similarEvents && similarEvents.length > 0 && (
          <section className="mt-10">
            <h2 className="font-display text-xl font-semibold mb-4">{t('events.similarEvents')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {similarEvents.slice(0, 6).map((evt) => (
                <EventCard key={evt.id} event={evt} compact />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Sticky bottom CTA — mobile & tablet only */}
      <div
        className={cn(
          'lg:hidden fixed bottom-[calc(env(safe-area-inset-bottom,0px)+80px)] left-0 right-0 z-40 px-4 transition-transform duration-300 ease-out pointer-events-none',
          ctaHidden ? 'translate-y-[130%]' : 'translate-y-0',
        )}
      >
        <div className="pointer-events-auto mx-auto max-w-lg bg-card/95 backdrop-blur-xl border border-border/60 rounded-2xl shadow-lift p-2 flex gap-2">
          <Button
            variant="outline"
            size="lg"
            onClick={handleToggleFavorite}
            disabled={toggleFavorite.isPending}
            className="flex-shrink-0"
            aria-label={isFavorite ? t('events.removeFromFavorites', 'Quitar de favoritos') : t('events.addToFavorites', 'Guardar')}
            aria-pressed={isFavorite}
          >
            <Heart className={cn('h-5 w-5', isFavorite && 'fill-red-500 text-red-500')} aria-hidden />
          </Button>
          {event.ticket_url ? (
            <Button
              size="lg"
              className="flex-1 shadow-lift"
              onClick={() => window.open(event.ticket_url, '_blank', 'noopener,noreferrer')}
            >
              <ExternalLink className="h-4 w-4 mr-2" aria-hidden />
              {t('eventDetail.buyTickets')}
            </Button>
          ) : (
            <Button
              size="lg"
              variant="secondary"
              className="flex-1"
              onClick={handleAddToCalendar}
            >
              <Calendar className="h-4 w-4 mr-2" aria-hidden />
              {t('eventDetail.addToCalendar')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

interface FactCardProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  className?: string;
}

const FactCard = ({ icon, label, value, className }: FactCardProps) => (
  <Card className={cn('rounded-2xl shadow-soft', className)}>
    <CardContent className="p-3 flex items-start gap-3">
      <div className="p-2 rounded-full bg-primary/10 shrink-0" aria-hidden>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
          {label}
        </p>
        <p className="text-sm font-semibold leading-snug break-words" style={{ overflowWrap: 'anywhere' }}>
          {value}
        </p>
      </div>
    </CardContent>
  </Card>
);

export default EventDetailPage;

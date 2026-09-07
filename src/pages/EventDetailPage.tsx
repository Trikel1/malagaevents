import { useEffect, useRef, useState } from 'react';
import { categoryI18nKey } from '@/lib/categoryLabel';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { es, enUS, de, fr, it, pt, ja, zhCN, ru, ar, type Locale } from 'date-fns/locale';
import { 
  ArrowLeft, Calendar, Clock, MapPin, Euro, Users, Baby, Monitor,
  Accessibility, Heart, Share2, Ticket, Navigation, Loader2, ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { hasExplicitTime } from '@/lib/eventTime';
import { formatMadrid } from '@/lib/madridTime';
import { buildEventIcs, icsFileName } from '@/lib/calendarExport';
import { resolveTicketAction, buildDirectionsUrl } from '@/lib/eventLinks';
import { resolvePoint } from '@/lib/venueCoords';
import { isOnlineEvent } from '@/lib/eventPlace';
import EventCard from '@/components/events/EventCard';
import EventImage, { EventImageSkeleton } from '@/components/events/EventImage';
import EmptyState from '@/components/common/EmptyState';
import { useEvent, useSimilarEvents } from '@/hooks/useEvents';
import { useFavorites, useToggleFavorite } from '@/hooks/useFavorites';
import { useAuthContext } from '@/contexts/AuthContext';
import SEO from '@/components/common/SEO';

const locales: Record<string, Locale> = {
  es, en: enUS, de, fr, it, pt, ja, zh: zhCN, ru, ar,
};

/** 'en-US' / 'ar-MA' must resolve to the same locale as 'en' / 'ar'. */
const resolveDateLocale = (language: string): Locale =>
  locales[language] ?? locales[language.split('-')[0].toLowerCase()] ?? es;

const EventDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const locale = resolveDateLocale(i18n.language);
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
  // The Spanish "d 'de' MMMM" pattern must not leak into other languages.
  const datePattern = i18n.language.toLowerCase().startsWith('es')
    ? "EEEE d 'de' MMMM"
    : 'EEEE d MMMM';
  const formattedDate = formatMadrid(new Date(event.start_at), datePattern, locale);
  const formattedTime = showTime
    ? formatMadrid(new Date(event.start_at), 'HH:mm', locale)
    : t('events.timeTBC', 'Hora por confirmar');
  const formattedEndTime = showTime && event.end_at && hasExplicitTime(event.end_at)
    ? formatMadrid(new Date(event.end_at), 'HH:mm', locale)
    : null;

  // Real outbound destinations for this event, or nothing at all.
  const ticketAction = resolveTicketAction(event as unknown as Parameters<typeof resolveTicketAction>[0]);
  const point = resolvePoint({
    lat: event.lat,
    lng: event.lng,
    venueLat: (event as any).venue?.lat,
    venueLng: (event as any).venue?.lng,
    venueName: event.venue_name,
  });
  const directions = buildDirectionsUrl({
    point,
    address: event.address,
    venueName: event.venue_name,
  });
  const isOnline = isOnlineEvent({ venue_name: event.venue_name, address: event.address });

  const ticketLabel =
    ticketAction.kind === 'tickets'
      ? t('eventDetail.viewTickets', 'Ver entradas')
      : ticketAction.kind === 'register'
      ? t('eventDetail.register', 'Inscribirme')
      : t('eventDetail.officialSiteShort', 'Web oficial');

  /** External maps app when the location is verified; internal map otherwise. */
  const handleOpenMaps = () => {
    if (directions) {
      window.open(directions.url, '_blank', 'noopener,noreferrer');
      return;
    }
    navigate(`/map?event=${event.id}`);
  };

  const handleAddToCalendar = () => {
    const ics = buildEventIcs(event, { url: window.location.href });
    if (!ics) {
      toast.error(t('eventDetail.calendarError', 'No hemos podido crear el archivo del calendario.'));
      return;
    }
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = icsFileName(event.title);
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleShare = async () => {
    const shareUrl = window.location.href;
    const shareData = {
      title: event.title ?? '',
      text: (event.description ?? '').replace(/\s+/g, ' ').trim().slice(0, 100),
      url: shareUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        // The user dismissing the share sheet is not an error.
        if (err instanceof DOMException && err.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success(t('eventDetail.linkCopied', 'Enlace copiado'));
    } catch {
      toast.error(t('eventDetail.shareUnavailable', 'No se puede compartir desde este navegador.'));
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
            aria-label={t('eventDetail.share', 'Compartir')}
            className="h-11 w-11 bg-background/80 hover:bg-background"
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
            {t(`categories.${categoryI18nKey(event.category)}`)}
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight leading-tight">{event.title}</h1>
        </div>

        {/* Datos prácticos — una sola tarjeta ligera, icono + valor */}
        <Card className="rounded-2xl shadow-soft">
          <CardContent className="p-3 sm:p-4 space-y-2.5">
            <div className="flex items-start gap-3">
              <Calendar className="h-4 w-4 text-primary shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-sm font-medium leading-snug first-letter:uppercase">
                <span className="sr-only">{t('eventDetail.date', 'Fecha')}: </span>
                {formattedDate}
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Clock className="h-4 w-4 text-primary shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-sm font-medium leading-snug">
                <span className="sr-only">{t('eventDetail.time', 'Hora')}: </span>
                {formattedTime}{formattedEndTime && ` – ${formattedEndTime}`}
              </p>
            </div>
            <div className="flex items-start gap-3">
              {isOnline ? (
                <Monitor className="h-4 w-4 text-secondary shrink-0 mt-0.5" aria-hidden="true" />
              ) : (
                <MapPin className="h-4 w-4 text-secondary shrink-0 mt-0.5" aria-hidden="true" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium leading-snug break-words" style={{ overflowWrap: 'anywhere' }}>
                  <span className="sr-only">{t('eventDetail.place', 'Lugar')}: </span>
                  {isOnline ? t('eventDetail.online', 'Online') : event.venue_name}
                </p>
                {!isOnline && event.address && (
                  <p className="text-xs text-muted-foreground break-words mt-0.5" style={{ overflowWrap: 'anywhere' }}>
                    {event.address}
                  </p>
                )}
              </div>
            </div>
            {(event.is_free || event.price_info) && (
              <div className="flex items-start gap-3">
                <Euro className="h-4 w-4 text-primary shrink-0 mt-0.5" aria-hidden="true" />
                <p className="text-sm font-medium leading-snug">
                  <span className="sr-only">{t('eventDetail.price', 'Precio')}: </span>
                  {event.is_free ? t('common.free', 'Gratis') : event.price_info}
                </p>
              </div>
            )}
          </CardContent>
        </Card>


        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button onClick={handleAddToCalendar} variant="outline" className="flex-1">
            <Calendar className="h-4 w-4 mr-2" />
            {t('eventDetail.addToCalendar')}
          </Button>
          {directions ? (
            <Button onClick={handleOpenMaps} variant="outline" className="flex-1">
              <Navigation className="h-4 w-4 mr-2" />
              {t('eventDetail.howToGet')}
            </Button>
          ) : (
            <Button onClick={handleOpenMaps} variant="outline" className="flex-1">
              <MapPin className="h-4 w-4 mr-2" />
              {t('eventDetail.seeOnMap', 'Ver en el mapa')}
            </Button>
          )}
        </div>
        <p className="-mt-4 text-xs text-muted-foreground">
          {directions
            ? directions.basis === 'coords'
              ? t('eventDetail.locationExact', 'Ubicación verificada.')
              : t('eventDetail.locationAddress', 'Indicaciones a partir de la dirección publicada.')
            : t('eventDetail.locationPending', 'Ubicación pendiente de confirmar: no podemos dar indicaciones.')}
        </p>

        {/* Entradas — acción real cuando la fuente publica un enlace */}
        <Card className="p-4">
          <h2 className="font-semibold text-sm mb-1.5 flex items-center gap-2">
            <Ticket className="h-4 w-4 text-primary" aria-hidden="true" />
            {t('eventDetail.ticketInfoTitle', 'Información de entradas')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {event.is_free
              ? t('common.free', 'Gratis')
              : event.price_info
              ? event.price_info
              : ticketAction.url
              ? t('eventDetail.priceOnSite', 'Precio y disponibilidad en la web del organizador.')
              : t('eventDetail.ticketsUnknown', 'No disponemos de información de entradas para este evento.')}
          </p>

          {ticketAction.url ? (
            <>
              <Button asChild className="mt-3 w-full min-h-11">
                <a href={ticketAction.url} target="_blank" rel="noopener noreferrer">
                  {ticketLabel}
                  <ExternalLink className="h-4 w-4 ml-2" aria-hidden="true" />
                </a>
              </Button>
              {ticketAction.host && (
                <p className="text-xs text-muted-foreground mt-1.5 text-center">
                  {ticketAction.host}
                </p>
              )}
            </>
          ) : (
            <p className="mt-3 text-sm font-medium">
              {t('eventDetail.ticketPending', 'Enlace de entradas pendiente de confirmar.')}
            </p>
          )}

          {event.venue?.name && (
            <p className="text-xs text-muted-foreground mt-2">
              {t('eventDetail.organizer', 'Organizador')}: {event.venue.name}
            </p>
          )}
        </Card>

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
                  <span className="font-medium text-foreground/80 truncate max-w-[240px]">
                    {host}
                  </span>
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
          {ticketAction.url ? (
            <>
              <Button
                size="lg"
                variant="outline"
                className="flex-shrink-0"
                onClick={handleAddToCalendar}
                aria-label={t('eventDetail.addToCalendar')}
              >
                <Calendar className="h-5 w-5" />
              </Button>
              <Button asChild size="lg" className="flex-1">
                <a href={ticketAction.url} target="_blank" rel="noopener noreferrer">
                  {ticketLabel}
                  <ExternalLink className="h-4 w-4 ml-2" aria-hidden="true" />
                </a>
              </Button>
            </>
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

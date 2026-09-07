import { useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, CalendarDays, Clock, MapPin, Ticket, Navigation, Heart,
  Calendar as CalendarIcon, ExternalLink, Building2, ShieldCheck, AlertTriangle,
} from 'lucide-react';
import { es, enUS, de, fr, it, pt, ja, zhCN, ru, ar, type Locale } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useSportsEvent } from '@/hooks/useSportsEvent';
import { useSportsFavoriteIds, useToggleSportsFavorite } from '@/hooks/useSportsFavorites';
import { resolveSportImage, sportItemKind, sportPriceState } from '@/lib/sportsDisplay';
import { resolveTicketAction, buildDirectionsUrl } from '@/lib/eventLinks';
import { resolvePoint } from '@/lib/venueCoords';
import { formatMadrid } from '@/lib/madridTime';
import { hasExplicitTime } from '@/lib/eventTime';
import { buildEventIcs, icsFileName } from '@/lib/calendarExport';
import { cleanSportTitle } from '@/lib/sports';
import SEO from '@/components/common/SEO';

const locales: Record<string, Locale> = { es, en: enUS, de, fr, it, pt, ja, zh: zhCN, ru, ar };
const resolveDateLocale = (language: string): Locale =>
  locales[language] ?? locales[language.split('-')[0].toLowerCase()] ?? es;

const SportEventDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: event, isLoading, isError } = useSportsEvent(id);
  const { data: favoriteIds = [] } = useSportsFavoriteIds();
  const toggleFavorite = useToggleSportsFavorite();

  const locale = resolveDateLocale(i18n.language);

  const view = useMemo(() => {
    if (!event) return null;
    const image = resolveSportImage(event.image_url, event.sport_category);
    const kind = sportItemKind(event);
    const price = sportPriceState(event.price_info);
    const ticket = resolveTicketAction({
      buy_url: event.tickets_url,
      ticket_url: event.registration_url,
      url: event.canonical_url ?? event.source_url,
    });
    const point = event.locationVerified
      ? resolvePoint({ venueName: event.venue_name })
      : null;
    const directions = event.locationVerified
      ? buildDirectionsUrl({ point, address: event.address, venueName: event.venue_name })
      : null;
    return { image, kind, price, ticket, directions };
  }, [event]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 space-y-4">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="aspect-[16/9] w-full rounded-2xl" />
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    );
  }

  if (isError || !event || !view) {
    return (
      <div className="min-h-screen bg-background p-6 text-center space-y-4">
        <AlertTriangle className="h-10 w-10 mx-auto text-muted-foreground" aria-hidden="true" />
        <h1 className="text-lg font-semibold">
          {t('sportsDetail.notFound', 'No encontramos esta actividad deportiva')}
        </h1>
        <Button onClick={() => navigate(-1)} variant="outline" className="min-h-11">
          {t('common.back', 'Volver')}
        </Button>
      </div>
    );
  }

  const title = cleanSportTitle(event.title) || event.title;
  const start = new Date(event.start_datetime);
  const timed = hasExplicitTime(event.start_datetime);
  const datePattern = i18n.language.toLowerCase().startsWith('es')
    ? "EEEE d 'de' MMMM yyyy"
    : 'EEEE d MMMM yyyy';
  const dateLabel = formatMadrid(start, datePattern, locale);
  const timeLabel = timed
    ? formatMadrid(start, 'HH:mm', locale)
    : t('events.timeTBC', 'Hora por confirmar');

  const isFavorite = favoriteIds.includes(event.id);
  const kindLabel =
    view.kind === 'match'
      ? t('sportsDetail.kind.match', 'Partido')
      : view.kind === 'tournament'
      ? t('sportsDetail.kind.tournament', 'Competición')
      : t('sportsDetail.kind.activity', 'Actividad');

  const ticketLabel =
    view.ticket.kind === 'register'
      ? t('eventDetail.register', 'Inscribirme')
      : view.ticket.kind === 'tickets'
      ? t('eventDetail.viewTickets', 'Ver entradas')
      : t('eventDetail.officialSite', 'Consultar en la web oficial');

  const handleFavorite = () => {
    if (!user) {
      navigate('/auth');
      return;
    }
    toggleFavorite.mutate({ eventId: event.id, isFavorite });
  };

  const handleCalendar = () => {
    try {
      const ics = buildEventIcs(
        {
          id: event.id,
          title,
          description: [event.competition, event.organizer_name].filter(Boolean).join(' · '),
          start_at: event.start_datetime,
          end_at: event.end_datetime,
          venue_name: event.venue_name,
          address: event.address,
          url: event.canonical_url ?? event.source_url,
        },
        { url: window.location.href },
      );
      const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = icsFileName(title);
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({
        title: t('eventDetail.calendarError', 'No se pudo crear el archivo de calendario'),
        variant: 'destructive',
      });
    }
  };

  const updatedAt = event.last_seen_at ?? event.updated_at;

  return (
    <div className="min-h-screen bg-background pb-28">
      <SEO title={`${title} | Deportes Málaga`} description={`${title} — ${event.venue_name}, ${event.city}.`} />

      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/95 backdrop-blur px-3 py-2">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="min-h-11 gap-2"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          {t('common.back', 'Volver')}
        </Button>
      </header>

      <main className="mx-auto w-full max-w-[880px] p-4 space-y-5">
        <figure className="overflow-hidden rounded-2xl border border-border/60">
          <img
            src={view.image.src}
            alt={view.image.illustrative
              ? t('sportsDetail.illustrativeAlt', 'Imagen ilustrativa de la disciplina')
              : title}
            className="w-full aspect-[16/9] object-cover"
            width={1088}
            height={608}
          />
          {view.image.illustrative && (
            <figcaption className="px-3 py-1.5 text-[11px] text-muted-foreground bg-muted/50">
              {t('sportsDetail.illustrative', 'Imagen ilustrativa: no es el cartel del evento.')}
            </figcaption>
          )}
        </figure>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{kindLabel}</Badge>
            <Badge variant="outline">
              {t(`sports.${event.sport_category}`, event.sport_category)}
            </Badge>
            {event.status !== 'scheduled' && (
              <Badge variant="destructive">
                {t(`sportsDetail.status.${event.status}`, event.status)}
              </Badge>
            )}
          </div>
          <h1 className="text-2xl font-bold leading-tight tracking-tight">{title}</h1>
          {event.competition && (
            <p className="text-sm text-muted-foreground">{event.competition}</p>
          )}
        </div>

        <Card>
          <CardContent className="p-4 space-y-2.5 text-sm">
            <p className="flex items-start gap-2">
              <CalendarDays className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <span className="first-letter:uppercase">{dateLabel}</span>
            </p>
            <p className="flex items-start gap-2">
              <Clock className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <span>{timeLabel}</span>
            </p>
            <p className="flex items-start gap-2">
              <Building2 className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <span style={{ overflowWrap: 'anywhere' }}>
                {event.venue_name || t('sportsDetail.venuePending', 'Recinto por confirmar')}
                {event.city ? ` · ${event.city}` : ''}
              </span>
            </p>
            {event.address && (
              <p className="flex items-start gap-2">
                <MapPin className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                <span style={{ overflowWrap: 'anywhere' }}>{event.address}</span>
              </p>
            )}
            <p className="flex items-start gap-2">
              <Ticket className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <span>
                {view.price === 'free'
                  ? t('sports.free', 'Gratis')
                  : view.price === 'known'
                  ? event.price_info
                  : t('sportsDetail.pricePending', 'Precio no acreditado por la fuente')}
              </span>
            </p>
          </CardContent>
        </Card>

        <div className="grid gap-2 sm:grid-cols-2">
          {view.directions ? (
            <Button asChild variant="outline" className="min-h-12 justify-center">
              <a href={view.directions.url} target="_blank" rel="noopener noreferrer">
                <Navigation className="h-5 w-5 mr-2" aria-hidden="true" />
                {t('eventDetail.howToGet', 'Cómo llegar')}
              </a>
            </Button>
          ) : (
            <Button asChild variant="outline" className="min-h-12 justify-center">
              <Link to="/map">
                <MapPin className="h-5 w-5 mr-2" aria-hidden="true" />
                {t('eventDetail.seeOnMap', 'Ver en el mapa')}
              </Link>
            </Button>
          )}
          <Button variant="outline" className="min-h-12 justify-center" onClick={handleCalendar}>
            <CalendarIcon className="h-5 w-5 mr-2" aria-hidden="true" />
            {t('eventDetail.addToCalendar', 'Añadir al calendario')}
          </Button>
        </div>
        {!view.directions && (
          <p className="text-xs text-muted-foreground">
            {t('eventDetail.locationPending', 'Ubicación pendiente de confirmar: no podemos dar indicaciones.')}
          </p>
        )}

        <Card>
          <CardContent className="p-4 space-y-3">
            <h2 className="text-sm font-semibold">
              {t('eventDetail.ticketInfoTitle', 'Información de entradas')}
            </h2>
            {view.ticket.url ? (
              <>
                <Button asChild className="w-full min-h-12">
                  <a href={view.ticket.url} target="_blank" rel="noopener noreferrer">
                    {ticketLabel}
                    <ExternalLink className="h-4 w-4 ml-2" aria-hidden="true" />
                  </a>
                </Button>
                {view.ticket.host && (
                  <p className="text-xs text-muted-foreground text-center">{view.ticket.host}</p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t('eventDetail.ticketPending', 'Enlace de entradas pendiente de confirmar.')}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Procedencia, discreta pero comprobable */}
        <section className="text-xs text-muted-foreground space-y-1">
          <p className="flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
            {event.source_name || event.source_url
              ? t('sportsDetail.source', 'Fuente: {{name}}', {
                  name: event.source_name || new URL(event.source_url!).hostname.replace(/^www\./, ''),
                })
              : t('sportsDetail.sourceUnknown', 'Fuente sin acreditar')}
          </p>
          {updatedAt && (
            <p>
              {t('sportsDetail.updated', 'Actualizado el {{date}}', {
                date: formatMadrid(new Date(updatedAt), 'd MMM yyyy · HH:mm', locale),
              })}
            </p>
          )}
        </section>
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/60 bg-card/95 backdrop-blur px-4 py-3 pb-safe">
        <div className="mx-auto flex max-w-[880px] gap-2">
          <Button
            variant="outline"
            size="lg"
            onClick={handleFavorite}
            disabled={toggleFavorite.isPending}
            aria-pressed={isFavorite}
            aria-label={isFavorite
              ? t('events.removeFromFavorites', 'Quitar de favoritos')
              : t('events.addToFavorites', 'Guardar')}
            className="flex-shrink-0 min-h-12 min-w-12"
          >
            <Heart className={isFavorite ? 'h-5 w-5 fill-red-500 text-red-500' : 'h-5 w-5'} />
          </Button>
          {view.ticket.url ? (
            <Button asChild size="lg" className="flex-1 min-h-12">
              <a href={view.ticket.url} target="_blank" rel="noopener noreferrer">
                {ticketLabel}
                <ExternalLink className="h-4 w-4 ml-2" aria-hidden="true" />
              </a>
            </Button>
          ) : view.directions ? (
            <Button asChild size="lg" className="flex-1 min-h-12">
              <a href={view.directions.url} target="_blank" rel="noopener noreferrer">
                <Navigation className="h-5 w-5 mr-2" aria-hidden="true" />
                {t('eventDetail.howToGet', 'Cómo llegar')}
              </a>
            </Button>
          ) : (
            <Button size="lg" variant="secondary" className="flex-1 min-h-12" onClick={handleCalendar}>
              <CalendarIcon className="h-5 w-5 mr-2" aria-hidden="true" />
              {t('eventDetail.addToCalendar', 'Añadir al calendario')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SportEventDetailPage;

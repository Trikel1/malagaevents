import { Link } from 'react-router-dom';
import { es, enUS, de, fr, it, pt, ja, zhCN, ru, ar, type Locale } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import { MapPin, Clock, Ticket, CalendarDays } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { SportEvent, SportCategory } from '@/types/sports';
import { cleanSportTitle } from '@/lib/sports';
import { formatMadrid } from '@/lib/madridTime';
import { hasExplicitTime } from '@/lib/eventTime';
import { resolveSportImage, sportItemKind, sportPriceState } from '@/lib/sportsDisplay';

const locales: Record<string, Locale> = {
  es, en: enUS, de, fr, it, pt, ja, zh: zhCN, ru, ar,
};
const resolveDateLocale = (language: string): Locale =>
  locales[language] ?? locales[language.split('-')[0].toLowerCase()] ?? es;

interface SportEventCardProps {
  event: SportEvent & { price_info?: string | null; address?: string | null; source_url?: string | null };
}

/**
 * Sports card. Everything shown is sourced: the hour appears only when the
 * source published one, the price only when it is accredited, and the picture
 * falls back to a discipline illustration that says so.
 */
const SportEventCard = ({ event }: SportEventCardProps) => {
  const { t, i18n } = useTranslation();
  const locale = resolveDateLocale(i18n.language);

  const start = new Date(event.start_at);
  const timed = hasExplicitTime(event.start_at);
  const dateLabel = formatMadrid(start, 'EEE d MMM', locale);
  const timeLabel = timed
    ? formatMadrid(start, 'HH:mm', locale)
    : t('events.timeTBC', 'Hora por confirmar');

  const sportCat = event.sport as SportCategory;
  const label = t(`sports.${sportCat}`, event.sport);
  const cleanTitle = cleanSportTitle(event.teams || event.title) || event.title;

  const image = resolveSportImage(event.imageUrl, event.sport);
  const kind = sportItemKind(event);
  const kindLabel =
    kind === 'match'
      ? t('sportsDetail.kind.match', 'Partido')
      : kind === 'tournament'
      ? t('sportsDetail.kind.tournament', 'Competición')
      : t('sportsDetail.kind.activity', 'Actividad');
  const price = sportPriceState(event.price_info);

  return (
    <Card className="overflow-hidden border-border/60 transition-colors focus-within:border-primary hover:border-primary/40">
      <Link
        to={`/sports/${event.id}`}
        className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
      >
        <div className="relative">
          <img
            src={image.src}
            alt={image.illustrative
              ? t('sportsDetail.illustrativeAlt', 'Imagen ilustrativa de la disciplina')
              : cleanTitle}
            loading="lazy"
            width={1088}
            height={608}
            className="w-full aspect-[16/9] object-cover"
          />
          <span className="absolute left-2 top-2 rounded-full bg-background/90 px-2 py-0.5 text-[11px] font-semibold">
            {kindLabel}
          </span>
        </div>

        <CardContent className="p-3 space-y-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="secondary" className="text-[11px] px-2 py-0.5">{label}</Badge>
            {event.competition && (
              <Badge variant="outline" className="text-[11px] px-2 py-0.5 truncate max-w-[160px]">
                {event.competition}
              </Badge>
            )}
          </div>

          <h3 className="text-sm font-semibold leading-snug line-clamp-2">{cleanTitle}</h3>

          <div className="text-xs text-muted-foreground space-y-1">
            <p className="flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
              <span className="capitalize">{dateLabel}</span>
            </p>
            <p className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
              <span>{timeLabel}</span>
            </p>
            <p className="flex items-start gap-1.5">
              <MapPin className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <span className="break-words" style={{ overflowWrap: 'anywhere' }}>
                {event.venue || t('sportsDetail.venuePending', 'Recinto por confirmar')}
                {event.city ? ` · ${event.city}` : ''}
              </span>
            </p>
            <p className="flex items-start gap-1.5">
              <Ticket className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                {price === 'free'
                  ? t('sports.free', 'Gratis')
                  : price === 'known'
                  ? event.price_info
                  : t('sportsDetail.pricePending', 'Precio no acreditado por la fuente')}
              </span>
            </p>
          </div>
        </CardContent>
      </Link>
    </Card>
  );
};

export default SportEventCard;

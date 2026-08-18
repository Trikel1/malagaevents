import { format } from 'date-fns';
import { es, enUS, de, fr, it, pt, ja, zhCN, ru, type Locale } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import { MapPin, Clock, Ticket, Tag } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { SportEvent, SportCategory } from '@/types/sports';
import SportIcon, { getSportIcon } from '@/components/sports/SportIcon';
import {
  cleanSportTitle,
  isRegistrationUrl,
  isFreeEvent,
} from '@/lib/sports';

const locales: Record<string, Locale> = {
  es, en: enUS, de, fr, it, pt, ja, zh: zhCN, ru,
};

interface SportEventCardProps {
  event: SportEvent & { price_info?: string | null; address?: string | null; source_url?: string | null };
}

const SportEventCard = ({ event }: SportEventCardProps) => {
  const { t, i18n } = useTranslation();
  const locale = locales[i18n.language] || es;
  const formattedDate = format(new Date(event.start_at), 'EEE d MMM · HH:mm', { locale });
  const sportCat = event.sport as SportCategory;
  const label = t(`sports.${sportCat}`, event.sport);
  const SportLucide = getSportIcon(event.sport);

  const cleanTitle = cleanSportTitle(event.teams || event.title);
  const isFree = isFreeEvent(event.price_info);
  const isRegister = isRegistrationUrl(event.ticketsUrl);
  // Internal ticket information only — no external checkout or map handoff.
  const ticketInfo = event.price_info
    ? event.price_info
    : isFree
    ? t('sports.free', 'Gratis')
    : isRegister
    ? t('sports.cta.registrationRequired', 'Requiere inscripción previa')
    : t('sports.cta.ticketsUnknown', 'Información de entradas no disponible');

  return (
    <Card className="overflow-hidden border-border/60 hover:border-primary/30 transition-colors">
      {/* Visual header — minimal pictogram, no decorative ring */}
      <div className="relative h-16 bg-gradient-to-br from-primary/8 to-primary/[0.03] flex items-center justify-center overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.05] pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle at 25% 25%, currentColor 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
          aria-hidden="true"
        />
        <SportLucide className="h-8 w-8 text-primary/90 relative" aria-hidden="true" />
      </div>

      <CardContent className="p-3 space-y-2">
        {/* Sport + Competition */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-1">
            <SportIcon sport={event.sport} className="h-3 w-3" />
            <span>{label}</span>
          </Badge>
          {event.competition && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 truncate max-w-[140px]">
              {event.competition}
            </Badge>
          )}
          {isFree && (
            <Badge className="text-[10px] px-1.5 py-0 gap-1 bg-sportsx-elevated text-sportsx-accent border-sportsx-line hover:bg-sportsx-elevated">
              <Tag className="h-2.5 w-2.5" />
              {t('sports.filter.free', 'Gratis')}
            </Badge>
          )}
        </div>

        <h3 className="text-sm font-semibold line-clamp-2 leading-snug">{cleanTitle}</h3>

        <div className="text-xs text-muted-foreground space-y-1">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3 flex-shrink-0" />
            <span className="capitalize">{formattedDate}</span>
          </div>
          <div className="flex items-center gap-1">
            <MapPin className="h-3 w-3 flex-shrink-0" />
            <span className="break-words" style={{ overflowWrap: 'anywhere' }}>
              {event.venue} · {event.city}
            </span>
          </div>
          {event.source_url && (
            <div className="flex items-center gap-1 pt-0.5">
              <Tag className="h-3 w-3 flex-shrink-0 opacity-60" aria-hidden="true" />
              <span className="text-[11px] text-muted-foreground">
                {t('sports.verifiedSource', 'Fuente oficial verificada')}
              </span>
            </div>
          )}
        </div>

        {/* Información de entradas — sin salidas externas */}
        <div className="flex items-start gap-1.5 pt-1 text-xs text-muted-foreground">
          <Ticket className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            <span className="font-medium text-foreground">
              {t('sports.ticketInfo', 'Información de entradas')}:
            </span>{' '}
            {ticketInfo}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

export default SportEventCard;

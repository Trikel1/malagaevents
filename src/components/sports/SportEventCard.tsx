import { format } from 'date-fns';
import { es, enUS, de, fr, it, pt, ja, zhCN, ru, type Locale } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import { MapPin, Clock, ExternalLink, Navigation, Tag } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { SportEvent, SportCategory } from '@/types/sports';
import SportIcon, { getSportIcon, getSportRing } from '@/components/sports/SportIcon';
import {
  cleanSportTitle,
  isRegistrationUrl,
  isFreeEvent,
  buildDirectionsUrl,
} from '@/lib/sports';
import { cn } from '@/lib/utils';

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
  const directions = buildDirectionsUrl(event.venue, event.city, event.address ?? null);

  const ctaLabel = event.ticketsUrl
    ? isRegister
      ? t('sports.cta.register', 'Inscribirme')
      : t('sports.cta.tickets', 'Entradas')
    : t('sports.cta.view', 'Ver actividad');
  const ctaUrl = event.ticketsUrl || event.source_url || null;

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
            <Badge className="text-[10px] px-1.5 py-0 gap-1 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20">
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
        </div>

        {/* CTAs */}
        <div className="flex gap-1.5 pt-1">
          {ctaUrl && (
            <Button
              size="sm"
              className="flex-1 h-7 text-xs"
              onClick={() => window.open(ctaUrl, '_blank', 'noopener,noreferrer')}
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              {ctaLabel}
            </Button>
          )}
          {directions && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs px-2"
              aria-label={t('sports.cta.directions', 'Cómo llegar')}
              onClick={() => window.open(directions, '_blank', 'noopener,noreferrer')}
            >
              <Navigation className="h-3 w-3" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default SportEventCard;

import { format } from 'date-fns';
import { es, enUS, de, fr, it, pt, ja, zhCN, ru, type Locale } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import { MapPin, Clock, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { SportEvent, SportCategory } from '@/types/sports';
import SportIcon, { getSportIcon } from '@/components/sports/SportIcon';

const locales: Record<string, Locale> = {
  es, en: enUS, de, fr, it, pt, ja, zh: zhCN, ru
};

interface SportEventCardProps {
  event: SportEvent;
}

const SportEventCard = ({ event }: SportEventCardProps) => {
  const { t, i18n } = useTranslation();
  const locale = locales[i18n.language] || es;
  const formattedDate = format(new Date(event.start_at), "EEE d MMM · HH:mm", { locale });
  const sportCat = event.sport as SportCategory;
  const label = t(`sports.${sportCat}`, event.sport);
  const SportLucide = getSportIcon(event.sport);

  return (
    <Card className="overflow-hidden border-border/60 hover:border-primary/30 transition-colors">
      {/* Visual header — gradient + sport icon (no images required) */}
      <div className="relative h-20 bg-gradient-to-br from-primary/15 via-primary/8 to-secondary/10 flex items-center justify-center overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.08] pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle at 25% 25%, currentColor 1px, transparent 1px), radial-gradient(circle at 75% 75%, currentColor 1px, transparent 1px)',
            backgroundSize: '28px 28px, 36px 36px',
          }}
          aria-hidden="true"
        />
        <SportLucide className="h-9 w-9 text-primary/80" aria-hidden="true" />
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
        </div>

        {/* Title / Teams */}
        <h3 className="text-sm font-semibold line-clamp-2 leading-snug">
          {event.teams || event.title}
        </h3>

        {/* Date + Venue compact */}
        <div className="text-xs text-muted-foreground space-y-1">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3 flex-shrink-0" />
            <span className="capitalize">{formattedDate}</span>
          </div>
          <div className="flex items-center gap-1">
            <MapPin className="h-3 w-3 flex-shrink-0" />
            <span className="break-words" style={{ overflowWrap: 'anywhere' }}>{event.venue} · {event.city}</span>
          </div>
        </div>

        {/* CTA */}
        {event.ticketsUrl && (
          <Button
            size="sm"
            className="w-full h-7 text-xs"
            onClick={() => window.open(event.ticketsUrl, '_blank')}
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            {t('sports.tickets')}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default SportEventCard;


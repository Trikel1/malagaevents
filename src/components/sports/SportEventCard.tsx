import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { MapPin, Clock, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { SportEvent, SportCategory } from '@/types/sports';
import { SPORT_ICONS, SPORT_LABELS } from '@/types/sports';

interface SportEventCardProps {
  event: SportEvent;
}

const SportEventCard = ({ event }: SportEventCardProps) => {
  const formattedDate = format(new Date(event.start_at), "EEE d MMM · HH:mm", { locale: es });
  const sportCat = event.sport as SportCategory;
  const icon = SPORT_ICONS[sportCat] || '🏅';
  const label = SPORT_LABELS[sportCat] || event.sport;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-3 space-y-2">
        {/* Sport + Competition */}
        <div className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <Badge variant="secondary" className="text-xs">
            {event.competition}
          </Badge>
        </div>

        {/* Title / Teams */}
        <h3 className="text-sm font-semibold line-clamp-2">
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
            <span className="line-clamp-1">{event.venue} · {event.city}</span>
          </div>
        </div>

        {/* CTA */}
        {event.ticketsUrl ? (
          <Button
            size="sm"
            className="w-full h-7 text-xs"
            onClick={() => window.open(event.ticketsUrl, '_blank')}
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            Entradas
          </Button>
        ) : (
          <Badge variant="outline" className="text-xs w-full justify-center">
            {label}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
};

export default SportEventCard;

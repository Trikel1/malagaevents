import { useNavigate } from 'react-router-dom';
import { Phone, Navigation, Crosshair, CircleDashed, Calendar, Building2, Cross, Trophy, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { MapMarker } from './types';

export const KIND_LABEL: Record<string, string> = {
  event: 'Evento',
  sport: 'Deporte',
  venue: 'Recinto',
  pharmacy: 'Farmacia',
  demo: 'Punto de interés',
};

export const KIND_ICON = {
  event: CalendarDays,
  sport: Trophy,
  venue: Building2,
  pharmacy: Cross,
  demo: Navigation,
} as const;

const fmtWhen = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Madrid',
  }).format(d);
};

interface MarkerDetailsProps {
  marker: MapMarker;
  onNavigated?: () => void;
}

/** Shared detail content for the bottom sheet (mobile) and side panel (desktop). */
export const MarkerDetails = ({ marker, onNavigated }: MarkerDetailsProps) => {
  const navigate = useNavigate();
  const kind = marker.kind ?? 'event';
  const Icon = KIND_ICON[kind as keyof typeof KIND_ICON] ?? Navigation;
  const when = fmtWhen(marker.startAt);

  const go = (path: string) => {
    onNavigated?.();
    navigate(path);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="secondary" className="rounded-full gap-1 border-0 bg-primary/10 text-primary">
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          {KIND_LABEL[kind] ?? KIND_LABEL.event}
        </Badge>
        {marker.onDuty && (
          <Badge variant="destructive" className="rounded-full text-[11px]">De guardia</Badge>
        )}
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          {marker.approximate ? (
            <>
              <CircleDashed className="h-3.5 w-3.5" aria-hidden="true" />
              Ubicación aproximada
            </>
          ) : (
            <>
              <Crosshair className="h-3.5 w-3.5" aria-hidden="true" />
              Ubicación exacta
            </>
          )}
        </span>
      </div>

      <h3 className="text-base font-semibold leading-snug">{marker.title}</h3>

      <dl className="space-y-1.5 text-sm">
        {when && (
          <div className="flex items-start gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
            <dd>{when}</dd>
          </div>
        )}
        {marker.address && (
          <div className="flex items-start gap-2 text-muted-foreground">
            <Navigation className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
            <dd>{marker.address}</dd>
          </div>
        )}
        {marker.subtitle && marker.subtitle !== marker.address && (
          <div className="flex items-start gap-2 text-muted-foreground">
            <Building2 className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
            <dd>{marker.subtitle}</dd>
          </div>
        )}
        {kind === 'pharmacy' && marker.phone && (
          <div className="flex items-start gap-2 text-muted-foreground">
            <Phone className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
            <dd>{marker.phone}</dd>
          </div>
        )}
      </dl>

      {(kind === 'event' || kind === 'sport') && (marker.eventId || marker.id) && (
        <Button className="w-full min-h-11" onClick={() => go(`/events/${marker.eventId ?? marker.id}`)}>
          Ver evento
        </Button>
      )}
      {kind === 'venue' && (
        <Button variant="secondary" className="w-full min-h-11" onClick={() => go('/venues')}>
          Ver recinto
        </Button>
      )}
      {kind === 'pharmacy' && (
        <Button variant="secondary" className="w-full min-h-11" onClick={() => go('/pharmacies')}>
          Ver farmacia
        </Button>
      )}
    </div>
  );
};

export default MarkerDetails;

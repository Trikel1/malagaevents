import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Phone, Navigation, Calendar as CalendarIcon, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import type { MapMarker } from './types';

interface MarkerSheetProps {
  marker: MapMarker | null;
  onClose: () => void;
}

const KIND_LABEL: Record<string, string> = {
  event: 'Evento',
  sport: 'Deporte',
  venue: 'Recinto',
  pharmacy: 'Farmacia',
  demo: 'Punto de interés',
};

export const MarkerSheet = ({ marker, onClose }: MarkerSheetProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const kind = marker?.kind ?? 'event';
  const directionsUrl = marker
    ? `https://www.google.com/maps/dir/?api=1&destination=${marker.lat},${marker.lng}`
    : '#';
  const dateLabel = marker?.startAt ? format(new Date(marker.startAt), "dd MMM · HH:mm") : null;

  return (
    <Drawer open={!!marker} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent aria-describedby={marker?.subtitle ? 'marker-desc' : undefined}>
        <DrawerHeader className="text-left space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
              {t(`map.kind.${kind}`, KIND_LABEL[kind] ?? 'Punto')}
            </Badge>
            {marker?.onDuty && (
              <Badge variant="destructive" className="text-[10px]">{t('map.onDuty')}</Badge>
            )}
          </div>
          <DrawerTitle className="text-base font-semibold leading-snug">{marker?.title}</DrawerTitle>
          {dateLabel && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <CalendarIcon className="h-3.5 w-3.5" aria-hidden />
              <span>{dateLabel}</span>
            </div>
          )}
          {marker?.address && (
            <div id="marker-desc" className="flex items-start gap-1.5 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden />
              <span>{marker.address}</span>
            </div>
          )}
          {marker?.subtitle && marker.subtitle !== marker.address && (
            <DrawerDescription className="text-xs">{marker.subtitle}</DrawerDescription>
          )}
        </DrawerHeader>
        <div className="px-4 pb-6 space-y-2">
          {(kind === 'event' || kind === 'sport') && (
            <Button
              className="w-full min-h-[44px]"
              onClick={() => {
                if (marker?.eventId || marker?.id) navigate(`/events/${marker.eventId ?? marker.id}`);
              }}
            >
              {t('map.viewEvent')}
            </Button>
          )}
          {kind === 'venue' && (
            <Button variant="secondary" className="w-full min-h-[44px]" onClick={() => navigate('/events')}>
              {t('map.viewVenueEvents')}
            </Button>
          )}
          {kind === 'pharmacy' && marker?.phone && (
            <Button asChild variant="secondary" className="w-full min-h-[44px]">
              <a href={`tel:${marker.phone}`} aria-label={`${t('common.call', 'Llamar')} ${marker.phone}`}>
                <Phone className="h-4 w-4 mr-2" />{marker.phone}
              </a>
            </Button>
          )}
          <Button asChild variant="outline" className="w-full min-h-[44px]">
            <a href={directionsUrl} target="_blank" rel="noreferrer">
              <Navigation className="h-4 w-4 mr-2" />
              {t('map.openDirections')}
            </a>
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default MarkerSheet;


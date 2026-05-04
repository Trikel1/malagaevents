import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Phone, Navigation } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { MapMarker } from './types';

interface MarkerSheetProps {
  marker: MapMarker | null;
  onClose: () => void;
}

export const MarkerSheet = ({ marker, onClose }: MarkerSheetProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const kind = marker?.kind ?? 'event';
  const directionsUrl = marker
    ? `https://www.google.com/maps/dir/?api=1&destination=${marker.lat},${marker.lng}`
    : '#';

  return (
    <Drawer open={!!marker} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <div className="flex items-center gap-2">
            <DrawerTitle className="text-base">{marker?.title}</DrawerTitle>
            {marker?.onDuty && <Badge variant="destructive" className="text-[10px]">{t('map.onDuty')}</Badge>}
          </div>
          {marker?.subtitle && (
            <DrawerDescription className="text-sm">{marker.subtitle}</DrawerDescription>
          )}
          {marker?.address && marker.address !== marker.subtitle && (
            <div className="text-xs text-muted-foreground mt-1">{marker.address}</div>
          )}
        </DrawerHeader>
        <div className="px-4 pb-6 space-y-2">
          {kind === 'event' || kind === 'sport' ? (
            <Button
              className="w-full"
              onClick={() => {
                if (marker?.eventId || marker?.id) navigate(`/events/${marker.eventId ?? marker.id}`);
              }}
            >
              {t('map.viewEvent')}
            </Button>
          ) : null}
          {kind === 'venue' && (
            <Button variant="secondary" className="w-full" onClick={() => navigate('/events')}>
              {t('map.viewVenueEvents')}
            </Button>
          )}
          {kind === 'pharmacy' && marker?.phone && (
            <Button asChild variant="secondary" className="w-full">
              <a href={`tel:${marker.phone}`}><Phone className="h-4 w-4 mr-2" />{marker.phone}</a>
            </Button>
          )}
          <Button asChild variant="outline" className="w-full">
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

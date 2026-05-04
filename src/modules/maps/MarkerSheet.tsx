import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { MapMarker } from './types';

interface MarkerSheetProps {
  marker: MapMarker | null;
  onClose: () => void;
}

export const MarkerSheet = ({ marker, onClose }: MarkerSheetProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <Drawer open={!!marker} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle className="text-base">{marker?.title}</DrawerTitle>
          {marker?.subtitle && (
            <DrawerDescription className="text-sm">{marker.subtitle}</DrawerDescription>
          )}
        </DrawerHeader>
        <div className="px-4 pb-6">
          <Button
            className="w-full"
            onClick={() => {
              if (marker) navigate(`/events/${marker.id}`);
            }}
          >
            {t('common.seeMore', 'Ver más')}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default MarkerSheet;

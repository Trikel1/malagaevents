import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import MarkerDetails from './MarkerDetails';
import type { MapMarker } from './types';

interface MarkerSheetProps {
  marker: MapMarker | null;
  onClose: () => void;
}

export const MarkerSheet = ({ marker, onClose }: MarkerSheetProps) => {
  return (
    <Drawer open={!!marker} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent>
        <DrawerHeader className="text-left pb-2">
          <DrawerTitle className="sr-only">{marker?.title ?? 'Detalle del punto'}</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-8">
          {marker && <MarkerDetails marker={marker} onNavigated={onClose} />}
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default MarkerSheet;

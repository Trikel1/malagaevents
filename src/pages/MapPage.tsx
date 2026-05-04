import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { MapPin } from 'lucide-react';
import { useEvents } from '@/hooks/useEvents';
import { useSportsEvents } from '@/hooks/useSportsEvents';
import { useAppMode } from '@/contexts/AppModeContext';
import { ModernMap } from '@/modules/maps/ModernMap';
import { MarkerSheet } from '@/modules/maps/MarkerSheet';
import type { MapMarker } from '@/modules/maps/types';

const MapPage = () => {
  const { t } = useTranslation();
  const { appMode } = useAppMode();
  const [selected, setSelected] = useState<MapMarker | null>(null);

  const { data: cultureEvents = [] } = useEvents({ limit: 200 });
  const { data: sportsEvents = [] } = useSportsEvents({});

  const markers: MapMarker[] = useMemo(() => {
    const fmt = (d?: string | null) =>
      d ? format(new Date(d), 'dd/MM/yyyy HH:mm') : '';

    if (appMode === 'deportes') {
      return sportsEvents
        .filter((e: any) => e.lat && e.lng)
        .map((e: any) => ({
          id: e.id,
          title: e.title,
          subtitle: [e.venue_name, fmt(e.start_datetime)].filter(Boolean).join(' · '),
          lat: Number(e.lat),
          lng: Number(e.lng),
        }));
    }

    return cultureEvents
      .filter((e) => e.lat && e.lng)
      .map((e) => ({
        id: e.id,
        title: e.title,
        subtitle: [e.venue_name, fmt(e.start_at)].filter(Boolean).join(' · '),
        lat: Number(e.lat),
        lng: Number(e.lng),
      }));
  }, [appMode, cultureEvents, sportsEvents]);

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground p-4 rounded-b-2xl">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          <h1 className="text-lg font-bold">{t('nav.map', 'Mapa')}</h1>
        </div>
        <p className="text-sm opacity-80 mt-1">
          {markers.length > 0
            ? `${markers.length} ${t('map.eventsOnMap', 'eventos en el mapa')}`
            : t('map.noGeoEvents', 'No hay eventos con ubicación exacta')}
        </p>
      </header>

      <div className="h-[calc(100vh-180px)] relative">
        <ModernMap markers={markers} onMarkerSelect={setSelected} />
      </div>

      <MarkerSheet marker={selected} onClose={() => setSelected(null)} />
    </div>
  );
};

export default MapPage;

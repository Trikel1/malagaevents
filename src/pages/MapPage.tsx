import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { format } from 'date-fns';
import { CalendarDays, MapPin } from 'lucide-react';
import { useEvents } from '@/hooks/useEvents';
import { useSportsEvents } from '@/hooks/useSportsEvents';
import { useAppMode } from '@/contexts/AppModeContext';

// Fix Leaflet default marker icons for Vite bundler
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const MALAGA_CENTER: [number, number] = [36.7213, -4.4214];

const MapPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { appMode } = useAppMode();

  const { data: cultureEvents = [] } = useEvents({ limit: 200 });
  const { data: sportsEvents = [] } = useSportsEvents({});

  const geoMarkers = useMemo(() => {
    if (appMode === 'deportes') {
      return sportsEvents
        .filter((e: any) => e.lat && e.lng)
        .map((e: any) => ({
          id: e.id,
          title: e.title,
          venue: e.venue_name,
          date: e.start_datetime,
          lat: Number(e.lat),
          lng: Number(e.lng),
        }));
    }

    return cultureEvents
      .filter(e => e.lat && e.lng)
      .map(e => ({
        id: e.id,
        title: e.title,
        venue: e.venue_name,
        date: e.start_at,
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
          {geoMarkers.length > 0
            ? `${geoMarkers.length} ${t('map.eventsOnMap', 'eventos en el mapa')}`
            : t('map.noGeoEvents', 'No hay eventos con ubicación exacta')}
        </p>
      </header>

      <div className="h-[calc(100vh-180px)]">
        <MapContainer
          center={MALAGA_CENTER}
          zoom={13}
          className="h-full w-full z-0"
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {geoMarkers.map((marker) => (
            <Marker key={marker.id} position={[marker.lat, marker.lng]}>
              <Popup>
                <div className="min-w-[180px]">
                  <h3 className="font-semibold text-sm leading-tight">{marker.title}</h3>
                  <p className="text-xs text-gray-600 mt-1">{marker.venue}</p>
                  {marker.date && (
                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" />
                      {format(new Date(marker.date), 'dd/MM/yyyy HH:mm')}
                    </p>
                  )}
                  <button
                    onClick={() => navigate(`/events/${marker.id}`)}
                    className="mt-2 text-xs text-blue-600 hover:underline"
                  >
                    {t('common.seeMore', 'Ver más')}
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
};

export default MapPage;

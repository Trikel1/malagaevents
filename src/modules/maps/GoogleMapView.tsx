import { useEffect, useRef, useState, useCallback } from 'react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import type { MapMarker } from './types';
import { DemoMapView } from './DemoMapView';

interface GoogleMapViewProps {
  markers: MapMarker[];
  selectedMarkerId?: string;
  onMarkerSelect?: (id: string) => void;
}

const MALAGA_CENTER = { lat: 36.7213, lng: -4.4214 };
const DEFAULT_ZOOM = 12;

export const GoogleMapView = ({ markers, onMarkerSelect }: GoogleMapViewProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'missing-key'>('loading');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [retryToken, setRetryToken] = useState(0);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
  const mapId = import.meta.env.VITE_GOOGLE_MAP_ID as string | undefined;

  // Initialize map (once)
  useEffect(() => {
    if (!apiKey || !mapId) {
      setStatus('missing-key');
      return;
    }
    if (!containerRef.current) return;

    let cancelled = false;
    setStatus('loading');

    try {
      setOptions({ key: apiKey, v: 'weekly', libraries: ['marker'] });
    } catch {
      // setOptions can only be called once; safe to ignore on retry
    }

    importLibrary('maps')
      .then(async ({ Map, InfoWindow }) => {
        if (cancelled || !containerRef.current) return;
        const map = new Map(containerRef.current, {
          center: MALAGA_CENTER,
          zoom: DEFAULT_ZOOM,
          mapId,
          disableDefaultUI: false,
          mapTypeControl: false,
          fullscreenControl: false,
          streetViewControl: false,
          clickableIcons: false,
        });
        mapRef.current = map;
        infoWindowRef.current = new InfoWindow();
        setStatus('ready');
      })
      .catch((err) => {
        console.error('[GoogleMapView] load error', err);
        if (cancelled) return;
        setErrorMsg(err?.message || 'Failed to load Google Maps');
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, mapId, retryToken]);

  // Update markers + clusterer when data changes
  useEffect(() => {
    const map = mapRef.current;
    if (status !== 'ready' || !map) return;

    let cancelled = false;

    (async () => {
      const { AdvancedMarkerElement, PinElement } = (await google.maps.importLibrary(
        'marker'
      )) as google.maps.MarkerLibrary;
      if (cancelled) return;

      // Clear previous
      clustererRef.current?.clearMarkers();
      markersRef.current.forEach((m) => (m.map = null));
      markersRef.current = [];

      const newMarkers = markers.map((m) => {
        const pin = new PinElement({
          background: 'hsl(173, 80%, 40%)',
          borderColor: '#ffffff',
          glyphColor: '#ffffff',
          scale: 1,
        });
        const marker = new AdvancedMarkerElement({
          position: { lat: m.lat, lng: m.lng },
          title: m.title,
          content: pin.element,
        });
        marker.addListener('click', () => {
          if (infoWindowRef.current) {
            const safeTitle = (m.title ?? '').replace(/</g, '&lt;');
            const safeSub = (m.subtitle ?? '').replace(/</g, '&lt;');
            infoWindowRef.current.setContent(
              `<div style="font-family: inherit; max-width: 220px;">
                 <div style="font-weight: 600; font-size: 13px; line-height: 1.3;">${safeTitle}</div>
                 ${safeSub ? `<div style="font-size: 12px; color: #555; margin-top: 4px;">${safeSub}</div>` : ''}
               </div>`
            );
            infoWindowRef.current.open({ map, anchor: marker });
          }
          onMarkerSelect?.(m.id);
          m.onClick?.();
        });
        return marker;
      });

      markersRef.current = newMarkers;
      clustererRef.current = new MarkerClusterer({ map, markers: newMarkers });
    })().catch((err) => console.error('[GoogleMapView] markers error', err));

    return () => {
      cancelled = true;
    };
  }, [markers, status, onMarkerSelect]);

  const handleRetry = useCallback(() => setRetryToken((n) => n + 1), []);

  if (status === 'missing-key') {
    return <DemoMapView markers={markers} onMarkerSelect={onMarkerSelect} />;
  }

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm pointer-events-none">
          <div className="text-sm text-muted-foreground">Cargando mapa…</div>
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 p-6">
          <div className="max-w-sm text-center space-y-3">
            <AlertTriangle className="h-8 w-8 mx-auto text-destructive" />
            <h3 className="font-semibold text-sm">Error al cargar el mapa</h3>
            <p className="text-xs text-muted-foreground break-words">{errorMsg}</p>
            <Button size="sm" onClick={handleRetry} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Reintentar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GoogleMapView;

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { MapMarker } from './types';

interface LeafletMapProps {
  markers: MapMarker[];
  center?: { lat: number; lng: number };
  zoom?: number;
  onMarkerSelect?: (id: string) => void;
  onMoveEnd?: (bounds: { north: number; south: number; east: number; west: number }) => void;
  userLocation?: { lat: number; lng: number } | null;
  flyTo?: { lat: number; lng: number; zoom?: number } | null;
}

const MALAGA_CENTER = { lat: 36.7213, lng: -4.4214 };

// Inline SVG pin (teal). data-URI to avoid fetching external assets.
const buildPinIcon = (color: string) =>
  L.divIcon({
    className: '',
    html: `<div style="position:relative;width:28px;height:36px;transform:translate(-14px,-36px);">
      <svg viewBox="0 0 28 36" width="28" height="36" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,.35));">
        <path d="M14 0C6.27 0 0 6.27 0 14c0 9.5 12.4 21 13 21.5.3.3.7.3 1 0 .6-.5 14-12 14-21.5C28 6.27 21.73 0 14 0z" fill="${color}"/>
        <circle cx="14" cy="14" r="5.5" fill="#ffffff"/>
      </svg>
    </div>`,
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -32],
  });

const KIND_COLORS: Record<string, string> = {
  event: 'hsl(173, 80%, 38%)',
  venue: 'hsl(265, 70%, 55%)',
  sport: 'hsl(150, 70%, 40%)',
  pharmacy: 'hsl(0, 75%, 55%)',
  demo: 'hsl(35, 80%, 50%)',
};
const PIN_DEFAULT = buildPinIcon(KIND_COLORS.event);
const PIN_APPROX = buildPinIcon(KIND_COLORS.demo);
const ICON_CACHE: Record<string, L.DivIcon> = {};
const pinFor = (m: MapMarker) => {
  if (m.approximate) return PIN_APPROX;
  const key = m.kind ?? 'event';
  if (!ICON_CACHE[key]) ICON_CACHE[key] = buildPinIcon(KIND_COLORS[key] ?? KIND_COLORS.event);
  return ICON_CACHE[key];
};

const userIcon = L.divIcon({
  className: '',
  html: `<div style="width:18px;height:18px;border-radius:50%;background:hsl(217,90%,55%);border:3px solid #fff;box-shadow:0 0 0 2px hsl(217,90%,55%/0.3),0 2px 6px rgba(0,0,0,.3);transform:translate(-9px,-9px);"></div>`,
  iconSize: [18, 18],
});

export const LeafletMap = ({
  markers,
  center = MALAGA_CENTER,
  zoom = 12,
  onMarkerSelect,
  onMoveEnd,
  userLocation,
  flyTo,
}: LeafletMapProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [center.lat, center.lng],
      zoom,
      zoomControl: false,
      attributionControl: true,
    });
    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      {
        subdomains: 'abcd',
        maxZoom: 19,
        attribution: '© OpenStreetMap © CARTO',
      }
    ).addTo(map);
    L.control.zoom({ position: 'topright' }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    map.on('moveend', () => {
      if (!onMoveEnd) return;
      const b = map.getBounds();
      onMoveEnd({
        north: b.getNorth(),
        south: b.getSouth(),
        east: b.getEast(),
        west: b.getWest(),
      });
    });

    // Ensure correct sizing after mount
    setTimeout(() => map.invalidateSize(), 0);

    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      userMarkerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update markers
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.clearLayers();
    markers.forEach((m) => {
      const marker = L.marker([m.lat, m.lng], {
        icon: m.approximate ? PIN_APPROX : PIN_DEFAULT,
        title: m.title,
      });
      const safeTitle = (m.title ?? '').replace(/[<>&]/g, (c) =>
        ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' } as any)[c]
      );
      const safeSub = (m.subtitle ?? '').replace(/[<>&]/g, (c) =>
        ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' } as any)[c]
      );
      marker.bindPopup(
        `<div style="font-family:inherit;max-width:220px;">
          <div style="font-weight:600;font-size:13px;line-height:1.3;">${safeTitle}</div>
          ${safeSub ? `<div style="font-size:12px;color:#555;margin-top:4px;">${safeSub}</div>` : ''}
        </div>`,
        { closeButton: false, offset: [0, -4] }
      );
      marker.on('click', () => {
        onMarkerSelect?.(m.id);
      });
      marker.addTo(layer);
    });
  }, [markers, onMarkerSelect]);

  // User location marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }
    if (userLocation) {
      userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], {
        icon: userIcon,
        interactive: false,
        keyboard: false,
      }).addTo(map);
    }
  }, [userLocation]);

  // Fly to programmatic
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyTo) return;
    map.flyTo([flyTo.lat, flyTo.lng], flyTo.zoom ?? 14, { duration: 0.8 });
  }, [flyTo]);

  return <div ref={containerRef} className="w-full h-full" style={{ background: '#e6eef3' }} />;
};

export default LeafletMap;

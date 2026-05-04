import { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { MapPin } from 'lucide-react';
import type { MapMarker } from './types';

interface DemoMapViewProps {
  markers: MapMarker[];
  onMarkerSelect?: (id: string) => void;
}

// Approximate Málaga province bbox
const BBOX = { minLat: 36.55, maxLat: 36.85, minLng: -4.65, maxLng: -4.20 };

const project = (lat: number, lng: number, w: number, h: number) => {
  const x = ((lng - BBOX.minLng) / (BBOX.maxLng - BBOX.minLng)) * w;
  const y = (1 - (lat - BBOX.minLat) / (BBOX.maxLat - BBOX.minLat)) * h;
  return { x, y };
};

export const DemoMapView = ({ markers, onMarkerSelect }: DemoMapViewProps) => {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(([e]) => {
      setSize({ w: e.contentRect.width, h: e.contentRect.height });
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const positioned = useMemo(
    () =>
      markers
        .filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng))
        .map((m) => ({ ...m, ...project(m.lat, m.lng, size.w, size.h) })),
    [markers, size]
  );

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.max(0.6, Math.min(4, z * (e.deltaY < 0 ? 1.15 : 0.87))));
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    setPan({
      x: dragRef.current.px + (e.clientX - dragRef.current.x),
      y: dragRef.current.py + (e.clientY - dragRef.current.y),
    });
  };
  const onPointerUp = () => {
    dragRef.current = null;
  };

  return (
    <div
      ref={wrapRef}
      className="relative w-full h-full overflow-hidden select-none touch-none cursor-grab active:cursor-grabbing"
      style={{
        background:
          'radial-gradient(ellipse at 30% 20%, hsl(200 60% 90%) 0%, hsl(195 50% 80%) 40%, hsl(190 55% 65%) 100%)',
      }}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* Decorative grid + coastline hint */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: 'center' }}
      >
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="hsl(200 30% 70% / 0.3)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
        {/* Stylized coastline (decorative only) */}
        <path
          d={`M 0 ${size.h * 0.78} Q ${size.w * 0.25} ${size.h * 0.7}, ${size.w * 0.5} ${size.h * 0.82} T ${size.w} ${size.h * 0.85} L ${size.w} ${size.h} L 0 ${size.h} Z`}
          fill="hsl(45 60% 88% / 0.5)"
          stroke="hsl(35 40% 60% / 0.6)"
          strokeWidth="1.5"
        />
        <text
          x={size.w * 0.5}
          y={size.h * 0.5}
          textAnchor="middle"
          fontSize="22"
          fontWeight="600"
          fill="hsl(173 50% 30% / 0.4)"
        >
          Málaga
        </text>
      </svg>

      {/* Markers */}
      <div
        className="absolute inset-0"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: 'center' }}
      >
        {positioned.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMarkerSelect?.(m.id);
              m.onClick?.();
            }}
            className="absolute -translate-x-1/2 -translate-y-full hover:scale-110 transition-transform"
            style={{ left: m.x, top: m.y }}
            title={m.title}
            aria-label={m.title}
          >
            <MapPin
              className="h-7 w-7 drop-shadow-md"
              style={{ color: 'hsl(173, 80%, 38%)', fill: 'hsl(173, 80%, 38%)' }}
              strokeWidth={1.5}
            />
          </button>
        ))}
      </div>

      {/* Demo badge */}
      <div className="absolute top-3 left-3 bg-background/90 backdrop-blur px-3 py-1.5 rounded-md shadow text-xs font-medium border">
        Modo demo · {positioned.length} ubicaciones
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-1">
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(4, z * 1.2))}
          className="h-8 w-8 bg-background/90 backdrop-blur rounded-md shadow border text-lg leading-none hover:bg-background"
          aria-label="Acercar"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(0.6, z / 1.2))}
          className="h-8 w-8 bg-background/90 backdrop-blur rounded-md shadow border text-lg leading-none hover:bg-background"
          aria-label="Alejar"
        >
          −
        </button>
      </div>
    </div>
  );
};

export default DemoMapView;

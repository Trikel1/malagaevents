import { useMemo, useState, useCallback, useRef } from 'react';
import Map, { Source, Layer, Marker, type MapRef } from 'react-map-gl/maplibre';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { MapMarker } from './types';

const MALAGA_CENTER = { longitude: -4.4214, latitude: 36.7213, zoom: 12 };

// Free, tokenless modern raster style (CARTO Voyager). Clean & modern look.
const MAP_STYLE: any = {
  version: 8,
  sources: {
    'carto-voyager': {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
        'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
        'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
      ],
      tileSize: 256,
      attribution: '© OpenStreetMap © CARTO',
    },
  },
  layers: [{ id: 'carto-voyager', type: 'raster', source: 'carto-voyager' }],
};

interface ModernMapProps {
  markers: MapMarker[];
  onMarkerSelect?: (marker: MapMarker) => void;
}

export const ModernMap = ({ markers, onMarkerSelect }: ModernMapProps) => {
  const mapRef = useRef<MapRef | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const geojson = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: markers.map((m) => ({
        type: 'Feature' as const,
        properties: { id: m.id, title: m.title, subtitle: m.subtitle ?? '' },
        geometry: { type: 'Point' as const, coordinates: [m.lng, m.lat] },
      })),
    }),
    [markers]
  );

  const handleClick = useCallback(
    (e: any) => {
      const feature = e.features?.[0];
      if (!feature) return;
      if (feature.layer.id === 'clusters') {
        const clusterId = feature.properties.cluster_id;
        const src: any = mapRef.current?.getMap().getSource('markers');
        src?.getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
          if (err) return;
          mapRef.current?.easeTo({
            center: feature.geometry.coordinates,
            zoom,
            duration: 500,
          });
        });
      } else if (feature.layer.id === 'unclustered-point') {
        const id = feature.properties.id;
        const m = markers.find((x) => x.id === id);
        if (m) onMarkerSelect?.(m);
      }
    },
    [markers, onMarkerSelect]
  );

  return (
    <Map
      ref={mapRef}
      mapLib={maplibregl as any}
      initialViewState={MALAGA_CENTER}
      mapStyle={MAP_STYLE}
      style={{ width: '100%', height: '100%' }}
      interactiveLayerIds={['clusters', 'unclustered-point']}
      onClick={handleClick}
      onMouseMove={(e) => {
        const f = e.features?.[0];
        setHoveredId(f?.properties?.id ?? null);
      }}
      cursor={hoveredId ? 'pointer' : 'grab'}
    >
      <Source
        id="markers"
        type="geojson"
        data={geojson}
        cluster
        clusterMaxZoom={14}
        clusterRadius={50}
      >
        <Layer
          id="clusters"
          type="circle"
          filter={['has', 'point_count']}
          paint={{
            'circle-color': [
              'step',
              ['get', 'point_count'],
              'hsl(173, 80%, 40%)',
              10,
              'hsl(173, 80%, 35%)',
              30,
              'hsl(173, 80%, 28%)',
            ],
            'circle-radius': ['step', ['get', 'point_count'], 18, 10, 24, 30, 32],
            'circle-stroke-width': 3,
            'circle-stroke-color': '#ffffff',
          }}
        />
        <Layer
          id="cluster-count"
          type="symbol"
          filter={['has', 'point_count']}
          layout={{
            'text-field': ['get', 'point_count_abbreviated'],
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-size': 13,
          }}
          paint={{ 'text-color': '#ffffff' }}
        />
        <Layer
          id="unclustered-point"
          type="circle"
          filter={['!', ['has', 'point_count']]}
          paint={{
            'circle-color': 'hsl(173, 80%, 40%)',
            'circle-radius': 8,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
          }}
        />
      </Source>
    </Map>
  );
};

export default ModernMap;

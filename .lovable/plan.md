# Reemplazo del mapa: Google Maps JS API

Sustituir MapLibre + tiles de OpenStreetMap por **Google Maps JavaScript API** con estilo moderno (Map ID), clustering de marcadores e InfoWindow al seleccionar.

## Archivos a modificar (mínimos)

1. `src/modules/maps/GoogleMapView.tsx` *(nuevo)* — wrapper Google Maps con loader, clustering, InfoWindow, fallback si falta API key.
2. `src/pages/MapPage.tsx` — cambiar import `ModernMap` → `GoogleMapView` (1 línea de import + 1 línea en JSX). El resto del page (header, sheet, hooks) se mantiene.
3. `package.json` — añadir `@googlemaps/js-api-loader` y `@googlemaps/markerclusterer`.

Archivos no tocados: routing, theme, Tailwind, hooks de datos, otros pages.

## Variables de entorno (sin valores en código)

- `VITE_GOOGLE_MAPS_API_KEY` — clave de Google Maps JS API
- `VITE_GOOGLE_MAP_ID` — Map ID con estilo personalizado (creado en Google Cloud Console → Map Styles)

Si falta cualquiera de las dos en runtime, el componente muestra un panel amigable con instrucciones (sin romper la app). Si la API falla al cargar, botón "Reintentar".

## Detalles técnicos

- Loader: `@googlemaps/js-api-loader` con `libraries: ['marker']` para `AdvancedMarkerElement`.
- Mapa: `mapId` (estilo cloud-based moderno), `disableDefaultUI: false`, `mapTypeControl: false`, `fullscreenControl: false`, `streetViewControl: false`.
- Centro: Málaga `(36.7213, -4.4214)`, zoom `12`.
- Clustering: `@googlemaps/markerclusterer` (`MarkerClusterer`) con renderer por defecto.
- Selección: click en marcador → abre `InfoWindow` con título/subtítulo + llama `onMarkerSelect(id)` para que `MapPage` abra el `MarkerSheet` existente.
- Performance: instancia de mapa creada una sola vez (ref); marcadores se actualizan en `useEffect` al cambiar `markers` (limpia anteriores, crea nuevos, refresca cluster).
- Responsive: contenedor `width:100%; height:100%`; el page ya define `h-[calc(100vh-180px)]`.

## Contrato de marcadores

Sin cambios. `GoogleMapView` acepta el mismo `MapMarker[]` que `ModernMap`:

```ts
{ id, lat, lng, title?, subtitle?, onClick? }
```

Props extra opcionales: `selectedMarkerId?: string`, `onMarkerSelect?: (id: string) => void`.

## Limpieza opcional

`src/modules/maps/ModernMap.tsx` y `MarkerSheet.tsx` permanecen. `MarkerSheet` se sigue usando. `ModernMap` queda huérfano — puedo borrarlo en este mismo cambio si confirmas.

## Pasos tras aprobación

1. Instalar deps + crear `GoogleMapView.tsx`.
2. Editar import/JSX en `MapPage.tsx`.
3. Pedir las dos secrets (`VITE_GOOGLE_MAPS_API_KEY`, `VITE_GOOGLE_MAP_ID`) — sin estos valores el mapa muestra el fallback pero la app sigue funcionando.
4. QA: cargar `/map`, verificar tiles modernos de Google, clustering al alejar zoom, click en marcador abre `MarkerSheet`.

## Notas sobre la API key

`VITE_GOOGLE_MAPS_API_KEY` se expone en el bundle del cliente (es la naturaleza de Google Maps JS). **Obligatorio** restringir la key en Google Cloud Console por **HTTP referrer** a tus dominios (`*.lovable.app`, dominio custom). Esto es estándar y seguro siempre que la restricción esté activa.

## Estado actual

- **Scroll del desplegable de farmacia**: el `PopoverContent` usa `max-h-[80vh] flex flex-col` con `ScrollArea` interna `flex-1 min-h-0`. Cuando el popover no tiene altura resuelta (porque `max-h` solo limita, no fija), el viewport interno de `ScrollArea` puede colapsar y la lista se ve cortada sin permitir scroll.
- **Cobertura de datos**: `pharmacies_directory` solo tiene **20 farmacias** (datos *fallback* hardcodeados) y `pharmacies_guard` solo cubre 17 municipios. La provincia de Málaga tiene >700 farmacias. La razón: el scraper actual de `icofma.es` es JS-pesado y casi nunca devuelve datos, por lo que cae al *fallback* de 20 entradas.

## Cambios

### 1. Fix de scroll del desplegable (`src/pages/PharmaciesPage.tsx`, ~líneas 201-251)

- Cambiar `max-h-[80vh]` por **`h-[70vh]`** en `PopoverContent` para que el flex tenga altura resuelta y la `ScrollArea` interna pueda calcular `flex-1` correctamente.
- Añadir `collisionPadding={16}` y `sideOffset={6}` al `PopoverContent` para que no se salga del viewport en móvil.
- Añadir botón fijo arriba de la lista: **"Toda la provincia"** que pase `municipality=undefined` al hook (ya soportado) para cargar el directorio completo.

### 2. Hook `usePharmacyDirectory` (`src/hooks/usePharmacies.ts`)

- Implementar **paginación por rangos** (`.range(from, to)` en bucle de 1000 filas) para superar el límite por defecto de 1000 filas de Supabase y poder devolver el directorio entero (>700 entradas).
- Cuando `municipality` es `undefined`, devolver TODAS las farmacias de la provincia ordenadas por municipio + nombre.

### 3. Vista "Todas las farmacias" (`src/pages/PharmaciesPage.tsx`, sección final)

- Cuando `municipality === 'Toda la provincia'` (o un valor sentinela), mostrar el listado completo agrupado por municipio con cabeceras *sticky*.
- Mantener filtrado por buscador (`search`) y orden por distancia si el usuario activa "Cerca de mí".

### 4. Edge function `scrape-pharmacies` — fuente exhaustiva con Overpass API (OpenStreetMap)

OpenStreetMap mantiene un inventario muy completo y geocodificado de farmacias en Málaga capital y provincia, accesible vía la **Overpass API** (gratis, sin API key, sin necesidad de Firecrawl).

- Añadir nueva función `scrapeFromOverpass()` que consulte:
  ```
  area["ISO3166-2"="ES-MA"]->.malaga;
  ( node["amenity"="pharmacy"](area.malaga);
    way["amenity"="pharmacy"](area.malaga);
    relation["amenity"="pharmacy"](area.malaga); );
  out center tags;
  ```
- Mapear cada elemento a `{ name, address, municipality, phone, lat, lng }` usando los tags `name`, `addr:street + addr:housenumber`, `addr:city` (o el más cercano `addr:suburb`), `phone`/`contact:phone`, y `lat`/`lng` (de `center` para `way`/`relation`).
- Filtrar entradas sin nombre o sin coordenadas.
- Hacer esta la **fuente primaria** del directorio (antes que ICOFMA/Firecrawl). Mantener las anteriores como fallback.
- Upsert por `dedupe_key` para no duplicar.
- Esperado: ~700-900 farmacias en `pharmacies_directory` cubriendo los 103 municipios de la provincia.

### 5. Re-ejecución del scraper

Tras desplegar la función, invocarla una vez (`supabase.functions.invoke('scrape-pharmacies')`) para poblar el directorio completo. La cron/scheduler existente la mantendrá actualizada.

## Resultado esperado

- El desplegable de localidad hace scroll suavemente con todas las localidades visibles y cabeceras *sticky* por zona.
- Al elegir "Toda la provincia" se muestran cientos de farmacias agrupadas por municipio.
- Al seleccionar cualquier municipio (Marbella, Ronda, Antequera, Estepona, etc.), aparecen las farmacias reales de ese municipio, no solo 1 entrada de ejemplo.
- La búsqueda por texto y el orden por cercanía siguen funcionando sobre el dataset completo.

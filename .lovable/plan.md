## Objetivo

Eliminar cualquier generación sintética de turnos de guardia de farmacias. La app solo debe mostrar guardias respaldadas por datos oficiales; si no hay datos, se muestra un aviso claro y no se inventan turnos.

Alcance: farmacias únicamente. No se tocan eventos, deportes, mapa, auth, i18n ni el esquema de base de datos.

## Cambios por archivo

### 1. `supabase/functions/scrape-pharmacies/index.ts`
- Eliminar la constante `FALLBACK_PHARMACIES`.
- Eliminar la función `generateDutySchedule()`.
- En el bloque de GUARDIA:
  - Si Firecrawl + Jina+AI devuelven `< 5` farmacias con `duty_date` válida, **no** borrar las filas existentes de `pharmacies_guard` y **no** insertar nada.
  - Devolver un JSON explícito: `success: true` (parcial), `source_status: "official_data_unavailable"`, `guardia_inserted: 0`, `guardia_scraped: 0`, `guardia_source: "none"`, más el resultado del directorio.
  - Cuando sí haya datos, exigir `duty_date` explícita en cada fila (descartar las que no la traigan); solo entonces se procede al `delete` de filas futuras y al `insert` batch.
- En el bloque de DIRECTORIO:
  - Mantener el orden Overpass (OSM) → Firecrawl → Jina+AI.
  - Eliminar el fallback final que usaba `FALLBACK_PHARMACIES` para poblar `pharmacies_directory`. Si todas las fuentes fallan, no insertar nada y reportar `directory_source: "none"`, `directory_upserted: 0`.
- Añadir `source_status` al payload de respuesta en éxito y en fallo.

### 2. `src/hooks/usePharmacies.ts`
- Eliminar el bloque de rotación determinista dentro de `usePharmaciesOnDuty` (todo el fallback que consulta `pharmacies_directory`, calcula `dayIdx`, genera `id: fallback-*` y `source_ref: 'fallback-rotation'`, y marca `__fallback: true`).
- Si `pharmacies_guard` no devuelve filas para la fecha y municipio, devolver `[]` directamente.
- `usePharmacyDirectory` y `usePharmacyMunicipalities` no cambian.

### 3. `src/pages/PharmaciesPage.tsx`
- Quitar la lógica y el banner `dutyFallback` (`{dutyFallback && …}`) y todas las referencias a `__fallback` en la carta y en el sort.
- Quitar la prop `fallback` de `PharmacyCard` (y su Badge ámbar). El badge se muestra en verde siempre, porque cualquier fila ya es oficial.
- Reemplazar el mensaje vacío actual por:
  > "No hay datos oficiales verificados de farmacias de guardia para esta fecha y localidad. Consulta la fuente oficial antes de desplazarte."
  Traducible con clave `pharmacies.noOfficialData`.
- La sección "Todas las farmacias en {municipio}" (directorio) sigue tal cual — sigue apoyándose en OSM y se mantiene visualmente separada.

### 4. Pruebas (`src/test/pharmacies-no-fallback.test.ts` — nuevo)
- Test unitario sobre `usePharmaciesOnDuty`: con `pharmacies_guard` vacío y `pharmacies_directory` con filas, el hook debe devolver `[]` (mock del cliente supabase).
- Test que verifica que no se generan ids con prefijo `fallback-` ni `source_ref` con valor `fallback-rotation` bajo ninguna combinación.
- Ejecutar `bunx vitest run` y la build.

### 5. Diagnóstico previo (SOLO preparado, NO ejecutado)

Se dejarán en la respuesta al usuario, sin lanzarlas contra la base:

```sql
-- (a) Turnos sintéticos ya guardados
SELECT source_ref, COUNT(*) AS filas
FROM public.pharmacies_guard
WHERE source_ref IN ('fallback', 'fallback-rotation')
GROUP BY source_ref;

-- (b) Filas del directorio que coinciden con nombres de FALLBACK_PHARMACIES
SELECT id, name, municipality, source_ref
FROM public.pharmacies_directory
WHERE name IN (
  'Farmacia Alameda Principal','Farmacia Larios','Farmacia El Corte Inglés',
  'Farmacia Huelin','Farmacia Teatinos','Farmacia Torremolinos Centro',
  'Farmacia Benalmádena Pueblo','Farmacia Fuengirola Centro','Farmacia Marbella Centro',
  'Farmacia Estepona','Farmacia Ronda','Farmacia Antequera','Farmacia Vélez-Málaga',
  'Farmacia Nerja','Farmacia Coín','Farmacia Alhaurín de la Torre','Farmacia Mijas Costa',
  'Farmacia Rincón de la Victoria','Farmacia Cártama','Farmacia Torrox'
)
ORDER BY municipality, name;
```

No se propone eliminación de datos hasta revisar el diagnóstico contigo.

## Fuera de alcance
- No se tocan `events`, `sports_events`, mapas, tickets, auth, i18n global, ni migraciones de esquema.
- No se elimina ninguna fila de base de datos en esta fase.

## Verificación
- `bunx vitest run` (nuevo archivo de test verde).
- Build limpio.
- Reporte final con: archivos modificados, salida de tests, y las dos consultas SQL de diagnóstico listas para que las apruebes antes de un eventual borrado.

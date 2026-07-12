## Fase 3B — Auditoría de filtros de Eventos (sin implementación)

### 1. Archivos revisados
- `src/pages/EventsPage.tsx` (322 l) — orquesta filtros, lee `searchParams` (`category`, `filter=weekend`), estado local `filters`.
- `src/hooks/useEventsOptimized.ts` (345 l) — hook principal de listado; construye query Supabase.
- `src/hooks/useEvents.ts` (335 l) — versión legacy, aún importada.
- `src/components/events/FilterDrawer.tsx` (217 l) — panel de filtros (categorías, gratis, weekend).
- `src/components/events/CategoryChip.tsx` — chips visuales de categoría.
- `src/components/events/LocationFilter.tsx` (286 l) — filtro por localidad.
- `src/components/events/VenueGroupDropdown.tsx` / `VenueGroupFilter.tsx` / `VenueFilter.tsx` — filtro por recintos.
- `src/components/events/EventCard.tsx`, `EventImage.tsx`.

### 2. Campos reales disponibles en `events`
Relevantes para filtros: `category` (texto), `event_type` (texto), `tags` (text[] — **vacío en 1.430/1.430**), `is_free` (bool, 909 free), `ticket_url` / `buy_url` (1.424 con ticket), `price_info`, `start_at`, `end_at`, `venue_id` (1.320), `location_id` (1.383), `venue_name*`, `location_name*`, `province`, `age_restriction` (texto libre), `accessibility_info`, `image_url`, `dedupe_key`, `source_id`, `status`.

Distribución `category`: other 744, theater 270, music 171, exhibitions 90, ticketing 87, venue 32, nightlife 26, festivals 3, **kids 3**, sports 2, conferences 1, workshops 1.
Distribución `event_type`: other 1.116, music 137, theater 62, comedy 31, nightlife 30, festival 11, exhibitions 10, conferences 9+10, **kids 7**, workshops 3, sports 4.

Tablas complementarias: `event_occurrences`, `venues`, `locations`, `venue_aliases`, `locality_aliases`, `favorites`.

### 3. Filtros actuales (implementados)
- **Fecha**: `todayOnly`, `weekendOnly` (lógica dinámica vie–dom), rango `dateFrom/dateTo`; por defecto `>= now`.
- **Categoría** (multi) vía `in('category', …)`.
- **Gratis** vía `eq('is_free', true)`.
- **Localidad** (LocationFilter → `location_id` / `location_normalized`).
- **Recinto** (VenueGroupDropdown → `venue_id` / grupos canónicos).
- **Búsqueda texto** (título/descr, `title_normalized`).
- Modo cultural vs deportes: aislado; deportes usa otras tablas.

### 4. Filtros que existen pero pueden fallar
- **Categoría "kids"**: solo 3 eventos → chip prácticamente vacío.
- **Festivales**: solo 3 en `category` (11 en `event_type`) → discrepancia entre `category` y `event_type`.
- **Exhibiciones / Museos**: 90 en `category`, sin distinguir museo permanente vs exposición temporal.
- **`tags` está vacío en toda la tabla** → cualquier filtro que dependa de tags no funcionaría hoy.
- **`age_restriction`** es texto libre no normalizado → no explotable como filtro.
- Hay 744 eventos en `category=other` (52%) que quedan fuera de cualquier chip específico.

### 5. Filtros solicitados vs estado
| Filtro | Estado | Cómo |
|---|---|---|
| Hoy | ✅ | `todayOnly` |
| Mañana | ❌ falta | derivable de `start_at` |
| Este finde | ✅ | `weekendOnly` |
| Esta semana | ❌ falta | derivable |
| Infantil / Familiar | ⚠️ parcial | `category=kids` (3 ev.), sin `is_family_friendly` |
| Conciertos | ✅ | `category=music` |
| Teatro | ✅ | `category=theater` |
| Festivales | ⚠️ | mezcla `category` + `event_type` |
| Museos / Exposiciones | ⚠️ | `category=exhibitions`, sin subtipo |
| Gratis | ✅ | `is_free` |
| Cerca de mí | ❌ falta | `lat/lng` existen; hace falta geoloc cliente + orden por distancia |
| Por localidad | ✅ | LocationFilter |
| Por recinto | ✅ | VenueGroupDropdown |
| Con entradas | ⚠️ | `ticket_url`/`buy_url` existen, sin chip |
| Al aire libre | ❌ falta | no hay campo `outdoor` |

### 6. Gaps para Infantil/Familiar
- Solo 3–7 eventos etiquetados como kids sobre 1.430 → la sección quedaría casi vacía.
- No hay campos `is_family_friendly`, `age_min`, `age_max`, `audience`.
- `age_restriction` no está normalizado; no hay heurística activa que marque "familiar" a partir de título/venue (títeres, teatro infantil, planetario, museos participativos, cuentacuentos, talleres, parques).
- `tags` no se está poblando durante la ingesta.

### 7. Riesgos de implementar solo en frontend
- Filtrar por reglas heurísticas en cliente sobre 1.430 filas es barato pero **inconsistente** (cada componente reinterpreta el título).
- Muchos eventos "familiares" quedarían fuera al depender solo de `category=kids`.
- `event_type` vs `category` divergen → resultados distintos según el chip.
- Un chip "Al aire libre" sin datos daría **listas vacías** y romperá la percepción de calidad.
- Cambiar filtros sin poblar `tags`/columnas derivadas obliga a re-tocar el frontend cuando lleguen los datos.

### 8. Propuesta de implementación en 3 fases pequeñas

**Fase 3B-1 — Filtros temporales + normalización de chips (solo frontend, sin BD)**
- Añadir presets: Hoy, Mañana, Esta semana, Este finde (ya), Próximos 30 días.
- Añadir chips: "Gratis" (ya) + "Con entradas" (usa `ticket_url`/`buy_url`).
- Unificar Festivales/Exposiciones usando OR sobre `category` **y** `event_type` desde el hook.
- Añadir "Cerca de mí" con `navigator.geolocation` + orden por distancia (no filtro binario) usando `lat/lng` ya presentes.
- Sin cambios de esquema, sin ingesta.

**Fase 3B-2 — Enriquecimiento Familiar/Infantil (BD + backfill controlado)**
- Migración: añadir a `events` columnas `is_family_friendly boolean`, `audience text` (`kids|family|adults|all`), `age_min int`, `age_max int`, `is_outdoor boolean` (todas nullable, default null).
- Función `backfill_family_flags()` con heurística por palabras clave en `title_normalized` + venue (títeres, infantil, familiar, cuentacuentos, taller, planetario, aula, museo interactivo, parque…) y edad extraída de `age_restriction`.
- Índices parciales para `is_family_friendly=true` y `audience`.
- No tocar ingesta aún; solo backfill idempotente.

**Fase 3B-3 — Chips avanzados + integración en adaptadores**
- Chips: Infantil, Familiar, Al aire libre, con edad (0-3 / 4-8 / 9-12).
- Actualizar `_shared/ingestion/normalize.ts` para poblar los nuevos campos en dry-run.
- Panel `/admin → Ingesta` muestra cobertura por columna.
- Documentar en `mem://features/event-filters-ux-v4`.

### 9. Primer prompt recomendado para implementación segura
> "Implementa la Fase 3B-1: añade en `EventsPage` y `FilterDrawer` los presets temporales Hoy/Mañana/Esta semana/Este finde y los chips 'Gratis' (ya existente) y 'Con entradas' (usando `ticket_url` o `buy_url`). Unifica Festivales y Museos/Exposiciones aplicando OR entre `category` y `event_type` en `useEventsOptimized`. Añade orden opcional 'Cerca de mí' usando `navigator.geolocation` y `lat/lng` sin filtrar. No modifiques base de datos, edge functions, ingesta, `sync-events`, deportes, farmacias, auth ni rutas. Verifica con `tsgo`."

### 10. Confirmaciones
- No se ha modificado código, BD, edge functions ni ingesta.
- `WRITE_ENABLED` sigue en false; `sync-events` intacto.
- 56 fuentes siguen `enabled=false`, `robots_ok=false`.

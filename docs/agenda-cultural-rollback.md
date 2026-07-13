# Agenda Cultural provincial — Rollback

Rollback ordenado de las migraciones aditivas de la Fase 1 y siguientes.
Todo es reversible y no destruye datos previos: solo elimina objetos añadidos.

## Orden inverso recomendado

```sql
-- 1. Columnas añadidas a event_sources
ALTER TABLE public.event_sources
  DROP COLUMN IF EXISTS paused_reason,
  DROP COLUMN IF EXISTS consecutive_errors,
  DROP COLUMN IF EXISTS last_error_at,
  DROP COLUMN IF EXISTS last_success_at,
  DROP COLUMN IF EXISTS polling_interval,
  DROP COLUMN IF EXISTS terms_reviewed_at,
  DROP COLUMN IF EXISTS licence,
  DROP COLUMN IF EXISTS trust_level,
  DROP COLUMN IF EXISTS source_type,
  DROP COLUMN IF EXISTS municipality_id,
  DROP COLUMN IF EXISTS scope;

-- 2. Columnas añadidas a venues
ALTER TABLE public.venues
  DROP COLUMN IF EXISTS official_url,
  DROP COLUMN IF EXISTS accessibility_data,
  DROP COLUMN IF EXISTS locality_or_district,
  DROP COLUMN IF EXISTS municipality_id;

-- 3. Constraint y columnas añadidas a events
ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_lifecycle_status_check;
ALTER TABLE public.events
  DROP COLUMN IF EXISTS lifecycle_status,
  DROP COLUMN IF EXISTS expires_at,
  DROP COLUMN IF EXISTS price_to,
  DROP COLUMN IF EXISTS price_from,
  DROP COLUMN IF EXISTS language,
  DROP COLUMN IF EXISTS minimum_age,
  DROP COLUMN IF EXISTS confidence_score,
  DROP COLUMN IF EXISTS first_seen_at,
  DROP COLUMN IF EXISTS verified_at,
  DROP COLUMN IF EXISTS locality_or_district,
  DROP COLUMN IF EXISTS municipality_id;

-- 4. Índices añadidos (por si quedaron huérfanos)
DROP INDEX IF EXISTS public.uq_events_source_external;
DROP INDEX IF EXISTS public.idx_events_verified_at;
DROP INDEX IF EXISTS public.idx_events_lat_lng;
DROP INDEX IF EXISTS public.idx_events_category_start;
DROP INDEX IF EXISTS public.idx_events_municipality_lifecycle;
DROP INDEX IF EXISTS public.idx_events_start_at;

-- 5. Alias y municipios (elimina fila registrada por adaptador CSV)
DELETE FROM public.event_sources WHERE slug = 'ayto-malaga-csv';
DROP TABLE IF EXISTS public.municipality_aliases;
DROP TABLE IF EXISTS public.municipalities;
```

## Notas

- Ningún `ALTER TABLE ... DROP` destruye datos que existieran antes del sprint,
  porque todas las columnas eliminadas se añadieron en este sprint.
- Los adaptadores existentes (`ayto-malaga`, `teatro-cervantes`, etc.) permanecen
  intactos y siguen operativos; el rollback no toca sus filas en `event_sources`.
- Las tablas de `sports_*`, `pharmacies_*`, `auth`, y `user_roles` NO se tocan.
- La ruta frontend `/agenda/:municipalitySlug` es puramente aditiva. Para
  desactivarla, retirar la línea correspondiente en `src/App.tsx`.

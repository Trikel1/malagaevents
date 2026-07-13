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

## Fase 4-5 · Seed de fuentes prioritarias

Todas las fuentes P0/P1 seedadas en la Fase 4 tienen slug con prefijo `src-` y
quedan registradas como `enabled=false`, `paused_reason='pending_review'`,
`adapter_key='pending'`. Para revertir el seed sin tocar fuentes preexistentes:

```sql
DELETE FROM public.event_sources
WHERE adapter_key = 'pending'
  AND slug LIKE 'src-%';
```

El componente `SourceHealth` (`src/components/admin/SourceHealth.tsx`) es
puramente presentacional; eliminar el archivo y su import en
`src/pages/AdminPage.tsx` deshace la Fase 5 sin efectos colaterales.

## Corrección INE 2026 · códigos oficiales

La migración correctiva reasignó 24 códigos INE en `public.municipalities`
para alinearlos con el fichero oficial del INE 2026 (hoja 29). El cambio es
solo de `ine_code`; nombres, slugs, IDs, aliases, coordenadas y FKs quedan
intactos. Rollback exacto a los valores previos (usa la misma técnica en dos
fases para evitar colisiones del `UNIQUE`):

```sql
BEGIN;

-- Fase 1: temporales
UPDATE public.municipalities
SET ine_code = CASE slug
  WHEN 'montecorto' THEN 'RB001' WHEN 'periana' THEN 'RB002'
  WHEN 'pizarra' THEN 'RB003' WHEN 'pujerra' THEN 'RB004'
  WHEN 'rincon-de-la-victoria' THEN 'RB005' WHEN 'riogordo' THEN 'RB006'
  WHEN 'ronda' THEN 'RB007' WHEN 'salares' THEN 'RB008'
  WHEN 'sayalonga' THEN 'RB009' WHEN 'sedella' THEN 'RB010'
  WHEN 'serrato' THEN 'RB011' WHEN 'sierra-de-yeguas' THEN 'RB012'
  WHEN 'teba' THEN 'RB013' WHEN 'tolox' THEN 'RB014'
  WHEN 'torrox' THEN 'RB015' WHEN 'totalan' THEN 'RB016'
  WHEN 'valle-de-abdalajis' THEN 'RB017' WHEN 'velez-malaga' THEN 'RB018'
  WHEN 'villanueva-de-algaidas' THEN 'RB019' WHEN 'villanueva-de-tapia' THEN 'RB020'
  WHEN 'villanueva-del-rosario' THEN 'RB021' WHEN 'villanueva-del-trabuco' THEN 'RB022'
  WHEN 'vinuela' THEN 'RB023' WHEN 'yunquera' THEN 'RB024'
END
WHERE slug IN ('montecorto','periana','pizarra','pujerra','rincon-de-la-victoria',
  'riogordo','ronda','salares','sayalonga','sedella','serrato','sierra-de-yeguas',
  'teba','tolox','torrox','totalan','valle-de-abdalajis','velez-malaga',
  'villanueva-de-algaidas','villanueva-de-tapia','villanueva-del-rosario',
  'villanueva-del-trabuco','vinuela','yunquera');

-- Fase 2: códigos previos (secuencia alfabética incorrecta anterior a la corrección)
UPDATE public.municipalities SET ine_code = CASE slug
  WHEN 'montecorto' THEN '29904' WHEN 'periana' THEN '29078'
  WHEN 'pizarra' THEN '29079' WHEN 'pujerra' THEN '29080'
  WHEN 'rincon-de-la-victoria' THEN '29081' WHEN 'riogordo' THEN '29082'
  WHEN 'ronda' THEN '29083' WHEN 'salares' THEN '29084'
  WHEN 'sayalonga' THEN '29085' WHEN 'sedella' THEN '29086'
  WHEN 'serrato' THEN '29903' WHEN 'sierra-de-yeguas' THEN '29087'
  WHEN 'teba' THEN '29088' WHEN 'tolox' THEN '29089'
  WHEN 'torrox' THEN '29090' WHEN 'totalan' THEN '29091'
  WHEN 'valle-de-abdalajis' THEN '29092' WHEN 'velez-malaga' THEN '29093'
  WHEN 'villanueva-de-algaidas' THEN '29094' WHEN 'villanueva-de-tapia' THEN '29097'
  WHEN 'villanueva-del-rosario' THEN '29095' WHEN 'villanueva-del-trabuco' THEN '29096'
  WHEN 'vinuela' THEN '29098' WHEN 'yunquera' THEN '29099'
END
WHERE ine_code LIKE 'RB%';

COMMIT;
```

Este rollback restaura el estado exacto previo a la corrección. No se
recomienda ejecutarlo: los códigos previos no son oficiales.

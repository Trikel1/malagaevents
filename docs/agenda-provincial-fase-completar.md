# Cobertura provincial — snapshot y rollback (fase actual)

Companion to `docs/agenda-cultural-rollback.md`. Scope: completar cobertura
oficial de 103 municipios, normalización, registro canónico de fuentes y
adaptador P0 FYCMA. Todas las migraciones son aditivas y reversibles.

## Snapshot preflight (verificado por SQL)

| Métrica                          | Valor  |
| -------------------------------- | ------ |
| `municipalities` activos         | 103    |
| `municipalities` total           | 103    |
| `locations` total                | 116    |
| `events` total                   | 1.467  |
| `events` futuros                 | 190    |
| `events` publicados              | 1.467  |
| `events` con `municipality_id`   | 0      |
| `event_sources` total            | 132    |
| `event_sources` base_url distinta| 120    |
| `scraping_sources` total         | 12     |
| `sources_config` total           | 37     |
| `venues` total                   | 223    |
| eventos con venue FYCMA (heur.)  | 31     |
| `municipality_aliases` total     | 55     |

## Fase 2 aplicada — completar municipios

### `src/lib/localitiesCatalog.ts`
Añadidas 12 entradas al catálogo, sin reordenar existentes:
- Axarquía: `arenas`, `benamargosa`, `cutar` (alias `cutar`), `vinuela` (alias `vinuela`).
- Valle del Guadalhorce: `almogia` (alias `almogia`).
- Antequera y comarca: `cuevas-bajas`, `cuevas-de-san-marcos`, `valle-de-abdalajis` (alias `valle-de-abdalajis`).
- Serranía de Ronda: `benarraba` (alias `benarraba`), `montecorto`.
- Guadalteba: `almargen`, `serrato`.

Todos los slugs coinciden con `municipalities.slug` ya presentes en la BD.

### Migración `add_missing_locations_and_aliases`
- Inserta 12 filas en `public.locations` con `ON CONFLICT (normalized_name) DO NOTHING`.
- Inserta aliases sin acentos y con acentos en `public.municipality_aliases`
  con `ON CONFLICT (alias_normalized) DO NOTHING`.

### Rollback fase 2
```sql
DELETE FROM public.locations WHERE normalized_name IN (
  'almargen','almogia','arenas','benamargosa','benarraba','cuevas-bajas',
  'cuevas-de-san-marcos','cutar','montecorto','serrato','valle-de-abdalajis','vinuela'
);
DELETE FROM public.municipality_aliases WHERE alias_normalized IN (
  'almargen','almogia','arenas','benamargosa','benarraba','cuevas-bajas',
  'cuevas-de-san-marcos','cutar','montecorto','serrato','valle-de-abdalajis','vinuela'
);
```
No borra filas creadas por otros procesos (los aliases usan `ON CONFLICT DO NOTHING`
por lo que sólo se eliminan las 12 nuevas).

## Fase 4 aplicada — registro canónico de fuentes

### Migración `event_sources_p0_registry`
Aditiva, reversible, con `ADD COLUMN IF NOT EXISTS`:
- `priority_tier text CHECK (P0|P1|P2|P3)`
- `protected_source boolean NOT NULL DEFAULT false`
- `canonical_source_id uuid REFERENCES event_sources(id) ON DELETE SET NULL`
- `legacy_refs jsonb NOT NULL DEFAULT '{}'::jsonb`
- `last_dry_run_at timestamptz`, `last_dry_run_status text`, `last_dry_run_result jsonb`
- Índices parciales: `idx_event_sources_priority_tier`, `idx_event_sources_canonical`, `idx_event_sources_protected`.

Sin cambios de comportamiento para las 132 filas existentes: valores por defecto no
alteran las columnas actuales ni la lógica de scrape-source, que no consulta estos
campos todavía.

**Contrato de protección (para futuras handlers de errores)**: cualquier lógica
automática que desactive fuentes tras errores debe respetar
`protected_source = false` en su cláusula `WHERE`. FYCMA lleva la marca `true`.

### Rollback fase 4
```sql
DROP INDEX IF EXISTS public.idx_event_sources_priority_tier;
DROP INDEX IF EXISTS public.idx_event_sources_canonical;
DROP INDEX IF EXISTS public.idx_event_sources_protected;
ALTER TABLE public.event_sources
  DROP COLUMN IF EXISTS priority_tier,
  DROP COLUMN IF EXISTS protected_source,
  DROP COLUMN IF EXISTS canonical_source_id,
  DROP COLUMN IF EXISTS legacy_refs,
  DROP COLUMN IF EXISTS last_dry_run_at,
  DROP COLUMN IF EXISTS last_dry_run_status,
  DROP COLUMN IF EXISTS last_dry_run_result;
```

## Fase 5a aplicada — FYCMA P0 (dry-run, sin escritura de eventos)

### FYCMA canónica elegida
- `event_sources.id = a7c04ea1-2704-43e6-bcb7-f270f492d173`
- `slug = 'fycma'`, `adapter_key = 'fycma'`
- `name = 'FYCMA — Palacio de Ferias y Congresos de Málaga'`
- `base_url = 'https://fycma.com/wp-json/tribe/events/v1/events'` (API oficial Tribe Events Calendar)
- `priority = 100`, `priority_tier = 'P0'`, `protected_source = true`
- `enabled = false` (permanece off; activación en fase 5b tras reconciliación)
- `canonical_source_id = NULL` (es la canónica)

### Aliases y referencias legacy preservados en `legacy_refs`
```json
{
  "sources_config_id": "aef29768-1ea1-405b-83a7-1f5b8fe59731",
  "sources_config_name": "FYCMA",
  "venue_duplicates": [
    "7bb158eb-5e36-4333-9250-a56ddf24d236",
    "cb2e43bd-bef9-4a3b-b27c-9e5a73474c12",
    "e492194c-e0fd-4801-af76-50bc3ab7836a"
  ],
  "canonical_venue_name": "FYCMA — Palacio de Ferias y Congresos de Málaga"
}
```
Nada se borra. `scraping_sources` no tiene entrada FYCMA (0 filas), por lo
que no requiere mapeo. Los 3 venues duplicados quedan intactos; su
consolidación es responsabilidad de la fase 5b.

### Archivos creados / modificados
- `supabase/functions/_shared/adapters/fycma.ts` — adaptador aislado (Tribe REST API).
- `supabase/functions/_shared/ingestion/adapters.ts` — registro del adaptador `fycma`.
- `supabase/functions/admin-fycma-dry-run/index.ts` — edge function admin-only
  (JWT + `has_role('admin')`). Nunca escribe en `events`; sólo actualiza campos
  `last_dry_run_*` en `event_sources`.
- `src/lib/localitiesCatalog.ts` — sin cambios en esta fase (ya terminada en fase 2).

### Dry-run real (ejecutado desde sandbox contra la API oficial)
| Métrica                          | Valor                                          |
| -------------------------------- | ---------------------------------------------- |
| URL inspeccionada                | `https://fycma.com/wp-json/tribe/events/v1/events` |
| HTTP status                      | 200                                            |
| Páginas obtenidas                | 1 (de máximo 10 permitidas por el adaptador)   |
| Candidatos                       | 27                                             |
| Válidos                          | 27                                             |
| Rechazados                       | 0                                              |
| Eventos multi-día                | 11                                             |
| Duración                         | 799 ms                                         |
| Cobertura de campos              | title 27/27, start_date 27/27, description 27/27, image 27/27, url 27/27, venue 27/27, category 27/27, organizer 26/27, ticket_url 25/27, end_date 11/27 (correcto: sólo multi-día) |
| Duplicados vs `events` por URL   | 0 (los 31 registros FYCMA existentes no tienen la URL canónica almacenada) |
| Duplicados vs `events` por título en venue FYCMA | 10                             |
| Eventos escritos                 | **0**                                          |
| Warnings                         | ninguno                                        |

Ejemplos válidos: Greencities 2026 (15–16 sep), ECOC2026 (20–24 sep),
Congreso Smart City RECI, San Diego Comic-Con Málaga 2026, Foro GPEF2026.
Todos con `startAt`/`endAt` diferenciados, imagen oficial, organizer y URL
canónica `fycma.com/evento/…`.

### Rollback fase 5a
1. Datos: revertir la fila FYCMA (`event_sources.id = a7c04ea1…`):
   ```sql
   UPDATE public.event_sources
     SET priority_tier = NULL,
         protected_source = false,
         base_url = 'https://www.fycma.com/',
         priority = 75,
         legacy_refs = '{}'::jsonb,
         last_dry_run_at = NULL,
         last_dry_run_status = NULL,
         last_dry_run_result = NULL,
         name = 'FYCMA — Palacio de Ferias'
   WHERE id = 'a7c04ea1-2704-43e6-bcb7-f270f492d173';
   ```
2. Código: eliminar `supabase/functions/_shared/adapters/fycma.ts`,
   quitar su registro de `adapters.ts` y borrar la carpeta
   `supabase/functions/admin-fycma-dry-run/`.

### Bloqueo/riesgos técnicos encontrados
- Ninguno. La API oficial responde 200, sin cloudflare/JS-wall, robots.txt
  totalmente abierto, endpoint público estable del plugin Tribe Events.
- Nota menor: el hostname canónico es `fycma.com` (no `www.`). El adaptador
  usa el hostname sin `www`.

## Fase 5b — pendiente (reconciliación / ingesta)

- Merge idempotente contra los 31 eventos FYCMA existentes:
  - 10 con match por título → añadir `url` canónica y `dedupe_key`
    determinista (`fycma:url:…`) sin duplicar la fila.
  - 17 nuevos → insertar preservando `start_at`/`end_at` reales para los
    multi-día.
- Consolidar los 3 venues duplicados en uno canónico (mantener IDs, mover
  referencias vía `venue_id`); dejar los otros como aliases apuntando al
  canónico.
- Activar `enabled = true` sólo cuando la escritura protegida
  (`SYNC_ADMIN_KEY` + WRITE_ENABLED) esté explícitamente habilitada.
- Añadir tarjetas de coverage/health en `/admin` (fase 6) que lean
  `last_dry_run_*` y `protected_source`.


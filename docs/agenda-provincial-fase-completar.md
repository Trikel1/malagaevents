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

## Fases pendientes (no aplicadas en este turno)

- **Fase 3** — Servicio de normalización de municipios y backfill controlado
  de `events.municipality_id` con confianza alta (canonical name, aliases,
  venue municipality, address). Reporte de ambigüos. Sin sobrescribir texto.
- **Fase 4** — Consolidación de registro canónico en `event_sources` con
  columnas `legacy_source_id` y campos de aliasing sin borrar `scraping_sources`
  ni `sources_config`.
- **Fase 5** — Adaptador FYCMA P0 (`supabase/functions/_shared/adapters/fycma.ts`)
  + edge function `admin-ingest-dry-run` para FYCMA + flag `protected_p0` en
  `event_sources` para evitar auto-desactivación tras errores transitorios.
- **Fase 6** — Panel `/admin` (source health): tarjeta de cobertura provincial
  real, FYCMA health, últimos sync.
- **Fase 7** — QA: build, typecheck, verificación de selector, counts SQL.

Cada fase se aplicará como migración aditiva independiente con su propio
rollback documentado aquí antes de ejecutarse.

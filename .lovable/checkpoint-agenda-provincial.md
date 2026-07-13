# Agenda Cultural provincial — Checkpoint de sprint

## Estado global

- **Fase 1 (migraciones aditivas + seed):** completada.
- **Fase 2 (adapter CSV Málaga + librería CSV compartida):** completada, registrada y desactivada a la espera de dry-run y confirmación de licencia.
- **Fase 3 (UI pública `/agenda/:slug` + Haversine + badges + verified):** entregada en versión base funcional.
- **Fase 4 (adapters P1 provinciales/comarcales):** pendiente — bloque siguiente.
- **Fase 5 (SourceHealth admin + moderación):** pendiente — bloque siguiente.
- **Fase 6 (tests exhaustivos + a11y + performance):** pendiente — bloque siguiente.

## Cobertura de los 103 municipios

- Total sembrados: **103 activos**.
- Comarcas: 8 (Málaga capital + Costa del Sol Occidental + Valle del Guadalhorce + Sierra de las Nieves + Serranía de Ronda + Guadalteba + Antequera + Axarquía).
- Municipios recientes incluidos: Torremolinos, Villanueva de la Concepción, Serrato, Montecorto.
- Aliases sembrados: **55** (Torre del Mar, San Pedro Alcántara, Arroyo de la Miel, Sabinillas, La Cala de Mijas, Torrox Costa, Maro, La Cala del Moral, Puerto Banús, Los Boliches, Cártama Estación, Bobadilla, El Chorro, Cancelada, Chilches, Benagalbón, etc.).

## Archivos añadidos

- `supabase/functions/_shared/adapters/lib/csv.ts` — parser CSV robusto (BOM/quotes/CRLF/auto-detect separador) + fetch con timeout, reintentos y backoff.
- `supabase/functions/_shared/adapters/ayto-malaga-csv.ts` — adaptador P0 de la agenda oficial de Datos Abiertos Málaga (CSV).
- `src/hooks/useMunicipalities.ts` — hooks React Query para los municipios y aliases + filtro accent-insensitive.
- `src/components/events/LifecycleStatusBadge.tsx` — badge visual para `postponed | cancelled | sold_out | finished | needs_review`.
- `src/pages/MunicipalityAgendaPage.tsx` — página pública `/agenda/:municipalitySlug` con:
  - Sección local (eventos con `municipality_id` = municipio activo).
  - Sección "Cerca de X" claramente separada, con bounding box + Haversine, radios 15/30/50 km.
  - Etiqueta explícita del municipio real de cada evento cercano — nunca se presenta como local.
  - Badge de estado, `verified_at` humano ("verificado hace …"), enlace a la fuente original.
  - SEO por ruta y ocultación de eventos `finished`.
- `docs/agenda-cultural-rollback.md` — script inverso de las migraciones.

## Archivos modificados

- `supabase/functions/_shared/ingestion/adapters.ts` — registro del nuevo adaptador `ayto-malaga-csv`.
- `src/App.tsx` — ruta `/agenda/:municipalitySlug` (lazy + dentro de `MainLayout`).

## Migraciones aplicadas

1. Creación de `public.municipalities` (103 filas seed).
2. Creación de `public.municipality_aliases` (55 filas seed).
3. `events` +11 columnas (`municipality_id`, `locality_or_district`, `verified_at`, `first_seen_at`, `confidence_score`, `minimum_age`, `language`, `price_from`, `price_to`, `expires_at`, `lifecycle_status` con CHECK acotado).
4. `venues` +4 columnas (`municipality_id`, `locality_or_district`, `accessibility_data`, `official_url`).
5. `event_sources` +11 columnas (`scope`, `municipality_id`, `source_type`, `trust_level`, `licence`, `terms_reviewed_at`, `polling_interval`, `last_success_at`, `last_error_at`, `consecutive_errors`, `paused_reason`).
6. Índices: `events(start_at)`, `events(municipality_id, lifecycle_status)`, `events(category, start_at)`, `events(lat, lng)`, `events(verified_at)`, único parcial `events(source_id, external_id)`.
7. RLS: SELECT público sobre `municipalities` y `municipality_aliases`; ninguna política de escritura pública. Escritura solo `service_role` (y admins vía `has_role`, patrón ya existente).

## Fuentes registradas

| Slug | Estado | Motivo |
|------|--------|--------|
| `ayto-malaga-csv` | disabled, robots_ok=false | Pendiente revisión de robots + licencia CC-BY + primer dry-run |
| (existentes: `ayto-malaga`, `teatro-cervantes`, `teatro-soho`, `teatro-canovas`, `la-termica`, `mva`, `museo-picasso`, `museo-thyssen`, `sala-trinchera`, `sala-paris-15`, `la-cochera-cabaret`, `contenedor-cultural-uma`, `cine-albeniz`) | conservados sin cambios |

## Compilación y tipos

- `tsgo --noEmit` → **✔ sin errores**.
- Build de producción → no ejecutado manualmente (Lovable lo compila en el push del preview).

## Seguridad y garantías

- No se modificaron `sports_*`, `pharmacies_*`, `auth`, `user_roles`.
- RLS activo en las 2 tablas nuevas.
- Secrets (`FIRECRAWL_API_KEY`, `SYNC_ADMIN_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) permanecen sólo en Edge Functions.
- El adaptador CSV no escribe en BD por sí mismo: devuelve `CanonicalEvent[]` y la persistencia sigue mediada por `scrape-source` con `WRITE_ENABLED` + `write_confirmed_at`.
- `events.status` legacy intacto; la lógica nueva usa `lifecycle_status`.
- Ningún evento canónico se ha modificado; ningún alias/municipio se puede escribir desde el cliente.

## Advertencias del linter de Supabase

Detectadas 6, todas **preexistentes**, ninguna introducida por esta migración:
- 1 INFO: "RLS enabled no policy" — es el patrón intencionado para las nuevas tablas (solo SELECT público; escritura via service_role).
- 5 WARN preexistentes (unaccent en `public`, funciones `SECURITY DEFINER` públicas — heredadas del setup histórico del proyecto).

## Trabajo pendiente para siguiente iteración (Fases 4–6)

### Fase 4 — adapters P1
Crear con librerías compartidas (`rss.ts`, `ics.ts`, `jsonld.ts`) — patrón ya validado con `csv.ts`:
- Diputación de Málaga
- Culturama
- Junta de Andalucía (Cultura Málaga)
- Visit Costa del Sol
- Axarquía Costa del Sol
- Serranía de Ronda
- Sierra de las Nieves
- Portales municipales prioritarios (por comarca)

Cada uno: revisar robots+ToS → dry-run → confirmación de escritura → habilitar.

### Fase 5 — SourceHealth + moderación
- Nueva pestaña en `/admin`: tabla de fuentes con último éxito/error, streak, delta de eventos, botón pausar/reanudar (reutiliza `admin-source-toggle-enabled`).
- Cola de moderación: eventos con `lifecycle_status='needs_review'` o `confidence_score < 0.6`.
- Reutilización auditada de `event_submissions` + `submit-event`.

### Fase 6 — QA exhaustivo
- Tests unitarios: parser CSV, aliases, dedupe, Haversine, Europe/Madrid.
- Tests integración: dry-run CSV con fixture, dos corridas → 0 duplicados.
- Tests RLS: anon / authenticated / organizer / admin.
- Playwright: `/agenda/malaga`, `/agenda/estepona`, sección "Cerca de" separada, badges visibles, sin overflow a 320px.

## Rollback disponible

Sí — documentado en `docs/agenda-cultural-rollback.md`. Todo el sprint es aditivo y reversible.

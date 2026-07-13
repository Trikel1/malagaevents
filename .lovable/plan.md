# Agenda Cultural de toda la provincia de Málaga — Plan aprobado (Fases 1–6)

Autorización recibida para ejecución autónoma. Decisiones confirmadas:
- Extender `event_sources` (no crear `cultural_sources`).
- Añadir campo nuevo `lifecycle_status` (no modificar `events.status`).
- "Cerca de" con Haversine + bounding box (sin PostGIS).
- Si el xlsx no es legible, sembrar 103 municipios desde lista INE/Diputación (incluye Montecorto) y dejar la importación de metadatos extra como pendiente.
- Fuentes con robots/terms bloqueados: se desactivan individualmente, no bloquean el sprint.

---

## Fase 1 — Migraciones aditivas, RLS y seed

**Migraciones (todas aditivas, con rollback `DROP … IF EXISTS`):**

1. `municipalities(id, ine_code UNIQUE, name, slug UNIQUE, comarca, latitude, longitude, active bool default true, created_at, updated_at)` + `GRANT SELECT` a `anon, authenticated`, RLS con policy `SELECT` público.
2. `municipality_aliases(id, municipality_id FK, alias, alias_normalized, alias_type)` + GRANT + RLS SELECT público.
3. `ALTER events` ADD `municipality_id uuid`, `locality_or_district text`, `verified_at timestamptz`, `confidence_score numeric(3,2)`, `minimum_age int`, `language text`, `price_from numeric`, `price_to numeric`, `expires_at timestamptz`, `first_seen_at timestamptz`, `lifecycle_status text` con CHECK IN (`scheduled|postponed|cancelled|sold_out|finished|needs_review`).
4. `ALTER venues` ADD `municipality_id uuid`, `locality_or_district text`, `accessibility_data jsonb`, `official_url text`.
5. `ALTER event_sources` ADD `scope`, `municipality_id`, `source_type`, `trust_level`, `licence`, `terms_reviewed_at`, `polling_interval`, `last_success_at`, `last_error_at`, `consecutive_errors`, `paused_reason`.
6. Índices: `events(starts_at)`, `events(municipality_id, lifecycle_status)`, `events(category, start_at)`, `events(lat, lng)` (bounding box), UNIQUE parcial `events(source_id, external_id) WHERE external_id IS NOT NULL`.
7. Seed **exactamente 103 municipios** con `ine_code`, comarca y coordenadas (incluye Montecorto). Insert idempotente `ON CONFLICT (ine_code) DO UPDATE`.
8. Seed aliases: Torre del Mar→Vélez-Málaga, San Pedro Alcántara→Marbella, Arroyo de la Miel→Benalmádena, Sabinillas→Manilva, La Cala de Mijas→Mijas, Torrox Costa→Torrox, Maro→Nerja, La Cala del Moral→Rincón de la Victoria, y variantes ortográficas.
9. Test SQL: `SELECT count(*) FROM municipalities WHERE active` = 103.

RLS: eventos canónicos siguen siendo SELECT-only para `anon/authenticated`; escritura solo `service_role`. Nada destructivo.

---

## Fase 2 — Adapter CSV Málaga + librería CSV

- `supabase/functions/_shared/adapters/lib/csv.ts`: parser CSV tolerante a BOM, comillas y separador `;/,`.
- Adapter `ayto-malaga-csv` sobre `https://datosabiertos.malaga.eu/recursos/cultura/agenda/2026.csv`. Registrado en `_shared/ingestion/adapters.ts` junto a los existentes (no se borra `ayto-malaga` HTML).
- Fetch: timeout 20s, retry exponencial (3 intentos), `If-Modified-Since`, UA identificable.
- Idempotencia: `external_id` del CSV si existe; si no, fingerprint SHA-256 canónico (ya existente).
- Ejecución obligada `dryRun=true` primero vía `admin-ingest-dry-run`. Escritura solo tras `write_confirmed_at`.
- Cada evento persistido guarda `canonical_source_url`, `verified_at=now()`, `last_seen_at=now()`, `first_seen_at` si es nuevo, `lifecycle_status='scheduled'`, `confidence_score` alto (fuente oficial).
- Test: dos corridas consecutivas → 0 duplicados.

---

## Fase 3 — Frontend público

- Ruta nueva `/agenda/:municipalitySlug` (aditiva, no toca `/events`).
- `MunicipalityPicker`: buscador accent-insensitive sobre `municipalities` + aliases, botón "Usar mi ubicación" (`navigator.geolocation`), sin bloquear si el usuario deniega.
- Tabs: Hoy / Mañana / Este fin de semana / Elegir fechas (reutiliza lógica de `EventsPage` y `eventTime.ts`).
- Filtros: comarca, categoría, gratis/pago, familia+edad, accesibilidad, distancia (15/30/50 km).
- **"Cerca de X"**: sección visual claramente separada bajo los locales, con etiqueta explícita del municipio original de cada evento; nunca renderizado como local. Cálculo Haversine con bounding box previa por `(lat, lng)` para no escanear la tabla.
- Tarjetas: título, fecha/hora, municipio y localidad exacta, recinto, categoría, precio o "Gratis", **badge de `lifecycle_status`** (postponed/cancelled/sold_out/finished), distancia si hay permiso, **fuente original enlazada**, **`verified_at` humano** ("verificado hace 3 h"), botón entradas.
- `finished` se oculta por defecto en listados.
- SEO: `<title>`, meta description, JSON-LD `Event` solo para eventos publicados y verificados. URLs filtradas compartibles.

Cambios en `EventsPage` se limitan a añadir uso del nuevo `lifecycle_status` sin romper filtros existentes.

---

## Fase 4 — Adapters P0/P1

Con librerías compartidas `csv.ts`, `rss.ts`, `ics.ts`, `jsonld.ts`, `htmlAdapter.ts` (ya existe patrón). Cada uno pasa por robots/terms review y `write_confirmed_at`:

- Diputación de Málaga (`malaga.es/…/agenda`)
- Culturama (`malaga.es/culturama`)
- Junta de Andalucía — Cultura Málaga
- Visit Costa del Sol
- Axarquía Costa del Sol
- Serranía de Ronda
- Sierra de las Nieves
- Portales municipales prioritarios del registro (los que aporten CSV/RSS/ICS/JSON-LD antes que HTML).

Fuente que devuelva 403/robots-block → `enabled=false`, `paused_reason='robots'|'403'|'tos'`, continúa el sprint.

---

## Fase 5 — Admin SourceHealth + moderación

- Nueva vista en `/admin` (aditiva): tabla con fuente, scope, último éxito, último error, `consecutive_errors`, cambios sospechosos (delta de nº de eventos), botón pausar/reanudar (usa `admin-source-toggle-enabled`).
- Cola de moderación: eventos con `lifecycle_status='needs_review'` o `confidence_score < 0.6` no se publican; se listan con acciones aprobar/rechazar.
- Reutilización segura de `event_submissions` + edge `submit-event`: sanitización, rate-limit por IP/usuario, restricción de tipos y tamaños, historial de moderación en `moderation_history` (tabla aditiva si falta).

---

## Fase 6 — QA, a11y, perf, seguridad, rollback

- Tests unitarios: parser CSV, resolución de aliases, dedupe, Haversine, formateo de fechas Europe/Madrid.
- Tests integración: dry-run de `ayto-malaga-csv` con fixture, dos corridas → 0 duplicados, `verified_at` presente.
- Tests RLS: anon/authenticated no pueden `INSERT/UPDATE/DELETE` en `events`, `municipalities`, `venues`, `event_sources`. Solo `service_role` y admin (vía `has_role`).
- Playwright: `/agenda/malaga`, `/agenda/estepona`, geolocalización denegada, sección "Cerca de" claramente separada, badges de estado visibles, sin overflow horizontal a 320px.
- Build de producción `npm run build` verde.
- Documento `docs/agenda-cultural-rollback.md` con `DROP` inverso por migración.

---

## Aspectos técnicos y garantías

- Ninguna migración modifica sports, pharmacies, auth ni rutas globales.
- Adapters existentes (`ayto-malaga`, `teatro-cervantes`, etc.) intactos y activos hasta validación de sustitutos.
- Secrets solo en Edge Functions (`FIRECRAWL_API_KEY`, `SYNC_ADMIN_KEY`). Nunca al cliente.
- `events.status` legacy inalterado. Todo el sprint usa `lifecycle_status` para el flujo nuevo; los listados nuevos filtran por él y los antiguos siguen usando `status`.
- Cada rollback documentado columna a columna.

Al terminar Fase 6 entregaré un único informe con: fases completadas, archivos, migraciones, fuentes activas/pausadas/pendientes, resultados build+tests, cobertura de los 103 municipios, correcciones y checklist de producción.

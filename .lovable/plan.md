# Fase 3E — Activación controlada de `teatro-cervantes` (plan, sin implementar)

## Hallazgo bloqueante que condiciona todo el plan

Antes de proponer un flujo de escritura, la exploración de la base ha revelado dos incompatibilidades críticas que **impedirían un write seguro tal como está hoy** el código:

**A. Colisión de formato `dedupe_key`.**
- Hay **97 eventos de Cervantes ya en `events`** (65 + 32) insertados por `sync-events`.
- Sus `dedupe_key` tienen formato antiguo: `teatro-cervantes_6fbhnt` (slug + sufijo).
- `scrape-source` genera keys en formato nuevo: sha256(title|venue|locality|YYYY-MM-DDTHH:mm).
- Sólo **47 filas de 1430 en total** usan el formato sha256. **1383 filas usan el formato antiguo.**
- Consecuencia: si activamos el write path actual, cada evento Cervantes real se **duplicará** contra su copia antigua. Cero coincidencia en `dedupe_key`.

**B. El write path de `scrape-source` no rellena columnas `NOT NULL` de `events`.**
- `events` exige NOT NULL en: `title`, `description`, `category`, `start_at`, `venue_name`, `address`, además de `is_free`, `source_type`, `status` (con default en algunos, no todos).
- El objeto `row` que construye `scrape-source` (líneas 277-293 de `index.ts`) **no envía `description`, `category`, `address`, `is_free`, `source_type`, `status`, `source`, `url`, `source_ref`** — todos usados por el resto de la app y por `sync-events`. Un `INSERT` real petaría con `not_null_violation`.

Estas dos cosas hay que resolverlas **antes** de la primera escritura. El plan las aborda en 3E-1.

---

## 1. Arquitectura actual de `scrape-source`

Flujo dry-run (hoy):
1. `POST /scrape-source` con `x-sync-key` (SYNC_ADMIN_KEY). No JWT, no anon.
2. Carga `event_sources` por `sourceId`. Si `dryRun=false`, exige `enabled=true` y `robots_ok=true`.
3. Ejecuta `adapter.fetchEvents` (Firecrawl → CanonicalEvent[]).
4. Por cada evento: `isValidCanonical`, `resolveVenueAlias`, `resolveLocalityAlias`, `generateEventDedupeKey`.
5. Si `dryRun=true` **o** `WRITE_ENABLED=false` → mete hasta 20 en `preview`, incrementa `skippedDupes`, no toca `events`.
6. Escribe `event_source_runs` (start + finish) y `ingestion_errors` en fallos.

Constante `WRITE_ENABLED = false` está hard-coded en la función (línea 30). Es un flag de módulo, no una env var.

Tablas que se escribirían al pasar a write:
- `events` — insert/update.
- `event_source_runs` — ya se escribe siempre.
- `ingestion_errors` — ya se escribe en fallos.
- `venue_aliases`, `locality_aliases` — sólo lectura hoy (best-effort en resolver).

## 2. Estrategia de escritura segura

En vez de flipar `WRITE_ENABLED` a `true` (peligroso, global, permanente):

- **Sustituir la constante por un permiso *por-run*.** El caller pide explícitamente `writeEnabled: true` en el body, y `scrape-source` acepta escritura **solo si**:
  - `source.enabled === true` **y** `source.robots_ok === true`.
  - `source.adapter_key` coincide con el registrado en el motor.
  - Existe un **preflight token** válido: hash corto generado por `admin-ingest-preflight` para ese `sourceId`, con TTL ≤ 15 min, guardado en memoria/BD (opción: campo temporal en `event_source_runs` o tabla nueva `ingestion_write_tokens`).
  - `maxWrites` viene en el body y es ≤ **límite hard 50** insertos + updates por run.
- **`enabled=true` gobierna cron/dispatcher; `robots_ok=true` gobierna scraping. Para write real ambos son necesarios**, y añadimos un flag adicional `write_confirmed_at` (columna en `event_sources`) sólo tocable por admin. Preferimos no reutilizar `enabled` porque quema dos decisiones distintas: "esta fuente está lista para leer" vs "confirmo escribir en `events`".
- Dry-run previo obligatorio: `admin-ingest-preflight` corre `scrape-source` con `dryRun=true`, calcula diff (nuevos / existentes / conflictos), y devuelve un `write_token`. Sólo con ese token se puede pedir write.
- **No hay toggle global.** No hay flag env. La activación siempre exige: fuente concreta + confirmación por sesión + límite.

## 3. Dedupe (crítico por hallazgo A)

Estrategia obligatoria antes de la primera escritura:

- **Doble búsqueda** durante upsert, no una:
  1. `SELECT ... WHERE dedupe_key = sha256Key` (formato nuevo).
  2. Si no existe, **fallback**: `SELECT ... WHERE title_normalized = normalize(title) AND venue_name_normalized = normalize(venue) AND date_trunc('minute', start_at AT TIME ZONE 'Europe/Madrid') = ...`.
- Si el fallback encuentra fila → tratarla como existente. Si tiene `dedupe_key` antiguo (`teatro-cervantes_XXX`), **actualizamos el `dedupe_key`** de esa fila al formato sha256 (con `content_hash` y `source_id`) para consolidar. Así, tras las primeras corridas, la fuente Cervantes queda migrada al formato nuevo sin duplicados.
- `content_hash` decide update vs. skip: mismo hash → sólo `last_seen_at`; hash distinto → update completo.
- `source_id` se rellena con `event_sources.id` (columna existente en `events`, hoy siempre NULL).
- `last_seen_at` se refresca en cada corrida. Sirve para el archiver (ver riesgos).
- Sin cambios de esquema para dedupe: `title_normalized` y `venue_name_normalized` ya existen como columnas generadas + índices GIN (memoria "Database Optimizations"). El fallback es barato.

## 4. Rollback

- **Marcado inequívoco:** cada evento insertado por scrape-source lleva `source_id = source.id` (hoy 0 filas lo tienen). Basta esto para identificar toda escritura post-3E.
- Además, la corrida escribe `event_source_runs` con `inserted`, `updated`, y `meta.event_ids: string[]` (lista de UUIDs afectados). **Añadir `event_ids` al meta requiere una pequeña mejora del write path, no una migración** (es JSONB).
- Rollback de una corrida: `DELETE FROM events WHERE id = ANY(meta->'event_ids')` usando la fila de `event_source_runs`. Se hace desde admin, no automático.
- No hace falta tabla nueva `event_source_links`: no necesitamos multi-source por evento en 3E. Un evento pertenece a UN adapter en 3E. La tabla se puede añadir en el futuro si Marenostrum + Cervantes acaban solapando.
- **Nunca hacer `DELETE` masivo por `source_id IS NULL`**: eso borraría los 1430 antiguos. La regla es: sólo borrar filas cuyos IDs estén listados explícitamente en un `event_source_runs.meta.event_ids`.

## 5. Admin UI

Cambios en `IngestionRegistry.tsx`:

- Nueva acción por fila: **"Preparar escritura"** (no "Publicar" — más neutro).
- Al pulsar, llama `admin-ingest-preflight` → devuelve preview + diff (`newCount`, `updateCount`, `conflictCount`, `sampleNews`, `sampleUpdates`) + `writeToken` con TTL.
- Modal de confirmación doble:
  1. Panel de resumen: "Escribirás **X nuevos**, **Y actualizaciones**, **Z conflictos**. Máximo por corrida: 20 (fase 3E-3) / 50 (fase 3E-5). Fuente: Teatro Cervantes."
  2. Checkbox: "He revisado la muestra y confirmo la escritura". Botón: **"Confirmar escritura de N eventos"** (deshabilitado hasta el checkbox).
- Al confirmar, llama `admin-ingest-write` con `sourceId` + `writeToken` + `maxWrites`.
- Post-escritura, se muestra la fila de `event_source_runs` creada, con enlace directo a "Rollback esta corrida" (sólo visible ≤ 24 h).

## 6. Seguridad

- `admin-ingest-preflight` y `admin-ingest-write` son Edge Functions con `verify_jwt = true` **y** verificación `has_role(auth.uid(), 'admin')` en el body. Idéntico patrón al `admin-ingest-dry-run` existente.
- Estas funciones son las **únicas** que llaman a `scrape-source` con `x-sync-key`. La `SYNC_ADMIN_KEY` sigue únicamente en el servidor.
- Sin endpoint público. Sin exposición de service role. Sin exposición de sync key.
- `RLS` sigue intacto: los admins escriben en `events` sólo vía service_role a través de `scrape-source`. El navegador nunca puede escribir directamente.
- Logs: seguimos usando `sanitizeSample` (ya existente) para redactar posibles secretos en `ingestion_errors`.

## 7. Migraciones necesarias

Mínimas, tras discusión pero probablemente:

- **A) Añadir a `event_sources`**: `write_confirmed_at TIMESTAMPTZ NULL`, `write_confirmed_by UUID NULL REFERENCES auth.users(id)`. Para trazabilidad. Nullable.
- **B) Rellenar defaults en `events` para columnas NOT NULL que hoy no envía `scrape-source`**: `description DEFAULT ''`, `address DEFAULT ''`, `is_free DEFAULT false`, `source_type DEFAULT 'official_feed'`, `status DEFAULT 'published'`, y confirmar/añadir default para `category`. Alternativa: rellenarlos en el write path a mano; prefiero defaults en la tabla porque cierra el bug si algún día otro adaptador escribe.
- **C) No hace falta** `event_source_links`, ni `event_ingestion_batches`. `event_source_runs.meta` (JSONB) basta para trazar la corrida y guardar `event_ids`.

Sin migración de datos: no se toca ninguna fila existente. La consolidación del `dedupe_key` viejo → sha256 la hace el propio write path fila-a-fila, sólo al matchear.

## 8. Orden de implementación (5 fases)

- **3E-1 — Cerrar boquetes del write path (sin activarlo).**
  - Migración A + B.
  - Ampliar el `row` de `scrape-source` para incluir `description`, `address`, `is_free`, `source_type='official_feed'`, `status='published'`, `source=source.slug`, `url=source.base_url`, `source_ref=ev.sourceUrl`, `category=ev.category ?? 'general'`.
  - Añadir búsqueda fallback por título+venue+minuto y consolidación de `dedupe_key` antiguo.
  - Añadir `event_ids` a `event_source_runs.meta`.
  - `WRITE_ENABLED` sigue false. Sólo saneamos el código.

- **3E-2 — Preflight + write function + token.**
  - Nueva Edge `admin-ingest-preflight` (JWT + admin, devuelve diff + token).
  - Nueva Edge `admin-ingest-write` (JWT + admin, valida token + `write_confirmed_at`, invoca `scrape-source` con `writeEnabled: true` y `maxWrites`).
  - Sustituir `WRITE_ENABLED` constante por parámetro `writeEnabled` recibido en el body de `scrape-source`, con verificación estricta (source flags + adapter match + cap 50).
  - Nada activo aún.

- **3E-3 — Primer write real limitado a 20 eventos de Cervantes.**
  - Admin confirma manualmente `write_confirmed_at` en `event_sources` (una vez).
  - Admin marca `enabled=true` + `robots_ok=true` para Cervantes (tras verificar `robots.txt` a mano).
  - Corre preflight → confirma diff → confirma write con `maxWrites=20`.
  - Verifica en `/events` que 20 eventos nuevos aparecen bien, sin duplicar.

- **3E-4 — QA público en /events.**
  - Sin código nuevo. Auditoría manual: fechas, venues, imágenes, categorías, links de compra, mezcla con eventos antiguos, comportamiento de filtros.
  - Documentar cualquier ajuste necesario del adaptador o de defaults.

- **3E-5 — Ampliar a 153 eventos.**
  - Segundo preflight → segundo write con `maxWrites=50`.
  - Repetir en 3-4 corridas hasta cubrir el catálogo.
  - Programar cron (todavía apagado) para corridas diarias posteriores.

## 9. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Duplicados con las 97 filas Cervantes antiguas | Fallback `title_norm+venue_norm+minute`, consolidación de `dedupe_key` en el update. 3E-1 lo cubre. |
| Fechas erróneas (rango sin hora, fallback 20:00) | `raw.timeAssumed=true` visible en admin. QA público 3E-4. Sólo 4/153 hoy. |
| Categorías incorrectas | El adaptador ya infiere de URL + título. Fallback `'general'`. Editable a mano en admin. |
| Imágenes rotas | `image_status` existente; `EventImage.tsx` ya tiene fallback Unsplash. Sin riesgo funcional. |
| Eventos pasados | `pastCount` en harness = 1/153; el adaptador salta rangos totalmente pasados. Aceptable. |
| Mezcla con `sync-events` antiguo (esa fuente sigue tocando otras) | `sync-events` NO tocará Cervantes: seguirá sin ver la fuente si la retiramos de `scraping_sources`. Verificar antes de 3E-3 que `scraping_sources` no lista Cervantes activo. |
| Borrados accidentales | Regla de rollback: sólo por `event_ids` explícitos de un `event_source_runs`. Nunca por `source_id IS NULL`. |
| Activación accidental de otras fuentes | `write_confirmed_at` obligatorio por fuente. Cap 50/run. Token TTL 15 min. Sin toggle global. |
| Robots.txt de Cervantes cambia | Verificación manual del admin antes de 3E-3, con nota en `event_sources.notes` y timestamp. |
| Preview desactualizado (fuente cambió tras preflight) | Token TTL corto (15 min) y `content_hash` recalculado en write; conflicto → skip + warn. |

## Archivos que se tocarían (referencia, no implementar ahora)

| Fase | Archivo | Motivo |
|---|---|---|
| 3E-1 | Migración SQL | Defaults en `events` + columnas `write_confirmed_at/by` en `event_sources` |
| 3E-1 | `supabase/functions/scrape-source/index.ts` | Rellenar NOT NULL, fallback dedupe, `event_ids` en meta, parámetro `writeEnabled` |
| 3E-2 | `supabase/functions/admin-ingest-preflight/index.ts` (nuevo) | Preflight + token |
| 3E-2 | `supabase/functions/admin-ingest-write/index.ts` (nuevo) | Ejecuta write con validaciones |
| 3E-2 | `src/components/admin/IngestionRegistry.tsx` | Botón "Preparar escritura" + modal de doble confirmación + rollback |
| 3E-3 | Insert manual (via admin UI): `event_sources` `write_confirmed_at`, `enabled`, `robots_ok` de Cervantes | Activación puntual |
| 3E-5 | Ninguno nuevo | Sólo corridas |

## Primer prompt de implementación recomendado (para la siguiente sesión)

> FASE 3E-1 — Cerrar boquetes del write path sin activarlo.
> Objetivo: preparar `scrape-source` para que, cuando en 3E-3 se le active la escritura, pueda insertar/actualizar `events` sin violaciones NOT NULL y sin duplicar contra los 97 Cervantes ya existentes (formato dedupe_key antiguo `teatro-cervantes_XXX`).
> Cambios: (1) migración que añade `write_confirmed_at` + `write_confirmed_by` a `event_sources` y defaults NOT NULL en `events` (`description=''`, `address=''`, `is_free=false`, `source_type='official_feed'`, `status='published'`, `category='general'`); (2) en `scrape-source/index.ts` completar el `row` de upsert con esos campos + `source=source.slug` + `url=source.base_url` + `source_ref=ev.sourceUrl`, sustituir la constante `WRITE_ENABLED` por un parámetro `writeEnabled` recibido en el body (con validación estricta: source.enabled + source.robots_ok + source.write_confirmed_at + adapter_key match + maxWrites ≤ 50), añadir fallback de búsqueda por `title_normalized + venue_name_normalized + start_at` a nivel de minuto en Europe/Madrid, y consolidar `dedupe_key` antiguo → sha256 cuando el fallback matchea; (3) guardar `event_ids: string[]` en `event_source_runs.meta`. Prohibido: activar ninguna fuente, cambiar `enabled`/`robots_ok`, ejecutar write real, tocar frontend, tocar `sync-events` o `sync-sports`. QA: TypeScript limpio, harness Cervantes/Soho siguen pasando, dry-run en /admin sigue devolviendo preview, `events` sigue en 1430, `event_source_runs` sin corridas write.

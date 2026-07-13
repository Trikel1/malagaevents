# Preflight — Culturama · Agenda Diputación

**Fecha**: 2026-07-13
**Fuente**: `src-culturama-agenda`
**URL base**: https://www.malaga.es/culturama/2157/agenda
**Adapter**: `culturama` (Firecrawl v2 → parser compartido `lib/malaga-es.ts`)

## Estado tras Bloque 3
- `adapter_key`: `culturama` (antes `pending`).
- `enabled`: **false**.
- `robots_ok`: **false** (pendiente firma humana).
- Escrituras: **bloqueadas** por `write-auth.ts`.

## Plataforma compartida
Culturama vive en el mismo CMS de `www.malaga.es` que la Agenda provincial: idéntica estructura `com1_md3_cd-<id>/<slug>` y mismo bloque `addtocalendar` en el detalle. El parser es común (`lib/malaga-es.ts`); el adapter Culturama sólo cambia el `pathPrefix` y **espacia el `externalId` con `culturama-<id>`** para evitar colisiones con ids numéricos idénticos de la Agenda provincial.

## Acceso HTTP directo
- IP del sandbox + UA bot: `HTTP/2 403` (CloudFront).
- UA de navegador: `HTTP/2 202` con `content-length: 0` tras el segundo intento (bot fingerprint).
- **Consumo únicamente vía Firecrawl v2**.

## Robots.txt
Idéntico al de la Agenda provincial: **200 OK, body vacío**. Sin restricciones.

## Licencia y términos
Aviso legal Diputación de Málaga art. 8: reproducción con atribución permitida, sin uso comercial. `sourceUrl` canónico incluido en cada CanonicalEvent.

## Dry-run real
Ejecutado 2026-07-13 (`scripts/dry-run-malaga-es.ts`, `limit=3`):

- `linksTotal`: 20 · `itemsFound`: 9 · procesados: 3.
- `canonicalCount`: 3 con `externalId` prefijado `culturama-<id>`.
- `count(*) FROM events` antes = **1430**, después = **1430**. **Cero escrituras.**
- Muestra:
  - `culturama-64860` — VII Premios a la Cultura Malagueña Antonio Garrido Moraga 2026 (organizador: Diputación de Málaga; multi-día 2026-06-05 → 2026-07-15).
  - `culturama-64861` — XVI Premio de Pintura Evaristo Guerra 2026.
  - `culturama-64553` — Exposición "Realismo Mágico" – Maribel Alonso.

## Idempotencia
Tests unitarios (`src/test/malaga-es-adapters.test.ts`) verifican que dos pasadas idénticas con el mismo fixture producen `externalId` y `dedupe_key` idénticos byte a byte.

## Bloqueos
- Sin JSON-LD/RSS/ICS. HTML tras CloudFront: sólo Firecrawl.
- `locality` frecuentemente aparece como "Diputación Provincial de Málaga" (edificio) en lugar de municipio → se conserva tal cual y se recomienda enriquecerlo aguas abajo con `locality_aliases`.

## Próximo paso para activar
1. Firma humana `terms_reviewed_at`.
2. `write_confirmed_at` + `write_confirmed_by`.
3. `robots_ok=true`, `enabled=true`.
4. `schedule_cron` recomendado: 2x/día, escalonado con Diputación provincial.

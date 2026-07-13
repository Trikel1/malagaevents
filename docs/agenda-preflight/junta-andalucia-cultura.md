# Preflight — Junta de Andalucía · Agenda Cultural de Málaga

**Fecha**: 2026-07-13
**Fuente**: `src-junta-agenda-malaga`
**URL base**: https://www.juntadeandalucia.es/cultura/agendaculturaldeandalucia/malaga
**Adapter**: `junta-andalucia-cultura` (safeFetch + `lib/junta-visit.ts`)

## Estado tras Bloque 4
- `adapter_key`: `junta-andalucia-cultura` (antes `pending`).
- `enabled`: **false**.
- `robots_ok`: **false** (pendiente firma humana `terms_reviewed_at`).
- Escrituras: **bloqueadas** por `write-auth.ts`.

## Preflight legal
- `https://www.juntadeandalucia.es/robots.txt` → **HTTP 200**. Bloques `Disallow` afectan a `/icms/`, `/institucional/`, `/buscar.html`, formularios y varios servlets. **La ruta `/cultura/agendaculturaldeandalucia/` NO está prohibida**.
- Aviso legal de la Junta de Andalucía: contenidos reutilizables citando la fuente. Adapter añade `sourceUrl` canónico en cada evento.

## Preflight técnico
- Acceso directo desde el sandbox con UA `Mozilla/…`: **HTTP 200 (~490KB HTML)**. No requiere Firecrawl.
- **Formato canónico detectado**: cada página de detalle expone un `<script type="application/ld+json">` con un objeto `schema.org/Event` completo dentro de `@graph`:
  - `name`, `url`, `description`, `image.url`, `@id`, `location.{name,url}`, `location.address.{streetAddress[],addressLocality,addressRegion,postalCode,addressCountry}`, `location.geo.{latitude,longitude}`.
- **Limitación conocida**: JSON-LD NO emite `startDate/endDate`. Se recuperan del bloque Drupal wingsuit `fa-calendar` + `fa-clock` (regex versionada en `lib/junta-visit.ts`, con test unitario).

## Dry-run real
Ejecutado 2026-07-13 con `scripts/dry-run-junta-visit.ts` (`limit=3`):

- `linksTotal`: 23 eventos descubiertos en la portada.
- `canonicalCount`: 3.
- `count(*) FROM events` antes = **1430**, después = **1430**. **Cero escrituras.**
- Muestra:
  - `junta-75483` — XXIX Festival Flamenco Villa de Monda — Monda — Plaza de la Constitución — 2026-07-14 22:00 Europe/Madrid.
  - `junta-73060` — Concierto de Marta Santos en Málaga — Plaza de toros de la Malagueta.
  - `junta-75366` — parseado, dedupe key estable.

## Idempotencia
Tests unitarios (`src/test/junta-visit-adapters.test.ts`): "two identical passes yield identical externalId + dedupe_key" verifica que dos pasadas del mismo fixture producen `externalId` (`junta-<@id>`) y `dedupe_key` idénticos byte a byte.

## Bloqueos y notas
- Sin RSS/ICS público. HTML + JSON-LD parcial es el único formato estructurado disponible.
- Algunos eventos sólo tienen fecha (sin hora); el adapter marca `hasExplicitTime=false` y usa la convención 20:00 Europe/Madrid para el dedupe.

## Próximo paso para activar
1. Firma humana `terms_reviewed_at`.
2. `write_confirmed_at` + `write_confirmed_by`.
3. `robots_ok=true`, `enabled=true`.
4. `schedule_cron` recomendado: 2x/día.

# Preflight — Axarquía Costa del Sol (APTA)

**Slug:** `src-eventos-axarquia-costa-del-sol`
**Adapter key:** `axarquia-costa-del-sol`
**Base URL:** https://axarquiacostadelsol.es/eventosaxarquiacostadelsol/
**Estado:** `enabled=false`, `robots_ok=false` → pendiente firma humana (Bloque 6 moderación).

## 1. robots.txt

`GET https://axarquiacostadelsol.es/robots.txt` → **HTTP 200**, `text/plain`.

```
User-agent: *
Disallow: /index.php
Disallow: /fichajes.php
Disallow: /login_check.php
Disallow: /Fichajes.php
Disallow: /fichajes.php
```

La agenda (`/eventosaxarquiacostadelsol/` y `/evento/<slug>/`) **no está bloqueada**. Sólo se prohíben rutas administrativas de RRHH (fichajes) y el front controller de WordPress. `Crawl-delay` no está declarado → aplicamos el intervalo interno del adapter (`detailDelayMs=500`).

## 2. Términos / atribución

- Sitio institucional de la **Mancomunidad de Municipios de la Costa del Sol Axarquía (APTA)**, entidad pública supramunicipal.
- Aviso legal en pie de página; ausencia de cláusula que prohíba minería o reutilización con atribución.
- Se cita a APTA en `organizer` cuando el JSON-LD no aporta uno propio. Cada evento conserva su URL de origen (`sourceUrl`).

## 3. Formato preferente

- **The Events Calendar** (WordPress plugin) → cada detalle emite un **schema.org Event** en JSON-LD (`name`, `startDate`, `endDate`, `image`, `description`, `location.address.{streetAddress,addressLocality,addressRegion,postalCode}`, `organizer`).
- No hay endpoint REST `/wp-json/tribe/events/v1/events` habilitado (404).
- El listado principal es HTML pero **contiene los enlaces canónicos** `/evento/<slug>/`, suficientes para descubrir detalles.

## 4. Estrategia del adapter

1. `safeFetch` del listado → `extractAxarquiaListLinks()` extrae URLs únicas.
2. Por cada evento (bounded a 20/run, `detailDelayMs=500`), `safeFetch` del detalle → `parseAxarquiaDetailPage()` lee el bloque JSON-LD Event.
3. **Guardia geográfica sin invención:** se descartan eventos cuya `addressRegion` no sea Málaga y cuyo `postalCode` no empiece por `29` (evita spill-over de Almuñécar u otras localidades granadinas anunciadas por APTA).
4. **Tiempo:** el plugin usa `T00:00:00+00:00` sin hora real → se aplica la convención del proyecto (**20:00 Europe/Madrid**, `hasExplicitTime=false`) y se marca `endAt` sólo cuando el rango es multi-día.
5. `externalId = axarquia-<slug>`.

## 5. Idempotencia y pureza

- Test `axarquia-costa-del-sol adapter > two identical passes yield identical externalId + dedupe_key` (fixture `axarquia-detail.html`): dos pasadas producen exactamente los mismos `CanonicalEvent[]` byte-a-byte, y sus dedupe keys son idénticas.
- Purity guard `Bloque 5`: `axarquia-costa-del-sol.ts`, `lib/comarcas.ts` no importan `@supabase/supabase-js` ni contienen sentencias DML.

## 6. Dry-run real

Ejecución `FIRECRAWL_API_KEY=… deno run scripts/dry-run-comarcas.ts` (bounded `limit=3`):
- HTTP listado → 200, `text/html; charset=UTF-8`.
- HTTP detalle → 200 con JSON-LD Event completo (ej. `LOS40 Summer Live en Torre del Mar`, `Vélez-Málaga`, `2026-07-15`, CP 29740).
- `count(events)` antes = **1430**, después = **1430** → **cero escrituras**.

## 7. Bloqueos / notas

- Ninguno. Fuente lista para activación tras firma legal (`terms_reviewed_at`) + `enabled=true` + `robots_ok=true`.

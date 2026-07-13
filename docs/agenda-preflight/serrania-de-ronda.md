# Preflight — Serranía de Ronda

**Slug:** `src-eventos-serrania-de-ronda`
**Adapter key:** `serrania-de-ronda`
**Base URL:** https://www.serraniaderonda.com/portal/es/eventos.php
**Estado:** `enabled=false`, `robots_ok=false` → pendiente firma humana (Bloque 6 moderación).

## 1. robots.txt

`GET https://www.serraniaderonda.com/robots.txt` → **HTTP 200**, `text/plain`, cuerpo **vacío** → todas las rutas permitidas.

## 2. Términos / atribución

- Sitio operado por **Servicios de Internet Arundanet S.L.** (portal comarcal de la Serranía de Ronda).
- Sin cláusula específica que prohíba scraping o mining; el sitio se auto-describe como directorio público de eventos.
- Cada evento conserva `sourceUrl` y se cita “Serranía de Ronda Turismo” en `organizer`.

## 3. Formato preferente

- HTML servido por PHP tradicional, muy compacto (~29 KB por página).
- **hCalendar microformat**: cada evento es un `<a class="vevent">` con `abbr.dtstart` y `abbr.dtend` (atributo `title="YYYY-MM-DD"`), `span.summary`, `strong.location`, `span.description`.
- Paginación via `?pagina=N` (1–20 aprox.). El adapter toma **sólo la primera página** (bounded a 20) para acotar coste; futuras iteraciones pueden paginar sin cambios en el parser.

## 4. Estrategia del adapter

1. `safeFetch` del listado (una sola URL) → `parseSerraniaListing()`:
   - Regex sobre bloques `<a class='vevent' href='...'>` con `abbr.dtstart/dtend` y `strong.location`.
   - `locality = firstToken(location.split(","))` → single-municipality events limpios, multi-town (p. ej. “Montejaque, Ronda, Cortes de la Frontera”) usan la primera localidad como principal.
2. **Sin fetch de detalle**: el listado ya trae todos los campos canónicos (título, fechas, localidad, descripción y foto).
3. **Tiempo:** ninguna hora publicada → convención del proyecto **20:00 Europe/Madrid**. `endAt` sólo se emite si el evento cubre más de un día natural.
4. `externalId = serrania-<slug>` (segmento final de la URL `../eventos/<slug>`).

## 5. Idempotencia y pureza

- Test `serrania-de-ronda adapter > two identical passes yield identical externalId + dedupe_key` (fixture `serrania-list.html`): la comparación es exhaustiva (todos los eventos, no solo uno).
- Purity guard `Bloque 5`: `serrania-de-ronda.ts`, `lib/comarcas.ts` no importan `@supabase/supabase-js` ni contienen sentencias DML.

## 6. Dry-run real

Ejecución `deno run scripts/dry-run-comarcas.ts`:
- HTTP listado → 200, `text/html; charset=UTF-8`, tamaño ≈29 KB.
- N eventos parseados (típicamente 20+ en primera página) con `dtstart` válido; ejemplos: `carrera-urbana-nocturna-de-setenil` (Setenil, 2026-08-01), `pueblos-blancos-music-festival` (Montejaque, 2026-07-30 → 2026-08-02).
- `count(events)` antes = **1430**, después = **1430** → **cero escrituras**.

## 7. Bloqueos / notas

- Ninguno. Fuente lista para activación tras firma legal (`terms_reviewed_at`) + `enabled=true` + `robots_ok=true`.

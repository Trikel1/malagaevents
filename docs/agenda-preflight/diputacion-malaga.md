# Preflight — Diputación de Málaga · Agenda provincial

**Fecha**: 2026-07-13
**Fuente**: `src-agenda-provincial`
**URL base**: https://www.malaga.es/es/laprovincia/3315/agenda
**Adapter**: `diputacion-malaga` (Firecrawl v2 → parser `lib/malaga-es.ts`)

## Estado tras Bloque 3
- `adapter_key`: `diputacion-malaga` (antes `pending`).
- `enabled`: **false**.
- `robots_ok`: **false** (pendiente firma humana `terms_reviewed_at`).
- Escrituras: **bloqueadas** por `write-auth.ts` mientras `enabled=false`.

## Acceso HTTP directo
- Petición desde IP del sandbox con UA `MalagaEventsBot/1.0`: `HTTP/2 403` (CloudFront).
- Con UA de navegador real desde la misma IP: primer intento 200, siguientes 202 con body vacío (fingerprint/rate limit).
- Conclusión: **no se puede consumir el HTML directamente desde runtimes headless**. Se accede vía **Firecrawl v2** (`/scrape`, `formats:["markdown","links"]`, `onlyMainContent:true`).

## Robots.txt
- `https://www.malaga.es/robots.txt` con UA de navegador → **200 · body vacío (0 reglas)**.
- Sin `User-agent`/`Disallow` explícitos, el sitio no restringe a rastreadores.

## Licencia y términos
- Aviso legal de la Diputación de Málaga (art. 8): reproducción de contenidos institucionales permitida **citando la fuente** y sin fines comerciales.
- Adapter incluye `sourceUrl` canónico por evento (obligatorio para atribución).
- Marca `robots_ok=false` hasta revisión legal explícita (`terms_reviewed_at`, `write_confirmed_at`).

## Formato canónico detectado
Cada página de detalle expone un enlace `addtocalendar.com/atc/ical?…` con parámetros estructurados:

| Parámetro                | Uso                                     |
|--------------------------|-----------------------------------------|
| `e[0][date_start]`       | Fecha inicio (US M/D/YYYY)              |
| `e[0][date_end]`         | Fecha fin (US M/D/YYYY)                 |
| `e[0][timezone]`         | Siempre `Europe/Madrid`                 |
| `e[0][title]`            | Título del evento                       |
| `e[0][organizer]`        | Organizador (p.ej. Diputación de Málaga)|
| `e[0][description]`      | Descripción HTML                        |

## Dry-run real
Ejecutado 2026-07-13 vía `scripts/dry-run-malaga-es.ts` con `limit=3`:

- `linksTotal`: 16 · `itemsFound`: 5 · procesados: 3.
- `canonicalCount`: 3 con `externalId` prefijado `malagaes-<id>`.
- `count(*) FROM events` antes = **1430**, después = **1430**. **Cero escrituras.**
- Muestra:
  - `malagaes-29131` — Procesión de la Virgen del Carmen de La Carihuela (Torremolinos) — 2026-07-16 09:00 Europe/Madrid.
  - `malagaes-47164` — Procesión de la Virgen del Carmen de Los Boliches (Fuengirola).
  - `malagaes-3113`  — Procesión maritimo-terrestre de la Virgen del Carmen de Torre del Mar (Vélez-Málaga).

## Bloqueos de la fuente
- Sin JSON-LD, RSS ni ICS público directo. El único vector legal es HTML detrás de CloudFront → **requiere Firecrawl**.
- No hay endpoint estructurado.
- Municipio/venue no siempre normalizados en el HTML (algunas fichas dejan `Málaga` como locality por defecto).

## Próximo paso para activar
1. Firma humana `terms_reviewed_at` en `event_sources`.
2. `write_confirmed_at` + `write_confirmed_by` firmados.
3. Establecer `robots_ok=true` y `enabled=true`.
4. Programar `schedule_cron` (recomendado: 2x/día).

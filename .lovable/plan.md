
# Sprint aprobado — Pipeline exhaustivo eventos culturales (versión final)

Implementación quirúrgica con los ajustes de seguridad y aceptación añadidos.

## Alcance

Solo se modifican:
- `supabase/functions/sync-events/index.ts`
- INSERTs en `sources_config` (sin schema migration)

No se toca: UI, auth, tickets, favoritos, farmacias, deportes, mapa, i18n, providers, App.tsx, ni ninguna otra edge function.

## 1. Registro de fuentes (`sources_config`)

INSERT vía herramienta de inserción.

**Activas** (`is_active=true`):
fycma, teatro-estepona, marenostrum-fuengirola, starlite-marbella, mientrada-marbella, mientrada-edgar-neville, filarmonica-malaga, ayto-ronda, cultura-antequera, ayto-benalmadena, turismo-mijas, velez-teatro, torremolinos-cultura, entradas-fuengirola, turismo-coin, apta-axarquia, serrania-ronda, cochera-entradas.

**Inactivas con motivo en `notes`** (`is_active=false`, NO se ejecutan, NO generan runs):
- culturama-diputacion → `blocked_403`
- centro-cultural-mva → `blocked_403`
- datos-abiertos-malaga → `unavailable_500`
- lacocheracabaret-oficial → `bot_challenge`

El loop principal filtra `is_active=true` antes de crear `sync_runs`, así no aparecen runs fallidos recurrentes.

## 2. Allowlist SSRF

Añadir a `ALLOWED_SCRAPING_DOMAINS`: fycma.com, teatroestepona.com, marenostrumfuengirola.com, entradas.starlitemarbella.com, starlitemarbella.com, mientrada.net, orquestafilarmonicademalaga.com, ayuntamientoronda.es, cultura.antequera.es, antequera.es, benalmadena.es, turismo.mijas.es, mijas.es, velezmalaga.es, torremolinoscultura.es, entradas.fuengirola.es, fuengirola.es, turismocoin.es, axarquiacostadelsol.es, serraniaderonda.com, lacocheraentradas.com.

## 3. Parsers nuevos (todos en `tryDirectFetcher`)

Cada uno aislado, con try/catch, sin Firecrawl, sin bypass:

- `fetchTheEventsCalendar(url, venue)` — prueba `/wp-json/tribe/events/v1/events?per_page=50&start_date=…`; si 404 cae a HTML calendar/list.
- `fetchWpPostsList(url, venue, maxPages=5)` — recorre `/page/N`, visita posts (≤30 detalles).
- `fetchCervantesDeep()` — descubre subpáginas desde el hub y agrega JSON-LD + cards.
- `fetchMientrada(categoryUrl, venue)` — cards `.evento` con título/fecha/hora/precio/link.
- `fetchFuengirolaEntradas()` — listing `/list/events`.
- `fetchStarliteList()` — HTML básico, sin bypass.
- `fetchFilarmonica()` — próximos eventos del home + detalle.
- `fetchMunicipalAgenda(url, municipality, venue?)` — parser tolerante para Ronda, Antequera, Benalmádena, Mijas, Vélez, Torremolinos, Coín, Axarquía, Serranía Ronda.
- `fetchGenericFallback(url, venue?)` — JSON-LD → OpenGraph → cards heurísticas.

Cada parser devuelve `{ events, strategy_used, http_status, raw_count, pages_scanned, detail_pages_scanned, skip_reasons }`.

## 4. Profundidad

Cuando aplique cada parser:
- Paginación `/page/N` o `?pageNum=N`.
- 6 meses de calendario (`?eventDisplay=list&eventDate=YYYY-MM`).
- Visita de detalle si la lista no trae fecha/hora completa.
- JSON-LD primero, OpenGraph fallback, selectores específicos último.
- Concurrencia ≤4, ≤30 detalles por fuente por run.
- Timeout 12s, retry 1× con backoff 2s ante 429/503, `redirect:'follow'`.
- UA `MalagaEventsBot/1.0 (+contact@malagaevents)`, `Accept-Language: es-ES`.

## 5. Detección de estructura

Antes de elegir parser específico, sondea: REST API → cards HTML → paginación → detalle → fallback genérico. Marenostrum, Cervantes, Trinchera y Paris 15 se confirman por estructura, no por suposición.

## 6. Date parser reforzado

`parseSpanishDate` añade: prefijos día (`sábado 9 mayo`), `DD/MM` y `DD/MM/YYYY`, ISO, horas `20h`, `20.00 h`, `20:00h`, rangos `del 9 al 11 de mayo` (genera `end_at`), múltiples pases (split y crear varios eventos), inferencia de próximo año razonable, ventana 24 meses.

`original_date_text` se guarda en `tags` (existe como `ARRAY`) como `originaldate:<texto>` cuando útil; si no, en logs de diagnóstico. No bloquea ingesta.

## 7. Validación mínima relajada

Aceptar evento si `title.length >= 3`, `start_at` parseable y dentro de ventana ±0/+24 meses futuros. No descartar por falta de imagen/precio/ticket_url/descripción/categoría.

## 8. Venue aliases

`VENUE_ALIASES` en código con canónicos: La Trinchera, Paris 15, La Cochera Cabaret, Teatro Cervantes, Teatro Echegaray, Teatro Soho CaixaBank, La Térmica, FYCMA, Auditorio Edgar Neville, Teatro Auditorio Felipe VI, Marenostrum Fuengirola, Teatro Ciudad de Marbella, Starlite. Match con lower+unaccent+strip-punct+strip-prefijos. Fallback a `source.default_venue` si HTML no aporta.

## 9. Diagnóstico (sin tocar enum de status)

`sync_runs.status` mantiene los valores existentes (`running`, `completed`, `failed`). El estado técnico fino se guarda en `sync_runs.error_details` (jsonb):

```
{
  source_status: 'ok' | 'no_events' | 'parse_error' | 'blocked_403'
               | 'bot_challenge' | 'unavailable_500' | 'requires_js'
               | 'timeout' | 'partial',
  strategy_used, parser_used, http_status,
  pages_scanned, detail_pages_scanned,
  events_found_raw, events_parsed, duplicates_detected,
  skip_reasons: string[], duration_ms, requires_js, blocked
}
```

## 10. Resiliencia

- `Promise.allSettled` por fuente (mantenido).
- `cleanupStuckRuns` >30 min (mantenido).
- Invocación sin slug: procesar fuentes activas por prioridad con límite seguro por run (p. ej. lotes de 6) para no exceder wall-clock.
- Invocación con `?slug=…` (o body `{slug}`) procesa solo esa fuente, ideal para verificación.
- Fuentes `is_active=false` se omiten antes de crear el run.

## 11. NO hacer

Nada de migraciones de schema, nuevos campos obligatorios, admin UI, cambios fuera de `sync-events`, bypass de CAPTCHA/login/paywall, datos falsos o hardcodeo de eventos reales.

## 12. Verificación post-deploy

Llamadas individuales por slug a `sync-events` y comprobación en `events` + `sync_runs.error_details`:

- sala-trinchera ≥ eventos del RSS/lista/detalle
- paris-15 ≥ 1 (o `source_status` claro)
- cochera-entradas / la-cochera-cabaret mantiene ≥ 91
- teatro-cervantes ≥ 5 tras deep crawl (o estado claro)
- teatro-soho, la-termica mantienen ≥ actuales
- fycma, teatro-estepona, marenostrum-fuengirola, mientrada-marbella, mientrada-edgar-neville, entradas-fuengirola, filarmonica-malaga, ayto-ronda, cultura-antequera, ayto-benalmadena, torremolinos-cultura, apta-axarquia, serrania-ronda → ≥1 evento o `source_status` técnico verificable
- ninguna fuente queda `running` >30 min
- `error_details` permite explicar cada resultado

## 13. Criterio de éxito

El sprint se considera entregado solo si la verificación anterior demuestra cobertura real por fuente — no basta con que compile.

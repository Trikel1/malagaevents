## Diagnóstico (ya verificado contra fuentes reales)

**¿Dónde está la lista de URLs?** En la tabla `sources_config` (16 fuentes activas: agenda-municipal, antojo-malaga, cultura-malaga, eventual-music, festival-malaga, fycma, la-cochera-cabaret, la-fabrica-cerveza, la-garrapata, la-termica, malaga-magazine, paris-15, sala-marte, sala-trinchera, teatro-cervantes, teatro-soho). No hay otra lista en código.

**Estado real (eventos futuros en DB ahora mismo):**

| Fuente | Eventos | Causa raíz observada |
|---|---|---|
| La Térmica | 23 | OK |
| Agenda Municipal | 11 | OK |
| Teatro Soho | 11 | parcial — runs nuevos quedan `running` (timeout) |
| Museo Picasso | 7 | OK |
| Teatro Cervantes | 2 | parcial |
| **Resto (11 fuentes)** | **0** | fallo silencioso |
| paris-15 | 0 | Firecrawl timeout 30s en bucle (28 fallos/semana) — pero `curl https://paris15.es/eventos/` responde 200 en 1s con HTML válido |
| sala-trinchera | 0 | run del 30-ene `running` para siempre — RSS `…/category/proximos-eventos/feed/` responde 200 con items `DD/MM Título` (08/05, 09/05, 15/05…) |
| sala-marte | 0 | URL devuelve **301**; Firecrawl no resuelve y reporta "No events extracted" |
| la-cochera-cabaret | 0 | run colgado; WP fallback devuelve `posts` genéricos (no eventos) |
| antojo, eventual, festival, fycma, cultura, agenda, etc. | 0 / pocos | nunca sincronizadas o LLM extraction sin resultados |

**Causas raíz reales:**

1. **Dependencia total de Firecrawl + extracción LLM** (un único `scrapeWithConfig` con `formats: ['json'] + jsonOptions.schema`) para todas las fuentes. Es lento (15-45s por intento), inconsistente y se queda sin tiempo. Las webs son perfectamente fetcheables con `fetch` directo.
2. **`sync_runs` se quedan en estado `running`** indefinidamente cuando la edge function muere por wall-clock. Esto contamina logs y bloquea retry visibility.
3. **`parseSpanishDate` no soporta `DD/MM` sin año** (formato exacto del RSS de Trinchera).
4. **No se siguen redirects 301** (Sala Marte).
5. **Fallback WP-Tribe** asume plugin "The Events Calendar" que la mayoría no tiene; cuando devuelve 200 con `posts` genéricos los toma como eventos basura.
6. **Errores silenciosos**: si `events.length === 0` se marca `partial` sin distinguir "fuente OK pero sin programación" de "scraper roto".
7. **Auto-archivado** (visible en estados): nada filtra bots, pero los eventos viejos sin nuevas occurrences caen → venues vacíos.

---

## Plan de reparación (todo en `supabase/functions/sync-events/index.ts`, sin tocar UI ni schema)

### A. Reparar plomería

1. **Marcar como `failed` los `sync_runs` con `status='running'` y `started_at < now() - 30min`** al inicio del handler.
2. **Seguir redirects** en todos los `fetch` directos (`redirect: 'follow'`).
3. **`parseSpanishDate`**: aceptar `DD/MM` (sin año) y `DD-MM`; inferir próximo año si la fecha ya pasó. Aceptar también `HH.MMh`, `HHh`, `H:MM h`.
4. **Status granular en `sync_runs.status`**: `success | partial_no_events | blocked | parse_error | timeout | failed`. Guardar `error_details.skip_reasons` con conteo.
5. **No descartar eventos** sin imagen/precio/descripción/ticket — sólo exigir `title` + `start_date` válidos.

### B. Estrategia "fetcher directo primero, Firecrawl fallback"

Para cada fuente, intentar en orden y registrar cuál ganó:

```
1. fetcher específico (HTML directo, RSS, JSON-LD, WP-REST)
2. Firecrawl scrape JSON extraction (estado actual)
3. marcar partial_no_events / blocked
```

Fetchers específicos a añadir:

- **`fetchTrincheraRSS`** → GET `https://salatrinchera.com/category/proximos-eventos/feed/`, parsear `<item>`, regex `^(\d{1,2})\/(\d{1,2})\s+(.+)$` sobre `<title>`, `<link>` para detalle, `<description>` para texto, fecha = próximo `DD/MM` futuro. Venue = "Sala Trinchera".
- **`fetchParis15HTML`** → GET `https://paris15.es/eventos/`, extraer JSON-LD (`<script type="application/ld+json">` con `@type: Event`) + fallback regex sobre tarjetas (`.qodef-events-list-item`, `.event-date`). Venue = "París 15".
- **`fetchSalaMarteHTML`** → GET con `redirect: 'follow'` (resuelve el 301 a `/eventos/` o subdominio actual), extraer JSON-LD/microdata.
- **`fetchCocheraCabaretWP`** → reemplazar `wp-json/tribe/events/v1/events` (404) por `wp-json/wp/v2/tribe_events` o, si no, por scrape HTML de `/programacion/` con JSON-LD.
- **`fetchTeatroSohoHTML`** → ya devuelve HTML completo en 0.7s; extraer tarjetas `.event` o JSON-LD.
- **`fetchTeatroCervantesHTML`** → HTML 200 directo (550kb); JSON-LD presente.
- **`fetchGenericJSONLD`** helper compartido: busca todos los `<script type="application/ld+json">`, normaliza arrays/grafos, filtra `@type === 'Event' | 'TheaterEvent' | 'MusicEvent'`, mapea a evento estándar.

### C. Helper `extractEventsFromHTML(html, baseUrl)` reutilizable

1. JSON-LD `Event*` → evento canónico.
2. OpenGraph/meta + microdata `itemtype="https://schema.org/Event"`.
3. Patrones `<article>` con fecha + título + enlace.
4. Devuelve `{events, source: 'json-ld'|'microdata'|'pattern', raw_count}`.

### D. Logging por fuente (lo pide el brief)

Por cada fuente, escribir en `sync_runs.error_details`:

```json
{
  "strategy_used": "trinchera-rss" | "firecrawl-llm" | "json-ld" | ...,
  "http_status": 200,
  "events_found_raw": 12,
  "events_parsed": 10,
  "events_created": 6,
  "events_updated": 4,
  "events_skipped": 0,
  "skip_reasons": { "no_date": 0, "past_date": 0, "duplicate": 4 },
  "duration_ms": 4321,
  "diagnostics": [...]
}
```

Ya existe `DiagnosticLogger`; sólo hay que serializar consistentemente en `success`, no sólo en `failed`.

### E. Aliases de venue (ya estaban; verificar)

`VENUE_ALIASES` ya cubre Trinchera/Paris 15/Cochera. No tocar UI, sólo confirmar matching sin tildes.

### F. Tests rápidos al final

Tras desplegar, llamar `supabase.functions.invoke('sync-events', { body: { sources: ['sala-trinchera','paris-15','sala-marte','la-cochera-cabaret','teatro-soho'] } })` y mostrar tabla con resultado por fuente.

---

## Lo que NO se toca

- Auth, tickets, farmacias, deportes (excepto compartir `parseSpanishDate` si aplicara).
- Schema de tablas (`sources_config`, `events`, `event_occurrences`).
- UI de venues/búsqueda/filtros (la corrección de plomería arregla los venues vacíos por sí sola).
- Lista de fuentes — no se añaden ni se eliminan, sólo se reparan las existentes.
- No se inventan eventos; si la fuente no tiene programación se marca `partial_no_events`.

---

## Detalles técnicos

- Archivo único editado: `supabase/functions/sync-events/index.ts` (~+400 líneas).
- Sin nuevas dependencias.
- Compatible con la cron actual; el cleanup de `running` colgados se ejecuta en cada invocación.
- Firecrawl sigue siendo fallback — no se elimina, sólo se baja prioridad para evitar timeouts.

## Criterio de éxito

Tras 1 sync manual de las 5 fuentes test (Trinchera, Paris 15, Sala Marte, Cochera, Soho):
- Trinchera ≥ 3 eventos futuros (RSS confirma 08/05, 09/05, 15/05 ya).
- Paris 15 ≥ 1 evento futuro (HTML responde 200 con contenido).
- Cada fuente con `strategy_used`, `http_status`, `duration_ms` en `sync_runs.error_details`.
- Ningún `sync_runs` queda en `running` > 30 min.

¿Procedo?
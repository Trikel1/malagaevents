# Sprint quirúrgico — Pipeline cultural + EventCard metadata

Dos entregables independientes en un solo sprint, sin tocar UI general, schema, auth, deportes, farmacias, mapa, providers ni rutas globales.

---

## Parte A — Corrección crítica de EventCard (root cause encontrado)

### Diagnóstico

En `src/components/events/EventCard.tsx` (modo `dense`, líneas 75–79):

```tsx
<p className="text-[11px] text-muted-foreground line-clamp-1">
  <span ...>{timeShort}</span>
  <span className="mx-1">·</span>
  <span className="line-clamp-1">{venueName}</span>
</p>
```

Problemas:
1. `line-clamp-1` anidado dentro de otro `line-clamp-1`: en columnas estrechas (grid 2-col, 360–430px) el span interno colapsa el venue a un ellipsis casi vacío produciendo visualmente `23:00 · …` que el usuario percibe como `23:00 ·...`.
2. La línea se renderiza siempre aunque `venueName` caiga al fallback `"Por confirmar"` o sea un slug crudo (`paris-15`).
3. El separador `·` se imprime aunque la parte siguiente esté ausente o sea inválida.
4. Mismo riesgo en la variante normal (líneas 156–169) si venue/location vienen vacíos o como `null`/`undefined`/`"…"`.

### Cambios (solo en `src/components/events/EventCard.tsx`)

1. Crear helper local `buildMetaParts(parts: (string | null | undefined)[]): string[]` que:
   - Filtra `null`, `undefined`, `""`, `" "`, `"..."`, `"…"`, `"null"`, `"undefined"`, `"no especificado"`, `"N/A"` (case-insensitive, tras `trim`).
   - Devuelve array limpio.
2. Construir `metaParts` con `[timeShort, venueDisplay, locationDisplay?]` donde:
   - `venueDisplay` = `sanitizeText(event.venue?.name || event.venue_name)` (sin caer a `venue_normalized` slug, sin fallback "Por confirmar" en metadata — el fallback puede seguir usándose en `aria-label`).
   - `locationDisplay` solo si existe, no es `"Málaga"` redundante con venue, y difiere de venueDisplay.
3. Render dense:
   ```tsx
   {metaParts.length > 0 && (
     <p className="text-[11px] text-muted-foreground truncate">
       {metaParts.join(' · ')}
     </p>
   )}
   ```
   - Quitar el `<span className="line-clamp-1">` interno.
   - Usar `truncate` (single-line ellipsis vía CSS) en el contenedor.
4. Render normal: cada fila (Calendar/Building2/MapPin) se oculta si su valor es vacío tras filtrado. Nunca renderizar icono + texto vacío. Mantener iconografía existente.
5. `aria-label` mantiene fallback legible (`"Por confirmar"`) para accesibilidad pero no se inyecta en la línea visible.
6. Sin `||"..."`, sin `??"..."`, sin string concat manual con separadores. Ellipsis solo por CSS (`truncate` / `line-clamp-*`).

### Búsqueda global de regresiones

Verificar (solo lectura) que ningún otro componente de cards de eventos (Index/EventsPage/EventDetail/CalendarPage usan el mismo `EventCard`, así que se cubre con un solo cambio). No tocar `SportEventCard` ni cards de farmacias.

### Aceptación visual

- Nunca aparece `·...`, `· ...`, `...`, `undefined`, `null` como contenido visible.
- Si solo hay hora → `23:00`.
- Si hay hora + venue → `23:00 · La Trinchera`.
- Si hora + venue + ciudad distinta → `23:00 · La Trinchera · Marbella`.
- Sin metadata → la línea no se renderiza.
- Truncado siempre por CSS.
- Click a detalle, favorito, badge "Gratis", altura de card y alineación intactos.

---

## Parte B — Pipeline cultural exhaustivo (`supabase/functions/sync-events/index.ts`)

Estado verificado: las 22 fuentes objetivo ya están registradas en `sources_config` (incluidas las 4 inactivas con motivo). `VENUE_ALIASES`, `ALLOWED_SCRAPING_DOMAINS`, `parseSpanishDate` y `tryDirectFetcher` ya existen del sprint anterior. Este sprint **endurece y completa** lo pendiente.

### B1. Allowlist SSRF (verificar y completar)

Asegurar que `ALLOWED_SCRAPING_DOMAINS` incluye los 17 dominios del brief. Añadir solo los que falten. No ampliar genéricamente.

### B2. Parsers — completar profundidad

Para cada parser ya presente, garantizar que devuelve la diagnostic envelope completa:
```ts
{ events, strategy_used, http_status, raw_count, pages_scanned, detail_pages_scanned, skip_reasons }
```

Refuerzos puntuales:

- **fetchTheEventsCalendar**: probar `/wp-json/tribe/events/v1/events?per_page=50&start_date=YYYY-MM-DD` primero; fallback HTML con `.tribe-events-calendar-list__event` paginando 6 meses (`?eventDisplay=list&eventDate=YYYY-MM`). Cubre `fycma`, `teatro-estepona`.
- **fetchWpPostsList**: paginar `/page/1..N` (max 5), visitar detalle, JSON-LD primero, regex fallback. Cubre `marenostrum-fuengirola`, refuerza `sala-trinchera`.
- **fetchCervantesDeep**: hub → descubrir `/es/programacion/<slug>/` → visitar subpáginas → JSON-LD + cards. No quedarse en hub.
- **fetchMientrada**: cards/listados de mientrada.net (Marbella + Edgar Neville).
- **fetchFuengirolaEntradas**: lista de `entradas.fuengirola.es/list/events`.
- **fetchStarliteList**: HTML básico + `__NEXT_DATA__`. Si requiere JS, registrar `requires_js` y salir limpio.
- **fetchFilarmonica**: home + detalle.
- **fetchMunicipalAgenda(url, municipality, venue?)**: heurística tolerante para Ronda, Antequera, Benalmádena, Mijas, Vélez, Torremolinos, Coín, Axarquía, Serranía. Detectar `<li>`, `<article>`, cards, calendarios; entrar a detalle si falta fecha/hora.
- **Fallback genérico**: JSON-LD → JSON embebido → OpenGraph → cards comunes → texto/regex. No reemplaza a parsers específicos.

Reglas comunes:
- UA `MalagaEventsBot/1.0 (+contacto)`, `Accept-Language: es-ES`.
- Timeout 12s, retry 1× con backoff 2s en 429/503.
- Concurrencia ≤4, ≤30 detalles/fuente/run.
- `redirect: "follow"`.
- No bypass de CAPTCHA/login/paywall.
- `try/catch` por parser; nunca tumbar batch.

### B3. Date parser

Verificar que `parseSpanishDate` cubre: `9 mayo`, `9 de mayo`, `sábado 9 mayo`, `sáb 9 may`, `09/05`, `09/05/2026`, ISO, `20h`, `20.00 h`, `20:00h`, `del 9 al 11 de mayo`. Reglas:
- Inferir próximo año razonable si falta.
- Aceptar futuros hasta 24 meses.
- No descartar por falta de hora.
- `original_date_text` en `tags[]` (tipo ARRAY ya existente) cuando no haya campo dedicado, o solo en logs si interfiere.

### B4. Validación mínima

Aceptar evento si: `title.length>=3`, `start_at` parseable, futuro, ≤24 meses. **No** descartar por falta de imagen, precio, ticket_url, descripción ni hora si hay fecha.

### B5. Venue aliases

Verificar `VENUE_ALIASES` y matching: lower + unaccent + strip puntuación + normalizar espacios + strip prefijos `sala|teatro|auditorio` solo para matching, conservando display canónico. Si HTML no aporta venue, usar `source.default_venue`. Sin duplicados por tildes.

### B6. Diagnóstico en `sync_runs.error_details`

Por fuente: `strategy_used`, `http_status`, `pages_scanned`, `detail_pages_scanned`, `events_found_raw`, `events_parsed`, `duplicates_detected`, `skip_reasons`, `parser_used`, `duration_ms`, `requires_js`, `blocked`, `source_status` (uno de: `ok|no_events|parse_error|blocked_403|bot_challenge|unavailable_500|requires_js|timeout|partial`). **No** añadir valores nuevos a `sync_runs.status` (solo a `error_details.source_status`).

### B7. Resiliencia

`Promise.allSettled` por fuente. `cleanupStuckRuns >30min`. Fuentes `is_active=false` se omiten silenciosamente. Sin runs fallidos recurrentes para inactivas.

### B8. Verificación post-deploy

Disparar `sync-events` por slug y comprobar: `sala-trinchera`, `paris-15`, `la-cochera-cabaret`, `cochera-entradas`, `teatro-cervantes`, `teatro-soho`, `la-termica`, `fycma`, `teatro-estepona`, `marenostrum-fuengirola`, `mientrada-marbella`, `mientrada-edgar-neville`, `entradas-fuengirola`, `filarmonica-malaga`, `ayto-ronda`, `cultura-antequera`, `ayto-benalmadena`, `torremolinos-cultura`, `apta-axarquia`, `serrania-ronda`. Cada fuente queda con **eventos importados o `source_status` técnico claro** en `sync_runs.error_details`.

---

## No-regresión

No se tocará: `App.tsx`, providers, auth, tickets, favoritos, farmacias, deportes, mapa general, i18n no esencial, dark mode, rutas globales, schema, edge functions no relacionadas, otros componentes de UI. Sin migraciones. Sin dependencias nuevas. TypeScript y build deben seguir verdes.

## Archivos a modificar

- `src/components/events/EventCard.tsx` (Parte A)
- `supabase/functions/sync-events/index.ts` (Parte B)
- INSERTs/UPDATEs idempotentes a `sources_config` solo si falta algo del inventario (verificado: ya están todos)

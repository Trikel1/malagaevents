# Plan — Ingestión masiva de eventos Málaga (ciudad + provincia)

## 1. Diagnóstico del sistema actual

**Edge functions existentes (`supabase/functions/`):**
- `sync-events` — **2 319 líneas**. Función monolítica que hace scraping + parsing + normalización + dedupe + insert de eventos culturales. Es el mayor riesgo estructural: cambiar una fuente obliga a tocar el monolito y aumenta la probabilidad de romper otras.
- `sync-sports` — 1 210 líneas. Ya usa patrón mejor: whitelist de municipios, `normalizeText`, `generateDedupeKey` (SHA-256 sobre título+venue+fecha), `upsert on_conflict=dedupe_key`. Es el modelo a replicar.
- `scrape-events` (578) y `scrape-pharmacies` (572) — scrapers específicos.
- `discover-sources` (286) — descubrimiento de fuentes.
- `submit-event` (420) — envío manual con moderación (`event_submissions`).
- `admin-sync-sports`, `trigger-sync-sports` — triggers admin/cron.
- `_shared/security.ts` — utilidades compartidas (existe, pero infrautilizado).

**Tablas relevantes (Supabase):**
- `events` (44 col) — eventos culturales publicados.
- `event_occurrences` (9) — repeticiones/sesiones.
- `event_submissions` (8) — cola de moderación.
- `venues` (11) + `locations` (9) — recintos y localidades.
- `sports_events` (24), `sports_venues` (9), `sports_sources` (11), `sports_sync_runs` (10) — pila deportiva completa y limpia.
- `sources_config` (18) y `scraping_sources` (9) — **dos tablas para lo mismo en cultural**. Duplicidad heredada, hay que auditar cuál se usa realmente.
- `sync_runs` (13) — logs cultural.

**Dedupe hoy:**
- Deportes: SHA-256(`normalized_title | normalized_venue | start_datetime`) → columna `dedupe_key` con `UNIQUE` y `upsert on_conflict`. Sólido.
- Cultural: normalización de venue con canonicalización (`normalizeVenue`) pero sin `dedupe_key` uniforme visible → duplicados posibles al añadir fuentes que publican el mismo evento.

**Normalización hoy:**
- `normalizeText` (lowercase + strip acentos) replicado en varias funciones.
- Whitelist de municipios de provincia sólo en `sync-sports`.
- Aliases de venues sólo por diccionario hardcoded en `venueCoords.ts` (frontend) y `normalizeVenue` (edge).

**Qué falta para escalar:**
1. Registry unificado de fuentes cultural (hoy hay 2 tablas).
2. Patrón adaptador-por-fuente (hoy monolito).
3. `dedupe_key` en `events` como en `sports_events`.
4. Tabla de aliases de venue y localidad, editable sin desplegar.
5. Health/observabilidad por fuente (última corrida, ratio ok/error, nº insertados, nº duplicados).
6. Cron por fuente/prioridad, no “sync global” único.
7. Admin visual del registry.

---

## 2. Arquitectura recomendada

```text
┌────────────────────────────────────────────────────────────┐
│  event_sources (registry unificado — reemplaza sources_config/scraping_sources) │
│    id, kind (institutional|theater|music|museum|festival|  │
│    aggregator|municipal), name, base_url, adapter_key,     │
│    locality_slug, category_hints[], priority, enabled,     │
│    schedule_cron, robots_ok, notes                         │
└────────────────────────────────────────────────────────────┘
                │
                ▼
┌────────────────────────────────────────────────────────────┐
│  ingest-dispatcher (edge fn, corta)                        │
│    lee event_sources.enabled=true, filtra por prioridad,   │
│    invoca en paralelo controlado a scrape-source           │
└────────────────────────────────────────────────────────────┘
                │
                ▼
┌────────────────────────────────────────────────────────────┐
│  scrape-source (edge fn, corta)                            │
│    - carga adapter por adapter_key (import dinámico)       │
│    - fetch (Firecrawl o fetch nativo según fuente)         │
│    - guarda snapshot crudo → raw_event_snapshots           │
│    - normaliza → array<CanonicalEvent>                     │
│    - dedupe & upsert → events / event_occurrences          │
│    - registra corrida → event_source_runs                  │
│    - errores estructurados → ingestion_errors              │
└────────────────────────────────────────────────────────────┘
                │
                ▼
┌────────────────────────────────────────────────────────────┐
│  Adaptadores (supabase/functions/_shared/adapters/*.ts)    │
│    ayto-malaga.ts, teatro-cervantes.ts, echegaray.ts,      │
│    picasso.ts, thyssen.ts, cac.ts, pompidou.ts,            │
│    la-termica.ts, paris15.ts, trinchera.ts, cochera.ts,    │
│    diputacion.ts, municipal-<slug>.ts, ...                 │
│    Cada uno exporta: { fetchList, parseItem, kind }        │
└────────────────────────────────────────────────────────────┘
```

Reglas duras:
- Un adaptador = un archivo pequeño. Nunca ampliar `sync-events` monolítico.
- `scrape-source` es el único que escribe en `events`.
- Ningún adaptador conoce Supabase — sólo devuelve `CanonicalEvent[]`.

---

## 3. Modelo de datos propuesto

Todas nuevas, ninguna modifica lo existente en ruptura. Impacto por tabla:

| Tabla nueva | Propósito | Impacto |
|---|---|---|
| `event_sources` | Registry único (cultural + deportivo si se quiere unificar en fase futura). | Migrar `sources_config` + `scraping_sources` con vistas de compatibilidad hasta consolidar. Cero downtime. |
| `event_source_runs` | Una fila por corrida por fuente: `started_at`, `finished_at`, `status`, `inserted`, `updated`, `skipped_dupes`, `errors`, `duration_ms`. | Alimenta admin. Sustituye/complementa `sync_runs`. |
| `ingestion_errors` | Errores estructurados por corrida: `source_id`, `run_id`, `stage`, `message`, `payload_sample`. | Debug real por fuente. |
| `source_health` (vista materializada) | Última corrida, ratio éxito 7d, latencia p50, nº eventos vivos. | Panel admin y semáforo. |
| `raw_event_snapshots` | HTML/JSON crudo por item con `content_hash`. TTL 30d. | Reproducibilidad, debug de parsers rotos, evita rescrapear en cambios de parser. |
| `venue_aliases` | `alias_normalized` → `venue_id`. Editable desde admin. | Convierte “Teatro Cervantes Málaga” / “T. Cervantes” / “Cervantes” en el mismo `venue`. |
| `locality_aliases` | Ídem para localidades/municipios (con `municipio_slug`). | Corrige “Málaga capital”, “Málaga ciudad”, “Málaga”. |
| Alter `events` | Añadir `dedupe_key text unique`, `source_id uuid`, `content_hash text`, `last_seen_at timestamptz`. Backfill = hash de datos actuales. | **Cambio a existente**: pequeño, retrocompatible (nullable + backfill), pero requiere migración planificada. |

Sin RLS público de escritura en ninguna. Todas con `GRANT` a `service_role`, `SELECT` a `authenticated` solo en `event_sources` + vista `source_health` + `event_source_runs` para admin.

---

## 4. Estrategia de deduplicación

Clave canónica (para `events.dedupe_key`):
```
sha256(
  normalize(title)
  | normalize(venue_canonical || locality_canonical)
  | to_char(start_at at time zone 'Europe/Madrid', 'YYYY-MM-DD HH24:MI')
)
```
- `venue_canonical` viene de `venue_aliases`, no del string original.
- Ventana de tolerancia horaria: ±15 min → generar 3 claves candidatas y buscarlas antes de insertar; si hay coincidencia con otra fuente y **mayor `source.priority`**, se sobreescriben campos vacíos (imagen, precio, url) pero NO se duplica fila.
- Similitud de títulos: Levenshtein normalizado ≥ 0.9 sobre el mismo venue+fecha ⇒ misma fila (log en `ingestion_errors` como `merged`).
- Regla de prioridad: institucional > venue oficial > agregador. Configurable en `event_sources.priority`.

---

## 5. Estrategia de cobertura

- `event_sources.locality_slug` obligatorio. Municipio “malaga” por defecto.
- Whitelist provincial ya existente en `sync-sports` se traslada a tabla `locality_aliases` + `municipios` (o columna en `locations`), reutilizada por ambos flujos.
- Selector de localidad en frontend (ya existe parcialmente) filtra por `locality_slug`.
- Fase 3 arranca con Málaga capital; provincia entra en fase 6, no antes, para no diluir la calidad.

---

## 6. Admin

Extensión de `/admin` (sin crear rutas nuevas):
- Tabla de fuentes con: nombre, kind, localidad, última corrida, estado (verde/amarillo/rojo), eventos vivos, botón **Sync ahora**, toggle **Activa**.
- Historial de corridas por fuente (últimas 20).
- Panel “Errores recientes” leyendo `ingestion_errors`.
- Contadores globales: eventos culturales, deportivos, farmacias, submissions pendientes.
- Botón sync global (dispatcher).

Sin métricas inventadas: si no hay dato → “No disponible”.

---

## 7. Seguridad

- API keys (Firecrawl, `SYNC_ADMIN_KEY`, `SYNC_SPORTS_KEY`) sólo en edge fns vía `Deno.env.get`.
- `scrape-source` y `ingest-dispatcher` requieren `x-sync-key` (patrón ya usado). Cron con clave dedicada.
- Rate limit por fuente en el dispatcher (concurrencia máx N, delay entre requests por dominio).
- Respeto de `robots.txt`: campo `robots_ok` en `event_sources`, marcado tras verificación manual. El dispatcher salta fuentes sin OK.
- Logs sin PII. Los snapshots en `raw_event_snapshots` no contienen credenciales.
- RLS: `event_sources`, `event_source_runs`, `ingestion_errors` solo lectura para admin (`has_role(auth.uid(), 'admin')`), escritura sólo `service_role`.

---

## 8. Fases (cada una entregable y reversible)

**Fase 1 — Auditoría + registry (sin scraping nuevo)**
- Confirmar cuál de `sources_config` / `scraping_sources` está vivo.
- Migración: crear `event_sources`, `event_source_runs`, `ingestion_errors`, `venue_aliases`, `locality_aliases`, `raw_event_snapshots`. Backfill desde tablas existentes.
- Añadir `dedupe_key`, `source_id`, `content_hash`, `last_seen_at` a `events`. Backfill con función SQL.
- Admin: read-only del nuevo registry.

**Fase 2 — Dispatcher + primer adaptador refactorizado**
- Crear `_shared/adapter.ts` (tipos + helpers) y `_shared/normalize.ts` (extraer de `sync-events`).
- Nuevas edge fns: `ingest-dispatcher`, `scrape-source`.
- Portar **un** parser existente (el más estable) desde `sync-events` a un adaptador aislado. Dejar el monolito funcionando en paralelo. Comparar resultados 1 semana.

**Fase 3 — Fuentes institucionales Málaga ciudad**
- Adaptadores: Ayuntamiento de Málaga, Cultura Málaga.
- Prioridad alta (fuente autoritativa).

**Fase 4 — Teatros y salas grandes**
- Cervantes, Echegaray, Soho, Cánovas, París 15, Trinchera, Cochera Cabaret, Sala Marte, La Garrapata, La Fábrica.
- Un adaptador por sala. Aliases de venue poblados desde el inicio.

**Fase 5 — Museos / centros culturales**
- Picasso, Thyssen, Pompidou, CAC, Museo de Málaga, La Térmica, Contenedor UMA, MVA.

**Fase 6 — Provincia / municipios**
- Diputación + agendas municipales relevantes (Marbella, Fuengirola, Vélez, Ronda, Antequera, Torremolinos, Estepona, Rincón, Mijas, Nerja para arrancar).
- Un adaptador por municipio; muchos comparten CMS ⇒ adaptador parametrizable.

**Fase 7 — Deportes ampliado**
- Aprovechar `sports_sources`. Migrar (opcional) al nuevo registry unificado, sin romper `sync-sports` actual.

**Fase 8 — Health monitoring, admin completo, retirada del monolito**
- Vista `source_health`, semáforos, alerta si una fuente 0 eventos 7d.
- Deprecar `sync-events` monolítico cuando todos sus parsers estén migrados. **No antes.**

---

## 9. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Duplicados al añadir varias fuentes con el mismo evento | `dedupe_key` + tolerancia ±15min + prioridad de fuente |
| Fechas incorrectas / TZ | Todo en `Europe/Madrid`; store en `timestamptz`; parser rechaza si no puede resolver TZ |
| HTML cambiante | `raw_event_snapshots` + `content_hash`; alerta si parser devuelve 0 items dos corridas seguidas |
| Coste Firecrawl | Usar `fetch` nativo cuando el HTML es plano; Firecrawl sólo en fuentes JS-heavy; cache 6h por URL |
| Legalidad / robots | Campo `robots_ok`, revisión manual antes de activar |
| Rendimiento edge | Adaptadores pequeños, timeout 30s, dispatcher trocea |
| Romper `sync-events` actual | Estrangulamiento gradual: monolito y nuevos adaptadores conviven hasta Fase 8 |
| Eventos cancelados | `last_seen_at`; si una fuente deja de listar el evento 3 corridas ⇒ `status='archived'` (no borrado físico) |

---

## 10. Archivos que se tocarían / NO se tocarían

**Se tocarían (a partir de Fase 2, no ahora):**
- Nuevas: `supabase/functions/ingest-dispatcher/`, `scrape-source/`, `_shared/adapters/*.ts`, `_shared/normalize.ts`, `_shared/dedupe.ts`.
- `src/pages/AdminPage.tsx` y componentes de `src/components/admin/*` (extensión, no reescritura).
- Migraciones nuevas (tablas y `ALTER events`).

**NO se toca en ninguna fase temprana:**
- `sync-events`, `sync-sports`, `scrape-events`, `scrape-pharmacies`, `submit-event`, `trigger-sync-sports`, `admin-sync-sports`.
- Rutas de la app, i18n, dark mode, mapa, farmacias, tickets, auth, PWA, SEO.
- Tablas `events`/`event_occurrences`/`venues`/`locations` en su forma actual (solo se **añaden** columnas nullable en Fase 1).

---

## 11. Criterios de éxito

- ≥ 15 fuentes activas al final de Fase 5, ≥ 25 al final de Fase 6.
- Tasa de duplicados < 2 % (medida en `event_source_runs.skipped_dupes` vs `inserted`).
- 100 % de eventos con `venue_id` resuelto vía aliases (no strings sueltos).
- Admin muestra semáforo por fuente y última corrida real.
- Cero incidencias en flujos existentes (frontend, farmacias, deportes, tickets, auth) durante la migración.
- Corridas repetibles y observables en `event_source_runs`.

---

## 12. Primer prompt de implementación recomendado (para ejecutar solo tras aprobación)

> **Fase 1 — Auditoría del registry y migración base**
>
> 1. Ejecutar `SELECT count(*), enabled FROM sources_config GROUP BY enabled;` y `SELECT count(*), enabled FROM scraping_sources GROUP BY enabled;` para saber cuál está vivo.
> 2. Ejecutar `rg` sobre `supabase/functions` para listar qué función consulta cada una.
> 3. Proponer una migración que:
>    - cree `event_sources`, `event_source_runs`, `ingestion_errors`, `venue_aliases`, `locality_aliases`, `raw_event_snapshots` con GRANTs correctos y RLS por rol admin.
>    - añada a `events` las columnas `dedupe_key text`, `source_id uuid`, `content_hash text`, `last_seen_at timestamptz` (todas nullable).
>    - cree índice único parcial `CREATE UNIQUE INDEX events_dedupe_key_uidx ON events(dedupe_key) WHERE dedupe_key IS NOT NULL;` (permite convivir con datos legacy).
>    - función `backfill_events_dedupe_keys()` idempotente.
> 4. NO tocar edge functions ni frontend en esta fase.
> 5. Añadir en `/admin` un panel read-only listando `event_sources` (aunque esté vacío).
>
> Al terminar la fase, reportar filas creadas, columnas añadidas y estado del backfill.

Ninguna fase se ejecuta sin tu OK explícito.

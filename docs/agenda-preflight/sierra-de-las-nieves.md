# Preflight — Sierra de las Nieves

**Slug:** `src-eventos-sierra-de-las-nieves`
**Adapter key:** `pending` → **NO IMPLEMENTADO**
**Base URL:** https://www.i-sierradelasnieves.com/eventos/
**Estado:** `enabled=false`, `robots_ok=false`, `paused_reason='no_structured_event_data:wp_blog_posts'`.

## 1. robots.txt

`GET https://www.i-sierradelasnieves.com/robots.txt` → **HTTP 200**, `text/plain`.

El archivo bloquea vistas alternativas del plugin de calendario (`/eventos/action~agenda/`, `/eventos/action~month/`, …) pero **no** la ruta base `/eventos/`. También expone `Sitemap: /sitemap_index.xml`. No hay restricción legal a priori — el bloqueo es técnico.

## 2. Formato — auditoría real

Diagnóstico realizado el 2026-07-13 sobre la URL base:

| Chequeo | Resultado |
|---|---|
| `/eventos/?ical=1` | HTTP 200 pero devuelve **HTML** (no `text/calendar`), no es un feed ICS válido. |
| `/eventos/list/?ical=1` | HTTP 404. |
| `/events/?ical=1` | HTTP 404. |
| `/wp-json/tribe/events/v1/events` | HTTP 404 (`rest_no_route`) — el plugin The Events Calendar no está expuesto. |
| JSON-LD en `/eventos/` | 1 bloque, y es únicamente `WebPage` — **no hay ningún `@type: Event`**. |
| Marcado del plugin (`.tribe-events-*`, `.mec-event`, `.em-event`, `.modern-events-*`) | **0 ocurrencias**. |
| Estructura observada | 4 `<article class="elementor-post … category-actualidad …">` — son **posts de blog WordPress** categorizados como "actualidad", sin campos de fecha/lugar. |

Los "eventos" son artículos periodísticos (crónicas de rutas, comunicados de prensa) sin objeto Event asociado. El plugin de calendario que solía habilitar la ruta fue retirado en algún momento; la URL sobrevive vacía de datos estructurados.

## 3. Decisión

Construir un adaptador sobre HTML plano exigiría **inventar fechas y lugares** heurísticamente sobre prosa libre — exactamente lo que el estándar del proyecto prohíbe ("no inventar", "no simular un adapter"). En consecuencia:

- **NO se implementa adaptador.** `adapter_key` permanece en `pending`.
- Se marca `paused_reason='no_structured_event_data:wp_blog_posts'` en `public.event_sources` (migración `20260713_bloque5`).
- Se anota en `notes` la razón exacta y la condición de reevaluación: **"cuando el sitio publique agenda estructurada (JSON-LD Event, ICS, o REST de The Events Calendar)"**.

## 4. Alternativas descartadas

- Feed ICS: inexistente (todos los endpoints probados devuelven HTML o 404).
- REST del plugin: deshabilitado (404 `rest_no_route`).
- Sitemap `sitemap_index.xml`: contiene posts de blog, no eventos.
- HTML dedicado con selectores versionados: requeriría inferencia semántica sobre texto libre → **rechazado**.

## 5. Impacto

Ninguno. La fuente ya estaba `enabled=false`. `count(events)` antes = **1430**, después = **1430**. La entrada permanece en el registro para retomarla en cuanto la comarca publique datos estructurados; el flag `paused_reason` la excluye automáticamente de futuras planificaciones de sync.

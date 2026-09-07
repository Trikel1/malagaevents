# Auditoría final — 7 de septiembre de 2026

Pasada de corrección de defectos encontrados en revisión independiente (no rediseño).
Ámbito: sincronización de URL en la agenda cultural, i18n del planificador "Tengo dos horas",
atribución cartográfica, verificación de fuentes oficiales y estado real de backend/datos.
**El frontend no se ha publicado en esta pasada.**

## 1. Estado de commits y despliegue

| Elemento | Estado |
|---|---|
| Últimos commits en la rama de trabajo | `41df1e4`, `3b9d30d`, `5b83f49`, `bf7448c`, `cb40419`, `d4b61bc` (mensajes autogenerados por la plataforma: "Changes" / "Work in progress") |
| Commit de la pasada 1 citado en la revisión | `e81454c8797082b6591bc99514276595b7f1a19c` |
| Publicación del frontend | **No realizada** (a petición explícita) |
| Edge functions | Sin despliegue nuevo en esta pasada; no se modificó ninguna función |
| Migraciones | Ninguna nueva. La última aplicada sigue siendo `user_interest_preferences` (fase 4) |

Limitación honesta: el historial de git de este entorno usa mensajes autogenerados, por lo que no
puede establecerse una correspondencia commit↔cambio funcional más fina que la de esta tabla.

## 2. Cambios de esta pasada

- **`src/pages/events/eventsUrlState.ts`** — modelo único de parseo/serialización (ya existente en la
  pasada anterior), ahora cubierto por pruebas.
- **`src/pages/EventsPage.tsx`**, **`src/hooks/useEvents.ts`** — sin cambios nuevos en esta pasada.
- **`src/pages/Index.tsx`** — se vuelve a montar `TwoHoursSheet` (carga diferida) entre "Para ti" y
  "Este finde": la función real se conserva y ya está traducida, en vez de quedar huérfana.
- **`src/modules/maps/LeafletMap.tsx`**, **`src/modules/maps/ModernMap.tsx`** — el crédito de datos pasa
  a `© OpenStreetMap contributors · © CARTO` (texto exigido por ODbL para OSM y por los términos de las
  teselas CARTO). Se mantiene visible en el control de atribución. La eliminación del *prefix* enlazado
  de Leaflet ("Leaflet", enlace opcional al proyecto) es independiente del crédito de datos y no afecta
  al cumplimiento: el crédito requerido sigue mostrándose como texto.
  Nota sobre el enlace: ODbL exige el crédito, no un hipervínculo, cuando el medio no lo permite; aquí
  se presenta como texto sin navegación externa. Si se decidiera que el enlace es obligatorio para este
  caso concreto, habría que reintroducir un enlace a `openstreetmap.org/copyright`.
- **`src/pages/events/eventsUrlState.test.ts`** (nuevo, 10 pruebas) y
  **`src/test/events-url-sync.test.tsx`** (nuevo, 8 pruebas de ruta/componente reales).

## 3. Pruebas de regresión de URL — evidencia real ejecutada

`src/test/events-url-sync.test.tsx` renderiza el `EventsPage` real dentro de un router real
(`MemoryRouter`) y comprueba a la vez la URL resultante y las opciones que recibe la capa de datos:

1. Enlace directo `/events?filter=weekend` → alcance `datePreset=weekend` aplicado en el primer render.
2. `?filter=family,free&preset=weekend` compartido/recargado → `familyKids` + `isFree` + `weekend`.
3. Cambio de preset con `utm_source` presente → no se pierde `family`/`free`, se conserva `utm_source`,
   desaparece la clave heredada `filter`.
4. Búsqueda con *debounce* (`replace`, sin ensuciar el historial) y Enter (`push`); atrás/adelante
   restauran la búsqueda comprometida y el input, sin estado obsoleto.
5. Cambio y eliminación de categoría desde el chip → solo se limpia `category`.
6. Aplicar y quitar filtros desde el panel → serializados (`category=theater`, `free=1` y su retirada).
7. Reset → deja exactamente `utm_source=news`.

`src/pages/events/eventsUrlState.test.ts` cubre parseo heredado, precedencia canónica, rechazo de
presets/categorías/edades inválidas, validación de claves de día imposibles (`2026-02-31`), listas UUID
(incluido intento de inyección), ida y vuelta completa y comparación de búsquedas sin orden.

## 4. Puertas ejecutadas (resultados exactos)

| Puerta | Resultado |
|---|---|
| Typecheck (`tsgo --noEmit -p tsconfig.app.json`) | Sin errores |
| Tests (`vitest run`) | **31 ficheros, 245 pruebas, todas en verde**, 61,5 s |
| Build (`vite build`) | Correcto, 17,5 s; aviso conocido de *chunks* > 500 kB; PWA precache 86 entradas |

## 5. Limitaciones declaradas (no afirmar de más)

- **No se han ejecutado** pruebas exhaustivas de zoom al 200 %, RTL ni temas claro/oscuro en esta pasada.
  La afirmación previa basada únicamente en la ausencia de `scrollWidth` se retira: no constituye evidencia.
  Lo verificado en JSDOM es accesibilidad estructural (axe) en `EventCard` y `BottomNav`.
- La atribución cartográfica se ha corregido en código; no se ha capturado prueba visual en navegador
  en esta pasada.
- El CSV de auditoría de fuentes (`docs/auditoria-fuentes-2026-09-07.csv`) contiene **214 filas de datos**
  más cabecera, y `docs/auditoria-extractores-2026-09-07.csv` 22 filas. **No cubre las 270 entradas
  históricas** mencionadas en la revisión: faltan al menos las fuentes deportivas del registro
  `sports_sources` y las entradas históricas retiradas. Queda como brecha abierta, no como trabajo hecho.

## 6. Idiomas

El repositorio tiene **10 ficheros de idioma** (`ar, de, en, es, fr, it, ja, pt, ru, zh`). El informe de la
pasada 1 decía "9 idiomas": era **incorrecto**. Las claves nuevas (`twoHours.*`, `events.countPartialA11y`,
`home.forYou.*`, `interests.*`) están en los 10.

## 7. Ficheros generados por la plataforma

`src/integrations/supabase/client.ts`, `previewAuthStorage.ts` y `types.ts` aparecen modificados en el
historial. Corresponden a **regeneración automática de la plataforma** (client/previewAuthStorage tras el
aprovisionamiento del backend; `types.ts` tras la migración `user_interest_preferences`). **No se han
editado a mano en ninguna pasada** y no deben editarse. El informe previo que los daba por "sin cambios"
era impreciso: cambiaron, pero no por edición propia.

## 8. Preferencias de gustos — RLS y aislamiento invitado/cuenta

`user_interest_preferences` tiene 4 políticas, todas para el rol `authenticated` y todas de propietario:

| Operación | USING | WITH CHECK |
|---|---|---|
| SELECT | `auth.uid() = user_id` | — |
| INSERT | — | `auth.uid() = user_id` |
| UPDATE | `auth.uid() = user_id` | `auth.uid() = user_id` |
| DELETE | `auth.uid() = user_id` | — |

Sin acceso `anon`. Filas actuales: 0. El modo invitado usa exclusivamente almacenamiento local con clave
`mc.interests.v1.guest`, separada de `mc.interests.v1.user.<id>`, por lo que no hay mezcla entre cuentas
ni fuga de gustos de un usuario a otro en el mismo dispositivo.

## 9. Verificación de las observaciones de fuentes oficiales

### 9.1 malaga.eu — error de horas confirmado (defecto de importación, no corregido aquí)

Consulta directa a la base de datos:

- `Festival Flamenco de Olías 2026 jmd2` → `start_at = 2026-09-12 22:00:00+00`, es decir **13 sep 00:00
  hora de Madrid**, mientras la agenda oficial indica **12 sep 22:00 local**. Confirmado: la hora local se
  guardó como si fuera UTC.
- El patrón es sistemático en esa fuente: de 30 eventos futuros de `malaga.eu`, **15 tienen 00:00 UTC**
  (02:00 Madrid) y aparecen **pares del mismo título** con `00:00` y `20:00` UTC (p. ej. "OFMA. Orquesta de
  Flautas de Málaga", "Manipulación de Alimentos"), lo que apunta a que inicio y fin del rango diario se
  están insertando como dos eventos distintos, además del desfase horario.

No se ha modificado ningún dato ni ningún extractor (ámbito de solo lectura sobre backend/scrapers).
Corrección pendiente en el importador de `malaga.eu`: interpretar las horas publicadas como `Europe/Madrid`
y no duplicar filas por rango.

### 9.2 cultura.malaga.eu

Observación recibida (taller familiar 25 sep, 4–10 años; clubes activos 17/21/24 sep) **no verificada** en
esta pasada contra la base de datos ni contra la fuente. No se afirma ni se niega su presencia.

### 9.3 Unicaja Baloncesto — el feed ICS sí funciona

Comprobación real (`curl`, 7 sep 2026):

- `https://www.unicajabaloncesto.com/calendario/ics` → **HTTP 200**, `Content-Disposition: attachment;
  filename="calendar.ics"`, cuerpo `BEGIN:VCALENDAR` con **40 `VEVENT`** (primer partido: Real Madrid –
  Unicaja, `DTSTART:20260927T170000Z`). El rechazo previo se debía únicamente al `content-type`
  `text/calendar` del verificador web, no a la fuente.
- `robots.txt` de ese dominio: `User-agent: *` con `Disallow:` vacío → **permitido**.
- Ya existe adaptador ICS reutilizable (`supabase/functions/_shared/sports-sync/adapters/ics.ts`,
  tipo `AdapterKind = "json" | "ics" | "html"`), con parser RFC 5545 compartido y fixture de Unicaja.

Estado actual en el registro (`sports_sources`), sin tocar:

| slug | url | adapter_key | último estado |
|---|---|---|---|
| `unicaja-baloncesto` | `…/calendario` | `html-generic` | `empty` (10 leídos / 9 escritos) |
| `unicaja` | `…/calendario` | `null` | `empty` — `no_events: la fuente respondió pero no expuso eventos legibles` |
| `unicaja-tickets` | `venta.unicajabaloncesto.com/es/proximos-partidos` | `null` | `empty` |
| `acb-unicaja` | `acb.com/club/partidos/id/14` | `null` | `empty` |

Recomendación (no aplicada, requiere cambio de registro en backend): apuntar `unicaja-baloncesto` a
`https://www.unicajabaloncesto.com/calendario/ics` con `adapter_key = 'ics'` y retirar el duplicado
`unicaja`. **No se declara ningún adaptador como correcto sin ejecución real del sincronizador.**

## 10. Totales de datos verificados hoy

| Métrica | Valor |
|---|---|
| Eventos culturales (total en tabla) | 1.810 |
| Eventos futuros de `malaga.eu` | 30 (15 con hora sospechosa) |
| Eventos deportivos (total) | 3.182 |
| Filas de preferencias de gustos | 0 |
| Políticas RLS en `user_interest_preferences` | 4 (todas owner-only) |

## 11. Brechas abiertas

1. CSV de auditoría incompleto respecto a las 270 entradas históricas y al registro deportivo.
2. Defecto de horas y duplicados en la importación de `malaga.eu` (diagnosticado, no corregido).
3. Migración de Unicaja al adaptador ICS (verificada la viabilidad, no aplicada ni ejecutada).
4. Verificación de `cultura.malaga.eu` pendiente.
5. Pruebas reales de 200 %, RTL y temas pendientes en navegador.

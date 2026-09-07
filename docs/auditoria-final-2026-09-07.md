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

En esta sección concreta no se ha modificado ningún dato ni ningún extractor (ámbito de solo lectura sobre
backend/scrapers). **Esta afirmación es local a la sección 9.1 y no vale para toda la auditoría**: en el
cierre de seguridad (sección 11) sí hubo cambios en la base de datos —las cabeceras de tres trabajos de
`pg_cron`— realizados por el propietario del proyecto.

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

## Corrección de clasificación deportiva (QA independiente, 2026-09-07)

### Defecto probado
`status = 'confirmed' AND is_in_malaga_province = true` no basta para publicar
una fila como plan deportivo verificado. En datos reales había:

- contenido artístico o religioso con `sport_category = 'other'`
  («Espectáculo Ronda Flamenca», conciertos homenaje, procesiones);
- partidos **fuera de casa** anclados a Málaga por la columna `city`
  («Celta vs Málaga CF» con `venue_name = 'Estadio La Rosaleda'` o
  `'LaLiga Málaga CF'`), incluidos Getafe y Alavés;
- recintos marcador (`Not specified`, `No data available`, `N/A`);
- horas inventadas: fechas sin hora guardadas como medianoche UTC se
  mostraban como «02:00» en horario de Madrid.

### Regla aplicada (`src/lib/sportsEligibility.ts`)
Evidencia positiva, sin listas negras de estadios:

1. **Disciplina**: categoría explícita, o término deportivo con límite de
   palabra en título/competición. `unicaja` por sí solo nunca implica
   baloncesto; `trialbici` es ciclismo, no motor; una concentración de Vespas
   se describe como concentración, no como competición.
2. **Contenido no deportivo**: léxico artístico/religioso descarta la fila
   salvo señal deportiva explícita (una carrera solidaria sigue siendo carrera).
3. **Procedencia**: sin `source_url`/`canonical_url` no se publica.
4. **Partido fuera de casa**: se parte «A - B»/«A vs B»; si el club local es el
   visitante, nunca es local, diga lo que diga `city`.
5. **Localidad en dos niveles**:
   - `verified`: recinto o dirección nombra un municipio de la provincia
     (catálogo `localitiesCatalog`);
   - `provisional`: solo lo sostiene `city` y el recinto no es marcador →
     se publica marcado `needs_review`, nunca como verificado;
   - resto: omitido.

### Impacto medido (lectura, 1 000 filas futuras `scheduled`)
`eligibles 569` (93 verificadas + 476 provisionales), `omitidas 431`:
`away_fixture 315`, `locality_unverified 94`, `unknown_discipline 22`,
`non_sport_content 0` en esa muestra (sí en las `confirmed`).

### Puntos de aplicación
- `src/hooks/useSportsEvents.ts` (listado, calendario y mapa deportivos).
- `src/lib/sportsAgendaMerge.ts` (agenda y recomendaciones de Inicio):
  disciplina, tipo de entidad (`match`/`tournament`/`activity`) y municipio
  derivados del veredicto; medianoche UTC → hora desconocida.
- `src/hooks/useSportsAgenda.ts`: los filtros de deporte y tipo de las filas
  sincronizadas se aplican tras normalizar, no en SQL.

### Pruebas
`src/lib/sportsEligibility.test.ts` (16 casos con fixtures reales) y casos
añadidos en `src/lib/sportsAgendaMerge.test.ts`. Batería completa: 263 pruebas
en verde. Verificación visual real en navegador (390×1400): la agenda muestra
Montañismo/Motor/Atletismo/Ciclismo con tipo correcto y sin horas inventadas.

### No corregido en este pase
La clasificación en los adaptadores de ingesta (`supabase/functions/_shared/
sports-sync`) sigue escribiendo `sport_category = 'other'` y recintos marcador;
la corrección se aplica en lectura. Los duplicados masivos del mismo partido
(hasta 12 filas) tampoco se han deduplicado: requiere cambio de ingesta y
limpieza de datos, fuera del alcance de solo lectura de este pase.

## 11. Cierre de seguridad y despliegue real (2026-09-07, pase final)

### 11.1 Bloqueo corregido: nombre de la credencial compartida
`authorizeAdminRequest` en `supabase/functions/_shared/security.ts` leía
`SYNC_ADMIN_KEY`, credencial que este proyecto no usa para la ingesta programada.
Ahora lee **`SYNC_SPORTS_KEY`** (constante exportada `SYNC_KEY_ENV_NAME`), que es
la que `pg_cron` envía en la cabecera `x-sync-key`. No se ha creado ni impreso
ninguna credencial y la autenticación no se ha relajado: el rol de administrador
se sigue comprobando en servidor con `has_role`, nunca a partir del JWT decodificado.
La función acepta ahora inyección de dependencias (`getEnv`, `createClient`) sólo
para poder probarla sin red.

Existencia verificada en el entorno del proyecto (sólo nombres, sin valores):
`SYNC_SPORTS_KEY` y `SYNC_ADMIN_KEY` están configuradas; el guardia usa la primera.

### 11.2 Cambios en la base de datos (realizados por el propietario)
El propietario completó, mediante el conector de consulta de Lovable y en una
única transacción `DO`, la actualización de cabeceras de tres trabajos de `pg_cron`
con `cron.alter_job` (sólo el `command`; ni `schedule`, ni `name`, ni `active`; sin
ejecutar ningún job):

| Job | Nombre | Programación | Activo |
|-----|--------|--------------|--------|
| 1 | `scrape-malaga-events-daily` | `0 6 * * *` | sí |
| 2 | `sync-events-every-6h` | `0 */6 * * *` | sí |
| 5 | `refresh-pharmacies-directory` | `0 4 * * *` | sí |

Cada uno conserva su URL/body/cabeceras originales y añade
`jsonb_build_object('x-sync-key', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='SYNC_SPORTS_KEY' LIMIT 1))`.
Los jobs 4 y 6 ya usaban Vault y no se tocaron. **Por tanto la auditoría en conjunto
NO es "cero cambios en base de datos".** Este agente no ejecutó ni revirtió esos cambios.

### 11.3 Farmacias: validación de fecha y seguridad de borrado
- `parseStrictDateISO` (en `_shared/security.ts`) exige tipo cadena y fecha de
  calendario exacta: `2026-02-30` y `2025-02-29` se rechazan (antes `Date.parse`
  las normalizaba) y ya no se usa `.slice(0,10)`, que podía truncar basura o lanzar
  con entradas no textuales.
- `_shared/pharmacySweep.ts` decide la escritura:
  - barrido parcial (`zone` o `zonesLimit`) sin `dryRun` → **rechazado con 400**
    antes de cualquier petición externa;
  - `zonesLimit` no entero positivo → rechazado;
  - `dryRun` → cero escrituras (tampoco fila de estado);
  - barrido completo con **alguna zona fallida** → no se borra ni se reemplaza nada
    (`write_skipped_incomplete_sweep_failed_zones`): se conservan las filas existentes;
  - sólo un barrido completo y sin fallos reemplaza el día.
- No se ejecutó ninguna ingesta real ni se borró ningún dato en producción.

### 11.4 CORS y honestidad del formulario público
`submit-event` ya no duplica su propia lista de orígenes: importa `getCorsHeaders`
y `getAllHeaders` de `_shared/security.ts` (misma lista pública, sin comodines).
Se conservan la validación de categorías y fechas y la marca honesta
`captcha_passed: false` (no hay captcha verificado en servidor).

### 11.5 Métodos no soportados
`sync-events`, `scrape-events` y `discover-sources` responden **405** a cualquier
método distinto de `POST` (y `OPTIONS`) antes de autorizar o trabajar.
`scrape-pharmacies` y `submit-event` ya lo hacían.

### 11.6 Pruebas
`supabase/functions/_shared/security_test.ts` — **21 pruebas Deno en verde**, sin red:
sin credenciales, sólo `apikey` anónima, clave errónea, clave de igual longitud pero
distinta, clave correcta bajo el nombre realmente configurado, ausencia de retroceso a
`SYNC_ADMIN_KEY`, usuario normal sin rol, sesión inválida, administrador verificado,
fallo de la comprobación de rol, fallo del backend de auth, servidor sin configurar;
más fecha estricta y las seis reglas de barrido de farmacias.

Frontend: `bunx tsgo --noEmit` limpio, `bunx vitest run` **263 pruebas / 32 ficheros en
verde**, `bunx vite build` correcto. `deno check` limpio en las cinco funciones tocadas
(se corrigió de paso un `scrapeResult` posiblemente nulo en `sync-events`).

### 11.7 Despliegue real
Desplegadas con la herramienta soportada: **`sync-events`, `scrape-events`,
`discover-sources`, `scrape-pharmacies`, `submit-event`**. Comprobación anónima
posterior contra el runtime desplegado (sin efectos secundarios, sin scraping de pago,
sin envíos de eventos reales):

| Función | `POST` anónimo | `GET` |
|---------|----------------|-------|
| `sync-events` | 401 `Missing credentials` | 405 |
| `scrape-events` | 401 `Missing credentials` | 405 |
| `discover-sources` | 401 `Missing credentials` | 405 |
| `scrape-pharmacies` | 401 `Missing credentials` | 401 |

Estas cuatro rutas privilegiadas **están protegidas en el backend desplegado**, no sólo
en el código.

### 11.8 Bloqueos reales que quedan
- Otras funciones privilegiadas siguen leyendo `SYNC_ADMIN_KEY` directamente
  (`scrape-source`, `ingest-dispatcher`, `admin-ingest`, `admin-ingest-dry-run`);
  quedan fuera del alcance autorizado de este pase y no se han desplegado.
- La clasificación deportiva y la deduplicación en origen siguen pendientes (sección 10).
- El frontend **no** se ha publicado: el propietario revisará el resultado integrado.
- El arreglo del lockfile npm y de los scripts (`bunx` → `tsx`) es trabajo paralelo del
  propietario; aquí no se tocaron `package.json`, lockfiles ni `README`.

## 12. Integración del parche de build reproducible (cierre)

Parche recibido (`malaga-reproducible-build.zip`): un único fichero
`malaga-reproducible-build.patch` sobre `README.md`, `package.json` y
`package-lock.json`. Sin credenciales, sin cambios de UI, sin cambios en rangos de
dependencias de producción. Aplicado con `patch -p1` (verificado antes en simulación):
README y lockfile limpios; el segundo hunk de `package.json` con `fuzz 2` porque las
tareas previas habían añadido `drizzle-kit`, `drizzle-orm` y `postgres`.

### 12.1 Adaptación mínima
El lockfile del parche se generó contra el `package.json` de la fase 2 y por tanto no
contenía esas tres dependencias añadidas después. En vez de sobrescribir, se regeneró
con `npm install --package-lock-only --ignore-scripts`, que añadió sólo lo que faltaba
(968 → 1026 entradas). Comprobación programática: los rangos de todas las dependencias
y devDependencies del `package.json` coinciden con la raíz del lock y todas tienen
entrada en el árbol.

Cambios de scripts integrados tal cual:
`test:a11y = vitest run a11y` (cubre `src/test/a11y.test.tsx` y el nuevo
`src/test/a11y-components.test.tsx` con componentes reales),
`generate:sitemap = node --import tsx scripts/generate-sitemap.ts`,
`predev = npm run generate:sitemap`,
`prebuild = npm run generate:sitemap && npm run test:a11y`,
devDependency `tsx ^4.23.13`. README documenta `npm ci` y Node 24.

### 12.2 Compatibilidad con Bun
`bun install` actualizó el lockfile canónico sólo con `tsx@4.23.13`
("Checked 948 installs across 1078 packages (no changes)"): ninguna otra versión
cambió. `bunx tsgo --noEmit` limpio y `bunx vitest run` con **263 pruebas / 32 ficheros**
en verde bajo Bun.

### 12.3 Evidencia final (copia limpia en `/tmp/ciwork`, sin `node_modules` ni `dist`)
Node v22.22.0 / npm 10.9.4 (el propietario validó en Node 24.19 / npm 11.9):
- `npm ci --ignore-scripts --no-audit --no-fund` → **876 paquetes, correcto**
  (antes fallaba por desajuste lock/package.json).
- `npx tsc --noEmit -p tsconfig.app.json` → **sin errores**.
- `npm run build` → **correcto**, incluyendo `prebuild` (sitemap + ambas suites a11y)
  y la generación del service worker PWA (88 entradas precacheadas).
- `npm run test:a11y` → 2 ficheros / 4 pruebas en verde.
- `npm test` → **32 ficheros / 263 pruebas en verde**.

El `public/sitemap.xml` real del repositorio **no** se ha tocado: conserva sus
1817 URLs; el build de verificación se ejecutó en la copia temporal, donde sin
variables de entorno el generador sólo emite las rutas estáticas.

### 12.4 Comprobación visual posterior (390×1400, navegador real)
`/` (Inicio: destacado, "Para ti" con invitación a elegir gustos, "Tengo dos horas",
"Este finde"), `/events?filter=weekend` (el filtro heredado se traduce al canónico),
`/events?family=1&free=1&preset=weekend` (los tres chips se restauran desde el enlace;
el resultado vacío es real, no un fallo) y `/profile`. Sin errores nuevos de consola:
sólo los avisos preexistentes de `react-helmet-async` sobre refs en componentes de
función. Capturas en `/tmp/browser/smoke/`.

### 12.5 Estado consolidado
- **Backend**: `sync-events`, `scrape-events`, `discover-sources`, `scrape-pharmacies`
  y `submit-event` desplegadas y verificadas (401 anónimo, 405 método no soportado).
- **Base de datos**: cabeceras `x-sync-key` de los jobs 1, 2 y 5 actualizadas por el
  propietario vía Vault (sección 11.2). No es una auditoría "sin cambios en BD".
- **Gustos**: se guardan por invitado en el dispositivo y por cuenta en la tabla
  `user_interest_preferences` con acceso exclusivo del propietario del registro.
- **Frontend**: **no publicado**; queda a revisión del propietario.
- Limitaciones abiertas: credencial antigua en otras funciones de ingesta,
  clasificación y deduplicación deportiva en origen, hora UTC de `malaga.eu` y
  adaptador ICS de Unicaja sin migrar.

Commit de referencia previo a esta integración: `7e9ba79`.

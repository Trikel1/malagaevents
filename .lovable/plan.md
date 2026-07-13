
# Málaga Connect — Roadmap de ingesta de eventos (auditoría + plan)

Planificación únicamente. Sin cambios de código, sin escritura en la base, sin activación de fuentes, sin scraping.

---

## 1. Resumen ejecutivo

Málaga Connect ya tiene infraestructura sólida de ingesta segura (registro de fuentes, dry-run, preflight, robots+write confirm, dispatcher), pero **cero fuentes activas** hoy. Hay **73 fuentes candidatas** registradas cubriendo teatros, salas, museos, festivales, agendas municipales y deportes, y **solo 3 adaptadores implementados** (`teatro-cervantes`, `teatro-soho`, `ayto-malaga`). La aplicación muestra 1.430 eventos (156 futuros), procedentes en su mayoría de los adaptadores existentes y de submissions.

La estrategia recomendada es **habilitar fuentes de una en una**, priorizando por valor cultural y fiabilidad de la fuente oficial, con validación manual robots + write cap antes de cada activación. El objetivo a 3 sprints es cubrir el 80% del calendario cultural de Málaga capital, y a 6–8 sprints ampliar a provincia y festivales de temporada.

---

## 2. Auditoría de la arquitectura actual

### Tablas relevantes
- `events` (52 columnas, 1.430 filas): tabla principal, con campos family/outdoor/audience/age ya presentes y funciones de backfill.
- `event_sources` (18 columnas, 73 filas): registro de fuentes con banderas `enabled`, `robots_ok`, `write_confirmed_at`, `write_confirmed_by`, `adapter_key`.
- `event_source_runs` + `sync_runs`: telemetría por ejecución.
- `event_occurrences`: expansión de recurrencias.
- `event_submissions`: entradas manuales de usuarios.
- `raw_event_snapshots`: HTML crudo para debug/reproducibilidad.
- `ingestion_errors`: log de fallos por adaptador.
- `ingestion_write_tokens`: cap de escritura por fuente.
- `venues` (223 filas, 12 ciudades) + `venue_aliases` + `locality_aliases`.

### Estado actual de fuentes
- **Total registradas:** 73
- **Enabled:** 0
- **robots_ok = true:** 0
- **write_confirmed:** 0
- **Adaptadores implementados en código:** `teatro-cervantes`, `teatro-soho`, `ayto-malaga` (más tests).
- **Adaptadores en registro pero sin código:** 70 (todos los demás `adapter_key` visibles como candidatos: `teatro-echegaray`, `teatro-canovas`, `la-termica`, `mva`, `museo-picasso`, `museo-thyssen`, `centre-pompidou`, `fycma`, agendas municipales, festivales, etc.).

### Controles de seguridad existentes
- Doble gate manual: `admin-source-confirm-robots` + `admin-source-confirm-write`.
- Dry-run (`admin-ingest-dry-run`) y preflight (`admin-ingest-preflight`) antes de escribir.
- Toggle explícito (`admin-source-toggle-enabled`) — nada corre por defecto.
- Write cap por token en `ingestion_write_tokens`.
- Snapshots crudos para auditar parsing.
- Sin cron activo para cultural (deportes tiene su ruta separada `trigger-sync-sports`).

### Riesgos identificados
- Muchos `adapter_key` registrados sin implementación → si alguien habilita, el dispatcher falla silenciosamente.
- No hay dashboard de cobertura por municipio/categoría/horizonte temporal.
- Falta política clara sobre redes sociales (Instagram/Facebook) — deben quedar fuera salvo API oficial.

---

## 3. Matriz de cobertura

Formato: **Nombre — Zona — Tipo — URL — Fiabilidad — Dificultad — Riesgo legal — Prioridad — Horizonte — Notas**

### Málaga capital — Teatros y auditorios
- Teatro Cervantes — Málaga — teatro — `teatrocervantes.com` — oficial — media — bajo — **P0** — 30d/temporada — adaptador ya existe, refinar detail-time
- Teatro Echegaray — Málaga — teatro — mismo dominio Cervantes — oficial — baja — bajo — **P0** — 30d/temporada — comparte CMS con Cervantes
- Teatro del Soho CaixaBank — Málaga — teatro — `teatrodelsohocaixabank.com` — oficial — media — bajo — **P0** — 30d — adaptador ya existe, mejorar horas y taquilla
- Teatro Cánovas — Málaga — teatro — `juntadeandalucia.es/cultura/agenda` (Junta) — oficial — alta — bajo — **P0** — 30d — Junta usa agenda unificada
- Auditorio Edgar Neville — Málaga — auditorio — Diputación web — oficial — media — bajo — **P1** — 30d — validar dominio
- Auditorio Eduardo Ocón — Málaga — auditorio exterior — Ayto. Málaga — oficial — media — medio — **P1** — temporada — programación estival
- Auditorio Cortijo de Torres — Málaga — auditorio — Ayto. Málaga — oficial — media — bajo — **P2** — temporada — needs validation
- Cine Albéniz — Málaga — sala — `cinealbeniz.com` — oficial — media — bajo — **P1** — semana — proyecciones + festivales
- Teatro Romano — Málaga — exterior — Ayto./Junta — oficial — alta — medio — **P2** — temporada — programación puntual

### Málaga capital — Espacios culturales y salas de música
- La Térmica — Málaga — espacio — `latermicamalaga.com` — oficial — media — bajo — **P0** — 30d — agenda propia rica
- MVA / Centro Cultural Provincial — Málaga — espacio — Diputación de Málaga — oficial — media — bajo — **P0** — 30d — needs validation URL exacta
- Sala Trinchera — Málaga — sala — `salatrinchera.com` — oficial — media — bajo — **P1** — semana — conciertos indie
- Sala París 15 — Málaga — sala — `paris15.es` — oficial — media — bajo — **P1** — semana — needs validation
- La Cochera Cabaret — Málaga — sala — `lacocheracabaret.com` — oficial — media — bajo — **P1** — semana
- Contenedor Cultural UMA — Málaga — espacio — `contenedorcultural.uma.es` — oficial — media — bajo — **P1** — 30d — universitario
- Ateneo de Málaga — Málaga — espacio — `ateneomalaga.es` — oficial — baja — bajo — **P2** — semana — needs validation
- La Caja Blanca — Málaga — espacio — Ayto. Málaga — oficial — media — bajo — **P2** — semana
- Sala Gades / Falla / Marte / Vivero / Velvet / La Fábrica de Cerveza / La Garrapata — Málaga — sala — mixto — candidato — alta — medio — **P3** — semana — sin agenda estructurada en varios casos, needs validation individual

### Málaga capital — Museos
- Museo Picasso Málaga — Málaga — museo — `museopicassomalaga.org` — oficial — media — bajo — **P0** — temporada — exposiciones y actividades
- Museo Carmen Thyssen — Málaga — museo — `carmenthyssenmalaga.org` — oficial — media — bajo — **P0** — temporada
- Centre Pompidou Málaga — Málaga — museo — `centrepompidou-malaga.eu` — oficial — media — bajo — **P0** — temporada
- Museo de Málaga — Málaga — museo — Junta de Andalucía — oficial — alta — bajo — **P1** — temporada
- CAC Málaga — Málaga — museo — `cacmalaga.eu` — oficial — media — bajo — **P1** — temporada
- Jardín Botánico La Concepción — Málaga — exterior — Ayto. Málaga — oficial — media — bajo — **P2** — temporada

### Málaga capital — Feriales y grandes citas
- FYCMA — Málaga — ferial — `fycma.com` — oficial — media — bajo — **P0** — 30d/temporada — congresos y ferias
- Málaga Forum — Málaga — espacio — needs validation — candidato — media — medio — **P2** — puntual
- Recinto Ferial Cortijo de Torres — Málaga — ferial — Ayto. — oficial — alta — medio — **P2** — temporada — programa Feria de Málaga
- Festival de Málaga (Cine) — Málaga — festival — `festivaldemalaga.com` — oficial — media — bajo — **P1** — temporada — anual marzo
- Fancine — Málaga — festival — UMA — oficial — media — bajo — **P2** — temporada — anual otoño
- Noche en Blanco — Málaga — festival — Ayto. — oficial — media — bajo — **P2** — anual
- Feria de Málaga — Málaga — festival — Ayto. — oficial — alta — medio — **P1** — anual agosto — requiere agenda diaria

### Málaga capital — Agendas institucionales agregadoras
- Agenda Ayto. Málaga (`malaga.eu`) — Málaga — municipal — oficial — alta — bajo — **P0** — 30d — adaptador `ayto-malaga` existe, ampliar cobertura
- Cultura Ayto. Málaga — Málaga — municipal — oficial — media — bajo — **P1** — 30d
- Agenda Junta de Andalucía — Málaga — oficial — alta — bajo — **P1** — 30d — needs validation endpoint
- Fundación Unicaja Cultura — Málaga — espacio — oficial — media — bajo — **P2** — 30d

### Costa del Sol occidental
- Marenostrum Fuengirola — Fuengirola — festival — `marenostrumfuengirola.com` — oficial — media — bajo — **P1** — temporada verano
- Starlite Marbella — Marbella — festival — `starlitecatalanaoccidente.com` — oficial — media — bajo — **P1** — temporada verano
- Palacio de la Paz Fuengirola — Fuengirola — espacio — Ayto. — oficial — media — bajo — **P2** — 30d
- Auditorio Príncipe de Asturias — Torremolinos — auditorio — Ayto. — oficial — media — bajo — **P2** — 30d
- Auditorio Benalmádena — Benalmádena — auditorio — Ayto. — oficial — media — bajo — **P2** — 30d
- Teatro Ciudad de Marbella — Marbella — teatro — Ayto. — oficial — media — bajo — **P2** — 30d
- Marbella Arena / Marbella Congresos — Marbella — auditorio — needs validation — candidato — media — medio — **P3** — temporada
- Auditorio Felipe VI / Congresos Estepona — Estepona — auditorio/ferial — Ayto. — oficial — media — bajo — **P2** — 30d
- Teatro Las Lagunas / Auditorio Mijas — Mijas — teatro — Ayto. — oficial — media — bajo — **P2** — 30d
- Canela Party — Torremolinos — festival — oficial — media — bajo — **P2** — anual
- Los Álamos Beach — Torremolinos — festival — oficial — media — bajo — **P2** — anual

### Axarquía
- Weekend Beach Torre del Mar — Torre del Mar — festival — `weekendbeach.es` — oficial — media — bajo — **P1** — anual verano
- Teatro del Carmen / Lope de Vega — Vélez-Málaga — teatro — Ayto. — oficial — media — bajo — **P2** — 30d
- Centro Cultural Villa de Nerja — Nerja — espacio — Ayto. — oficial — media — bajo — **P2** — 30d
- Festival de Música y Danza de Nerja — Nerja — festival — oficial — media — bajo — **P2** — anual verano
- Teatro Municipal Torrox / recintos Axarquía — mixto — candidato — media — medio — **P3** — 30d

### Interior y Serranía
- Teatro Torcal Antequera — Antequera — teatro — Ayto. — oficial — media — bajo — **P2** — 30d
- Teatro Vicente Espinel — Ronda — teatro — Ayto. — oficial — media — bajo — **P2** — 30d
- Casas de cultura (Alhaurín, Cártama, Coín, Pizarra, Álora, Ardales, Archidona) — Interior — municipal — mixto — candidato — alta — medio — **P3** — 30d — cobertura desigual
- Ferias y romerías municipales — varios — festival — mixto — uncertain — alta — medio — **P3** — temporada

### Ticketing / agregadores
- `malagaentradas.com` — Málaga — ticketing — aggregador — media — medio — **P2** — 30d — validar términos
- Otros agregadores (Fever, Atrapalo, Ticketmaster) — uncertain — legal alto — **NO recomendado** salvo permiso explícito

### Deportes (fuera del alcance cultural)
- Málaga CF, Unicaja Baloncesto, Costa del Sol Balonmano, carreras populares — ya con adaptadores parciales y flujo aislado `sports_events`. **P3** dentro del roadmap cultural (se mantiene en su rama).

### Redes sociales
- Instagram/Facebook/X — **NO usar como fuente directa** salvo API oficial y permiso. Solo enlaces salientes desde `/events/:id`.

---

## 4. Roadmap de prioridad de adaptadores

**P0 (Sprint A→E)** — máximo valor, oficiales, cobertura estable:
Teatro Cervantes, Teatro Echegaray, Teatro del Soho, Teatro Cánovas, La Térmica, MVA/Diputación, Museo Picasso, Museo Carmen Thyssen, Centre Pompidou, FYCMA, Agenda Ayto. Málaga.

**P1 (Sprint F–G)** — salas de música y festivales grandes:
Sala Trinchera, Sala París 15, La Cochera Cabaret, Contenedor Cultural UMA, Cine Albéniz, Marenostrum, Starlite, Weekend Beach, Brisa Festival, Festival de Málaga, Museo de Málaga, CAC.

**P2 (Sprint H)** — agendas municipales de provincia + ferias/romerías + auditorios menores.

**P3 (Sprint I)** — deportes ampliados + salas pequeñas sin agenda estructurada.

---

## 5. Plantilla segura de adaptador

Cada nuevo adaptador debe cumplir:

- **Fetch:** HTTPS, `User-Agent` identificable de Málaga Connect, respeta `robots.txt` verificado manualmente y registrado en `event_sources.robots_ok`.
- **Validación gate:** `enabled=false` hasta pasar dry-run + preflight + write-confirm.
- **Parsing determinista:** solo estructura HTML/JSON estable, sin dependencia de JS ejecutado (usar Firecrawl con `onlyMainContent` cuando aplique).
- **Detail cap opcional:** máximo N páginas de detalle por run (default 20) para no golpear el servidor.
- **Concurrencia:** máx. 2 requests concurrentes por adaptador.
- **Timeout:** 15s por request; abort total del adaptador tras 90s.
- **Zona horaria:** todas las fechas parseadas a `Europe/Madrid`, guardadas en UTC en `start_at`.
- **Dedupe:** clave SHA-256 sobre `normalize_text(title) | normalize_text(venue) | start_at:YYYY-MM-DDTHH:MM` (ya existe `backfill_events_dedupe_keys`).
- **Categoría:** normalizar a set canónico (`music`, `theater`, `kids`, `exhibition`, `festival`, `sports`, `cinema`, `talks`, `dance`, `gastronomy`).
- **Venue:** resolver por `venue_aliases`; si no existe, crear candidato inactivo para revisión.
- **Familia/exterior:** aplicar heurísticas de `backfill_event_family_flags` en la inserción.
- **Ticket link:** conservar URL oficial de compra si existe, marcar `is_free=true` cuando el HTML indique "gratis"/"entrada libre".
- **Imagen:** solo hotlink si el sitio lo permite; si no, dejar `image_url=null` y usar fallback.
- **Warnings/errors:** todo error a `ingestion_errors` con contexto; snapshot HTML a `raw_event_snapshots`.

---

## 6. Flujo admin (por fuente, siempre manual)

1. **Alta candidata** en `event_sources` con `enabled=false`, `robots_ok=false`.
2. **Validación manual** de robots.txt y ToS → botón "Confirmar robots" → `robots_ok=true`.
3. **Dry-run** contra URL → devuelve N eventos parseados, 0 escritos.
4. **Preview** en admin UI con muestra de 20 eventos.
5. **Preflight** compara con existentes, muestra dedupe y colisiones.
6. **Autorización explícita** → botón "Confirmar escritura" con cap N eventos → `write_confirmed_at=now()`.
7. **Escritura limitada** al cap, con token en `ingestion_write_tokens`.
8. **Revisión** de resultados en admin (nuevos, actualizados, rechazados).
9. **Enable** para runs recurrentes → `enabled=true` (cron manual, sin autoschedule inicial).
10. **Monitoring:** panel de `event_source_runs` con éxito/fallo y drift.
11. **Rollback:** botón "Deshabilitar y purgar últimos N" desde admin.

---

## 7. Fases e implementación

### Sprint A — Cervantes / Echegaray quality completion
- **Archivos permitidos:** `supabase/functions/_shared/adapters/teatro-cervantes.ts` + test, `supabase/functions/_shared/ingestion/normalize.ts`, migraciones para venue aliases si faltan.
- **Prohibido:** cron, `enabled=true`, tocar `events` directamente.
- **DB impact:** ninguno salvo alias de venue.
- **Riesgos:** cambio de CMS del teatro → mitigado con snapshot.
- **QA:** dry-run 30 días, comparar contra web oficial, comprobar `Europe/Madrid`, families flags.
- **Acceptance:** ≥95% eventos de la web actual detectados, 0 duplicados vs. `events` existentes.
- **Crédito estimado:** 6–10.

### Sprint B — Teatro del Soho detail-time enrichment
- **Permitido:** `teatro-soho.ts` + test.
- **QA:** parsing correcto de multi-sesión (18:00 y 21:30), tickets URL preservada.
- **Acceptance:** horas exactas por función, sin colapsar 2 pases en 1 evento.
- **Crédito:** 4–7.

### Sprint C — Teatro Cánovas (Junta)
- **Permitido:** nuevo adaptador + tests.
- **Riesgos:** agenda Junta unificada → separar por venue.
- **Acceptance:** filtro por venue devuelve solo Cánovas.
- **Crédito:** 8–12.

### Sprint D — La Térmica + MVA
- **Permitido:** 2 adaptadores + tests + posibles alias.
- **Acceptance:** ≥90% eventos actuales, categoría normalizada.
- **Crédito:** 10–14.

### Sprint E — Museos (Picasso, Thyssen, Pompidou, Museo de Málaga, CAC)
- **Permitido:** hasta 5 adaptadores; posibles como un único adaptador con perfiles por venue.
- **Acceptance:** exposiciones de largo recorrido tratadas como recurrencias (start/end), no eventos duplicados diarios.
- **Crédito:** 14–20.

### Sprint F — Salas de música (Trinchera, París 15, Cochera, Contenedor UMA, Albéniz)
- **Acceptance:** conciertos con hora y precio, dedupe entre agregadores.
- **Crédito:** 12–18.

### Sprint G — Festivales (Marenostrum, Starlite, Weekend Beach, Brisa, Festival de Málaga, Fancine)
- **Riesgos:** cartel se publica en bloque, requiere expandir line-up a eventos individuales solo si cada acto tiene hora.
- **Acceptance:** festival como evento contenedor + subeventos si aplican.
- **Crédito:** 12–20.

### Sprint H — Agendas municipales de provincia + FYCMA + ferias
- **Permitido:** adaptadores por Ayto., posiblemente uno genérico basado en CMS común.
- **Riesgos:** calidad muy variable; empezar por Marbella, Fuengirola, Torremolinos, Antequera, Vélez, Nerja, Ronda.
- **Crédito:** 20–30 repartidos.

### Sprint I — Deportes ampliados
- Vive fuera del pipeline cultural (`sports_events`). Mantener aislamiento estricto.
- **Crédito:** 8–12.

---

## 8. Coverage dashboard (propuesta)

Panel admin y bloque público resumido:

- **Cobertura por fuente:** total fuentes, enabled, robots_ok, write_confirmed, last_run_status, last_run_at, events_ingested_7d/30d.
- **Cobertura por municipio:** nº de eventos futuros por municipio, mapa de calor Málaga capital vs. provincia.
- **Cobertura por categoría:** teatros, música, museos, familia, festival, deportes.
- **Horizonte temporal:** eventos hoy / próximos 7 días / 30 días / 90 días / temporada completa.
- **Health signals:** fuentes con 0 eventos en 7 días, errores recientes, drift en parsing.
- **Público resumido en `/`:** "X recintos activos en Y municipios · Z eventos próximos".

---

## 9. UX recomendada en `/events`

- **Chips temporales:** Hoy · Esta semana · Este finde · Próximos 30 días · Próximos meses · Temporada.
- **Chips temáticos:** Familia · Gratis · Al aire libre · Con entradas · Festivales · Ferias/romerías.
- **Filtro Municipio:** Málaga capital primero, luego zonas plegables (Costa occidental, Axarquía, Interior).
- **Filtro Venue:** dropdown ya rediseñado, buscador + agrupación por zona.
- **Filtro Categoría:** teatro, música, museo, cine, familia, danza, gastronomía, deportes.
- **Mapa:** vista mapa con clusters por municipio.
- **Vista temporada:** timeline horizontal con festivales/ferias del año.
- **Estado vacío honesto:** cuando una zona no tiene fuentes activas, mostrar "Cobertura en preparación" con contador de fuentes candidatas — no ocultar la ausencia.

---

`No code changed. No events written. No sources activated.`

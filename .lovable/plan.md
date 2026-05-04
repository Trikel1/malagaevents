
# Sprint Deportes — UI premium + ingestión exhaustiva

Plan quirúrgico, sin tocar `App.tsx`, providers, auth, rutas, farmacias, eventos culturales, mapa general ni edge functions ajenas a deportes. No habrá migraciones de schema (los campos ya existen).

## A. Sistema visual deportivo (UI)

### A1. `src/components/sports/SportIcon.tsx` — mapping premium estático
Se amplía el mapping con clases Tailwind explícitas (no dinámicas) y una entrada `label` opcional. Se cubren todos los deportes que devuelve `mapSportCategory` y los alias usados en datos reales:

```ts
SPORT_VISUAL_MAP = {
  futbol:       { Icon: CircleDot,  ring: 'ring-emerald-500/20' },
  baloncesto:   { Icon: Dribbble,   ring: 'ring-orange-500/20' },
  futsal:       { Icon: CircleDot,  ring: 'ring-emerald-500/20' },
  balonmano:    { Icon: Hand,       ring: 'ring-blue-500/20' },
  atletismo:    { Icon: Footprints, ring: 'ring-amber-500/20' },
  running:      { Icon: Footprints, ring: 'ring-amber-500/20' },
  ciclismo:     { Icon: Bike,       ring: 'ring-sky-500/20' },
  natacion:     { Icon: Waves,      ring: 'ring-cyan-500/20' },
  tenis:        { Icon: Trophy,     ring: 'ring-lime-500/20' },
  padel:        { Icon: Trophy,     ring: 'ring-lime-500/20' },
  voleibol:     { Icon: Volleyball, ring: 'ring-violet-500/20' },
  rugby:        { Icon: Shield,     ring: 'ring-rose-500/20' },
  motor:        { Icon: Car,        ring: 'ring-zinc-500/20' },
  triatlon:     { Icon: Medal,      ring: 'ring-fuchsia-500/20' },
  senderismo:   { Icon: Mountain,   ring: 'ring-stone-500/20' },
  fitness:      { Icon: Dumbbell,   ring: 'ring-rose-500/20' },
  acuaticos:    { Icon: Waves,      ring: 'ring-cyan-500/20' },
  artes_marciales: { Icon: Swords,  ring: 'ring-red-500/20' },
  otros:        { Icon: Award,      ring: 'ring-primary/20' },
}
```

Color base se mantiene en `text-primary` / `bg-primary/10` (consistencia con tema verde deportivo en dark mode). Los `ring-*` se usan solo como halo opcional cuando `badge` y `accent` están activos. Sin emojis.

### A2. Cards (`SportEventCard.tsx`)
- Limpieza de títulos vía helper local `cleanSportTitle(title)`:
  - elimina `"(HOME)"`, `"(AWAY)"`, `"(LOCAL)"`, `"(VISITANTE)"`, paréntesis huérfanos.
  - colapsa espacios.
  - si todo está en MAYÚSCULAS y >12 chars y no hay marca conocida (Málaga CF, Unicaja, ACB, LaLiga), aplica `toLocaleLowerCase` + capitalización por palabras conservando siglas.
  - mantiene `event.title` original sin mutar (solo se usa el limpio para render).
- Badges añadidos: precio (gratis si `price_info` matches `/gratis|free|libre/i`), estado (`Entradas`, `Inscripción`, `Próximo`).
- CTAs contextuales:
  - `tickets_url` → "Entradas"
  - sino, si url contiene `inscrip|register` → "Inscribirme" (heurística sobre `tickets_url`)
  - sino → "Ver actividad" (link a `source_url` si existe)
  - botón secundario "Cómo llegar" cuando hay `venue` o `address` → abre Google/Apple Maps con query.
- Header visual con `SportIcon` premium + `ring` del mapping.

### A3. Home Deportes (`SportsContent.tsx`)
Estructura final (mantiene handlers actuales):
1. Hero (ya existe en `Index.tsx`) — solo se ajustan copys i18n.
2. Quick actions: Hoy / Este finde / Próximos 14d / Recintos.
3. **Explorar deportes** — chips con `SportIcon` premium. Lista ampliada visualmente con: Todos, Fútbol, Baloncesto, Fútbol sala, Atletismo, Running, Triatlón, Ciclismo, Natación, Pádel/Tenis, Otros (sin romper `SPORT_CATEGORIES` actual; los chips extra solo aplican filtro `categories` via `mapSportCategory`).
4. **Hoy en deporte** (existe).
5. **Próximos 14 días** (existe como "Resultados filtrados", se renombra y prioriza).
6. **Recintos destacados** — nueva sección compacta usando `useSportsVenues` (top 6 con eventos próximos), con CTA "Ver recintos" → `/venues`. Empty state institucional si no hay datos: "Estamos incorporando recintos deportivos."
7. **Explorar por municipio** — nueva sección. Usa lista estática de municipios de Málaga. Cada chip llama a un nuevo estado `selectedMunicipality` que se traduce en `venueNames` filtrando los venues de `useSportsVenues()` por `city === municipio` (no requiere cambios de schema ni hook). Si no hay venues en ese municipio, se muestra empty state (sin inventar datos).
8. **Para organizadores** — card CTA "¿Organizas actividades deportivas? Publica tu evento" → `navigate('/submit-event')` (ruta ya existente). Sin nuevas rutas.

### A4. `VenuesPage.tsx`
- Filtros adicionales por municipio (chips secundarios derivados de `venues.map(v => v.city)`).
- Cards muestran "próximos eventos" via cuenta rápida usando `useSportsEvents({ venueNames: [v.name], fromDate: today, toDate: +30d })` solo para los visibles (con `enabled` / debounce ligero) — opcional, si añade complejidad se aplaza y se deja conteo solo para los 6 destacados de la home.

### A5. Filtros deportivos (`SportsEventsPage.tsx`)
- Añadir chip "Gratis" (filtra cliente-side por `price_info`).
- Añadir chip "Con entradas" (filtra por `tickets_url != null`).
- Sin cambios destructivos en el hook.

## B. i18n

Añadir keys nuevas en **es, en, ar** (resto: el fallback i18next caerá a la key + default literal del `t('...', 'fallback')`):

```
sports.heroKicker, sports.heroTitle, sports.heroSubtitle, sports.searchPlaceholder
sports.exploreBySport, sports.todayInSport, sports.upcomingEvents
sports.venuesTitle, sports.exploreByMunicipality
sports.organizers.title, sports.organizers.subtitle, sports.organizers.cta
sports.cta.tickets, sports.cta.register, sports.cta.directions, sports.cta.view
sports.empty.today, sports.empty.results, sports.empty.venuesSoon
sports.filter.free, sports.filter.withTickets
sports.running, sports.ciclismo, sports.natacion, sports.padel, sports.triatlon,
sports.senderismo, sports.fitness, sports.voleibol, sports.rugby, sports.acuaticos,
sports.artes_marciales
```

## C. Ingestión exhaustiva (`supabase/functions/sync-sports/index.ts`)

Se mantienen las 22 fuentes activas (`sports_sources`) y la pipeline Jina+AI con fallback Firecrawl. Mejoras quirúrgicas:

### C1. Paginación / multi-URL por fuente
Nuevo `SOURCE_EXTRA_URLS: Record<string, string[]>` para fuentes conocidas con paginación o calendario por mes:
- `runedia`: añadir `?page=2`, `?page=3` (3 páginas).
- `sportmaniacs`: `?page=2`, `?page=3`.
- `fam-atletismo`, `atletismo-malaga`, `triatlon-malaga`: añadir URL `?mes=` para los próximos 3 meses (calculados con `Europe/Madrid`).
- `imd-malaga`, `diputacion-deportes`, `koobin-deportes`: añadir `?page=2`.
- `acb-unicaja`, `laliga-malaga`, `besoccer-malaga`: añadir vista de "siguiente jornada" cuando aplica.

Se itera por `[source.url, ...extras]`, agregando `rawEvents` con dedupe por `dedupe_key`. Cada URL respeta el dominio de `ALLOWED_DOMAINS` (validado con `isDomainAllowed`). Errores por URL se aíslan (no tumban la fuente).

### C2. Robustez por fuente
- Si una URL falla, se registra en `sports_sync_runs` y continúa con la siguiente (ya implementado a nivel fuente; se replica a nivel URL).
- `last_error` por fuente conserva último mensaje cuando todas las URLs fallan.
- Rate-limit: delay 1.5s entre URLs y 2.5s entre fuentes (subido desde 1.5s).

### C3. Clasificación deportiva mejorada
`mapSportCategory` se amplía con heurística sobre **título** + **competición** + **venue** (no solo `sport`):
```
running|carrera|maratón|10k|trail → atletismo
triatl|ironman                    → atletismo (subcategoría triatlon en label si schema lo permite — solo si ya hay campo; si no, se mantiene atletismo)
ciclismo|vuelta|btt               → otros (mapeo conservador, sin nuevo enum)
padel|pádel                       → tenis
balonmano                         → balonmano
voleibol|vóley                    → otros
natación|waterpolo                → otros
```
Sin migración de schema: se respeta el enum implícito actual (`sport_category` es text). Las claves nuevas como `running`, `triatlon`, `ciclismo` se mapean a las existentes para no romper filtros. Los chips visuales muestran sub-tipos vía `competition` o keywords del título.

### C4. Limpieza de títulos en ingestión
Antes de calcular `normalized_title` se aplica `cleanSportTitle` (mismo helper compartido lógicamente, duplicado en el edge function al no poder importar de `src/`):
- elimina `(HOME)`, `(AWAY)`, `(LOCAL)`, `(VISITANTE)`, `· LaLiga` duplicado en título cuando ya está en `competition`.
- conserva `title` original tal cual; el limpio se guarda en `title` del row final (consistente con render). `normalized_title` se computa sobre el limpio.

### C5. Municipios
`isInMalagaProvince` (ya cubre 100+ municipios) se mantiene. Se añade utilidad `inferMunicipality(address, venue, city)` que devuelve el municipio canónico encontrado en `MALAGA_PROVINCE_MUNICIPALITIES`; este valor sobreescribe `city` si la `city` original viene vacía o como "Málaga" pero `address`/`venue` apuntan a otro municipio (p. ej. Marbella). Sin inventar datos: si no hay match claro, se conserva el `city` extraído.

### C6. Logs y trazabilidad
- Por URL: `[sync-sports] {slug} url={u} fetched={n} kept={k}`.
- `sports_sync_runs` recibe un row por fuente (agregado), como hoy. No se añaden tablas.

### C7. Cumplimiento
- `ALLOWED_DOMAINS` es la única vía de scraping (sin nuevas fuentes).
- No se tocan robots.txt, no hay bypass.
- Search-discovery (Firecrawl Search) se mantiene tras el batch como hoy.

## D. Archivos tocados

- `src/components/sports/SportIcon.tsx` — ampliación mapping + ring.
- `src/components/sports/SportEventCard.tsx` — clean title, badges, CTAs, "Cómo llegar".
- `src/components/sports/SportsContent.tsx` — secciones recintos destacados, municipios, organizadores.
- `src/components/sports/SportsEventsPage.tsx` — chips Gratis / Con entradas.
- `src/pages/VenuesPage.tsx` — chips por municipio.
- `src/pages/Index.tsx` — copys i18n hero deportes (mínimo).
- `src/i18n/locales/{es,en,ar}.json` — keys nuevas.
- `supabase/functions/sync-sports/index.ts` — `SOURCE_EXTRA_URLS`, loop multi-URL, `cleanSportTitle`, `inferMunicipality`, `mapSportCategory` ampliado.

## E. No-regresión / verificación

- `appMode === 'eventos'` intacto: home cultural sin cambios.
- Hooks (`useSportsEvents`, `useSportsVenues`) sin cambios de firma.
- Sin migraciones SQL.
- Build TS limpio (Lucide icons importados existen todos).
- Mobile: chips con `overflow-x-auto scrollbar-hide` ya en uso.
- Dark mode: solo clases `text-primary`/`bg-primary/*` y `border-border`.
- i18n: cada `t()` con fallback literal para que el resto de idiomas no rompa.
- Edge function: dedupe sigue funcionando (UNIQUE en `dedupe_key`); URLs adicionales respetan `ALLOWED_DOMAINS`.

## F. Fuera de alcance (declarado)

- No se crea panel admin nuevo.
- No se introducen nuevas fuentes externas.
- No se cambia el enum/text de `sport_category` en DB.
- No se añade nueva tabla ni columnas.
- No se toca `auth`, `App.tsx`, providers, farmacias, tickets, mapa general, eventos culturales.

# Sprint de calidad 1 — UI sin mezclas de idioma

## Objetivo
Asegurar que las 14 rutas públicas se muestran íntegramente traducidas en los 10 idiomas (es, en, de, fr, it, pt, ar, ja, zh, ru), corrigiendo los literales españoles observados en la preview inglesa y normalizando pluralización, fechas y taxonomías deportivas.

## Auditoría rápida (literales detectados)

| Ruta | Componente | Literal actual |
|---|---|---|
| /events | `LocationFilter` | "Toda la provincia" |
| /events | `EventsPage` chips fecha | "Hoy", "Mañana", "Este finde", "30 días" |
| /events | `VenueKindFilter` | "Salas", "Teatros", "Recintos" |
| /events | `UpcomingHighlights` / control audio | "Reanudar" / "Pausar" |
| /sports | `SportsHero` / `SportsContent` | Título+subtítulo ES, "Ver próximos eventos" |
| /sports, /venues | Chips categoría | valores crudos `football`, `tennis`, `triathlon`, `basketball`, `running` |
| /calendar | `CalendarPage` | Cabecera semana `D L M X J V S`, "N eventos" sin plural |
| /map | `MapPage` / `LeafletMap` | "N puntos" |
| /pharmacies | `PharmaciesPage` | "OFICIAL", "Mostrando X de Y", aviso directorio en ES |
| /profile | `ProfilePage` | "Invitado" |
| Cards evento | `EventImage` placeholder | "IMAGEN ILUSTRATIVA" |
| /agenda/:slug | `MunicipalityAgendaPage` | Multiples strings ES (empty states, "Cerca de", radio, "Fuente"…) |

## Ficheros a modificar

### Traducciones (10 JSON — mismas claves)
`src/i18n/locales/{es,en,de,fr,it,pt,ar,ja,zh,ru}.json`
Añadir/asegurar:
- `events.filters.allProvince`
- `events.filters.today|tomorrow|weekend|next30d`
- `events.venueKind.{halls,theaters,venues}`
- `events.count` con plurales i18next (`_one`, `_other`, y para ar/ru/ja/zh las formas requeridas o `_other` como default).
- `events.imagePlaceholder` → "Illustrative image" / "Imagen ilustrativa" / …
- `map.pointsCount` con plural
- `map.resume`, `map.pause` (o `common.pause/resume`)
- `pharmacies.official`, `pharmacies.showingOfTotal` (interpolado `{{shown}}/{{total}}`), `pharmacies.directoryNotice`
- `profile.guest`
- `sports.hero.title|subtitle`, `sports.viewUpcoming`
- `sports.categories.{football,basketball,tennis,triathlon,running,…}` (clave central)
- `calendar.weekdaysShort` (array de 7)
- `agenda.*` para MunicipalityAgendaPage

### Componentes / páginas
- `src/components/events/LocationFilter.tsx` — usar `t('events.filters.allProvince')`.
- `src/components/events/VenueKindFilter.tsx` — traducir 3 labels.
- `src/pages/EventsPage.tsx` — chips fecha con `t()`.
- `src/components/events/UpcomingHighlights.tsx` — botón resume/pause y contador plural.
- `src/components/events/EventImage.tsx` — placeholder “IMAGEN ILUSTRATIVA”.
- `src/components/sports/SportsHero.tsx`, `SportsContent.tsx`, `SportsEventsPage.tsx`, `SportsPage.tsx` — títulos y CTA.
- `src/components/sports/SportIcon` alrededores + `VenuesPage.tsx` — usar helper `getSportLabel(t, sport)` centralizado en `src/lib/sports.ts`. Reemplazar `t(\`sports.${cat}\`, cat)` (fallback crudo) por helper con clave `sports.categories.<cat>` y garantía de existencia.
- `src/pages/CalendarPage.tsx` — usar `date-fns` `format(..., 'EEEEEE', { locale })` para weekdays; contador con `t('events.count', { count })`.
- `src/pages/MapPage.tsx` (y `LeafletMap` si aplica) — “N puntos” → `t('map.pointsCount', { count })`.
- `src/pages/PharmaciesPage.tsx` — "OFICIAL", "Mostrando X de Y", aviso.
- `src/pages/ProfilePage.tsx` — “Invitado”.
- `src/pages/MunicipalityAgendaPage.tsx` — traducir todos los literales ES.

### Helpers
- `src/lib/sports.ts` — nueva función `getSportLabel(t, sport)` que resuelva `sports.categories.<sport>`.
- Confirmar que `getDateLocale` se usa en todos los `format()` (auditar EventsPage, GroupedEventsList, CalendarPage, MunicipalityAgendaPage) — ya centralizado; eliminar mapas duplicados si aparecen.

### Tests nuevos (`src/test/i18n-sprint-quality1.test.tsx`)
- Paridad de claves y ausencia de vacíos (delegar a test existente `i18n-locales-parity`; añadir smoke).
- Render en `en` de EventsPage/SportsPage/CalendarPage/MapPage/PharmaciesPage/ProfilePage y aserción de que **ninguno** de los literales ES enumerados aparece en el DOM.
- Pluralización: `t('events.count', { count: 0|1|2 })` en es/en/ru/ar.
- Fechas: `format(new Date('2026-01-05'), 'EEEE', { locale: getDateLocale(lang) })` para es/en/de/ar/ru.
- `html[lang]` y `html[dir]` correctos tras `i18n.changeLanguage('ar')`.
- Taxonomía deportiva: `getSportLabel(t, 'football')` distinto de `'football'` en los 10 idiomas.

## Verificación
- `bunx vitest run`
- `bun run build`
- Revisión manual EN de /events /sports /calendar /map /pharmacies /venues /profile.
- Revisión DE en una ruta y AR (RTL) en otra.

## Fuera de alcance / permanece en su idioma
- Títulos de eventos, nombres de recintos, municipios, direcciones y descripciones provenientes de scrapers/BBDD.
- Contenido oficial farmacéutico devuelto por la fuente.
- Textos administrativos internos (`/admin`).

## Entrega
Lista final de archivos modificados, claves añadidas por sección, salida de vitest y `bun run build`, y nota de textos que se dejan en idioma original por ser datos externos.
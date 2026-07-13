
# Plan — Simplificar UX de /events (recintos, salas y teatros)

## 1. Diagnóstico: por qué el diseño actual se siente peor

El `VenueGroupDropdown` actual, aunque técnicamente sólido, introduce fricción para el público general:

- **Un solo trigger opaco.** El usuario ya no ve "Salas" o "Teatros" directamente — todo está escondido detrás de un botón "Salas, teatros y recintos" que hay que abrir sí o sí. Antes se filtraba con un clic; ahora requiere 3 (abrir → chip → aplicar).
- **Sobrecarga cognitiva al abrir.** Dentro conviven: buscador, 9 chips de categoría, headers sticky con iconos `MapPin`, contador (`· 34`), subtítulo explicativo, checkboxes, estados "sin agenda aún", footer con dos botones. Es una herramienta de admin, no un filtro de agenda.
- **Iconos + descripción en cada fila.** Cada venue muestra checkbox + nombre + ciudad + estado. Para una abuela buscando "algo en el Cervantes", es ruido.
- **Recintos sin eventos mezclados** con los activos (aunque atenuados) sugieren que la app promete cosas que no cumple.
- **Patrón "draft + Aplicar"** es correcto para multi-select potente, pero rompe la expectativa de "toco chip → veo resultados" que tenía la versión anterior.
- **Presentación institucional.** Para el Ayuntamiento la app debe leerse como una agenda ciudadana clara, no como un panel de curación.

## 2. Recomendación UX final

Adoptar la propuesta del usuario con matices de diseñador senior. Dos capas:

### Capa 1 — Chips directos (95% de los usuarios se quedan aquí)

Una fila horizontal, scrollable en móvil, sin iconos ni subtítulos:

```text
[ Todos ] [ Salas ] [ Teatros y auditorios ] [ Museos ] [ Festivales ]  · Ver todos los recintos
```

- Un clic aplica el filtro inmediato (sin "Mostrar").
- Solo un chip activo a la vez (radio, no multi).
- `Ver todos los recintos` es un enlace textual discreto a la derecha, no un botón principal.
- El chip activo tiene fondo primario; los inactivos, outline suave. Sin badges numéricos.

### Capa 2 — Sheet "Ver todos los recintos" (usuarios que buscan un recinto concreto)

Bottom sheet en móvil, popover centrado en desktop. Minimalista:

```text
┌───────────────────────────────────┐
│ Recintos                        × │
│ ┌───────────────────────────────┐ │
│ │ 🔍  Buscar recinto o ciudad  │ │
│ └───────────────────────────────┘ │
│ [ Todos ] [ Salas ] [ Teatros ]   │
│ [ Museos ]                        │
│                                   │
│ MÁLAGA CAPITAL                    │
│  Teatro Cervantes                 │
│  Teatro Cánovas                   │
│  La Térmica                       │
│  ...                              │
│                                   │
│ PROVINCIA                         │
│  Auditorio Felipe VI · Estepona   │
│  ...                              │
│                                   │
│  Ver catálogo completo (32 más)   │
└───────────────────────────────────┘
```

Reglas:
- **Solo dos secciones por defecto:** "Málaga capital" y "Provincia". No agrupamos por tipo dentro del sheet salvo que el chip lo pida.
- **Selección directa:** tocar una fila filtra al instante y cierra el sheet. Adiós al patrón draft/Aplicar.
- **Single-select** por defecto (más simple, coincide con la mentalidad "quiero ver el Cervantes"). El multi-select queda para una v2 si el Ayto lo pide.
- **Recintos sin eventos ocultos.** Solo aparecen tras pulsar "Ver catálogo completo (N más)". Ahí se muestran atenuados y no clicables, con un tooltip "Aún sin agenda publicada".
- **Localidad seleccionada.** Si el filtro de localidad en `/events` está activo, esa localidad se muestra como primera sección ("BENALMÁDENA") por encima de "Málaga capital". Sin lógica de prioridad rara ni orden alfabético invertido.
- **Sin iconos por fila.** Nombre + ciudad en gris pequeño debajo cuando la ciudad no es obvia por la sección. Nada más.
- **Buscador tolerante a acentos** (ya funciona) — mantener.

### Reglas transversales

- Los chips de la Capa 1 y los de dentro del sheet **comparten estado**: si eliges "Teatros" en el sheet y cierras, el chip "Teatros y auditorios" queda activo arriba.
- Al elegir un venue concreto, los chips de tipo se desactivan y aparece un pill removible arriba: `Teatro Cervantes ×`.
- La copia se reduce: título del sheet solo "Recintos". Sin subtítulo. Sin "sin agenda aún" salvo en el catálogo completo.

## 3. Fases de implementación (cuando se apruebe)

**Fase 1 — Chips directos en la barra de filtros**
- Nuevo componente ligero `VenueKindChips` (radio de 5 opciones).
- Reemplaza al `VenueGroupDropdown` como filtro principal en `EventsPage`.
- Mapea a los `kind` existentes en `venuesCatalog`/`venueFilters` (ya tenemos `kindToCategory`).

**Fase 2 — Sheet simplificado "Ver todos los recintos"**
- Reescribir `VenueGroupDropdown` como `VenuePickerSheet` (single-select, sin draft, sin footer).
- Reutiliza `mergeVenues` y `filterMerged` de `venueFilters.ts` (no se toca la lógica de fusión).
- Sección "Ver catálogo completo" colapsable al final.

**Fase 3 — Integración con estado de EventsPage**
- Unificar `selectedKind` (chip) y `selectedVenueId` (sheet) en el filtro de eventos.
- Pill removible cuando hay venue específico.
- Sincronizar con `priorityCity` que ya se pasa hoy.

**Fase 4 — Pulido y copy**
- Traducciones (10 idiomas) para las 6-8 strings nuevas.
- Revisar espacios, alturas, overflow horizontal en 360px.

## 4. Archivos que habría que tocar (frontend-only)

- `src/components/events/VenueGroupDropdown.tsx` — se sustituye o se reduce drásticamente.
- `src/components/events/` — nuevo `VenueKindChips.tsx` y `VenuePickerSheet.tsx`.
- `src/pages/EventsPage.tsx` — reemplazo del filtro y estado.
- `src/lib/venueFilters.ts` — mantener; posible reducción de `VENUE_CATEGORIES` a las 5 del nuevo diseño.
- `src/i18n/locales/*.json` — nuevas claves de copy.

## 5. Qué NO se debe tocar

- Backend, edge functions, adapters, ingesta, Firecrawl.
- Base de datos: `venues`, `events`, `event_sources`, RLS, grants.
- Routing, auth, cron, `supabase/config.toml`.
- `venuesCatalog.ts` (catálogo estático; se sigue usando tal cual).
- Lógica de horarios y `eventTime.ts`.
- Sports mode.

## 6. QA mínimo (Playwright + manual)

- 360px y 1280px: sin overflow horizontal, chips scrollables si no caben.
- Tocar "Teatros y auditorios" filtra al instante sin abrir nada.
- Abrir sheet, buscar "Térmica" → aparece en primer resultado; tocar cierra sheet y aplica.
- Buscar "Estepona" → aparecen recintos de Estepona bajo su sección.
- Seleccionar localidad Estepona en el filtro superior → sección Estepona aparece primera en el sheet.
- "Ver catálogo completo" muestra recintos sin agenda atenuados y no clicables.
- Pill `Teatro Cervantes ×` removible restaura el chip activo previo.
- Dark mode: contraste correcto en chips activos/inactivos.
- 10 idiomas: no truncan chips en móvil.
- Safety check final: `events` count sin cambios, `enabled=0`, `robots_ok=0`, `write_confirmed_at=0`.

## Notas de diseño

- La versión anterior gustaba porque **mostraba las opciones, no las escondía**. Recuperamos ese principio: los tipos más comunes están a la vista; solo el catálogo largo se esconde.
- Regla de oro para el Ayto: el usuario debe poder filtrar por "teatros en Málaga" sin abrir un solo menú.

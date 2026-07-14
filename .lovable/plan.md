# Sprint UI 2 — Sistema adaptativo de desplegables

## 1. Primitivas nuevas (en `src/components/ui/adaptive/`)

Cuatro componentes reutilizables que resuelven en un solo lugar el comportamiento responsive (bottom sheet en móvil, popover en escritorio), la altura máxima, el retorno de foco, ARIA y estados vacíos/error/carga.

### `AdaptivePopover` (base interna)
Wrapper compartido que decide, según un breakpoint (`useIsMobile`, `< 768px`):
- **Móvil**: renderiza `Sheet` inferior (side=bottom) con `max-h-[85dvh]`, `pb-[env(safe-area-inset-bottom)]`, drag handle, cabecera sticky, footer sticky.
- **Escritorio**: renderiza `Popover` anclado, `w-[min(420px,calc(100vw-24px))]`, `collisionPadding`, `avoidCollisions`.
- Devuelve foco al trigger al cerrar (comportamiento nativo Radix).
- `Escape`, clic exterior, botón cerrar en cabecera.
- Nunca se abre fuera del viewport, respeta el dock inferior mediante `collisionPadding` y `sideOffset`.

### `SimpleSelect<T>`
- Trigger de 44 px de altura mínima con label + valor + chevron.
- Lista de opciones planas, filas ≥ 44 px, `role="option"`, `aria-selected`.
- Ideal para idioma, tema, orden.
- Selección inmediata, cierra al elegir.

### `SearchableSelect<T>`
- Como SimpleSelect + input de búsqueda visible al abrir (autofocus en escritorio, sin autofocus en móvil para evitar teclado).
- Grupos con cabecera sticky.
- Estados: `loading`, `empty`, `error` con mensaje traducible.
- Selección única, cierra al elegir.

### `MultiSelect<T>`
- Selección en borrador local (no aplica hasta pulsar "Aplicar").
- Chips o filas con checkbox de 20 × 20.
- Contador de seleccionados en el trigger (`Recintos · 3`).
- Footer sticky con `Limpiar` (secundario, deshabilitado si vacío) y `Aplicar` (primario, siempre visible).
- Escape descarta el borrador.

### `FilterSheet`
- Composición explícita para filtros complejos (FilterDrawer, ficha de farmacias):
  - `FilterSheet.Header` — título, subtítulo, botón cerrar.
  - `FilterSheet.ActiveSummary` — chips de filtros activos con botón "Quitar".
  - `FilterSheet.Body` — scroll único.
  - `FilterSheet.Footer` — `Limpiar todo` + `Aplicar (N)` sticky.

## 2. Migración

| Archivo | Primitiva |
|---|---|
| `src/components/common/LanguageSelector.tsx` | `SimpleSelect` con `collisionPadding` para no chocar con el dock inferior |
| `src/components/common/ThemeToggle.tsx` | `SimpleSelect` en variante icon-only |
| `src/components/events/LocationFilter.tsx` | `SearchableSelect` (municipios) |
| `src/components/events/VenueFilter.tsx` | `SearchableSelect` (recintos) |
| `src/components/events/VenueGroupDropdown.tsx` | `MultiSelect` con grupos |
| `src/components/events/VenueKindFilter.tsx` | `MultiSelect` |
| `src/components/sports/SportsVenuesDropdown.tsx` | `MultiSelect` (arregla el desplegable que salía fuera de pantalla) |
| `src/components/events/FilterDrawer.tsx` | `FilterSheet` |
| `src/pages/CalendarPage.tsx` (selector mes/año) | `SimpleSelect` × 2 en popover conjunto |
| `src/pages/PharmaciesPage.tsx` (selector municipio) | `SearchableSelect` |
| Selects públicos de formularios (`SubmitEventPage`, `AddTicketPage`) | `SimpleSelect` |

## 3. Correcciones específicas

- **Desplegable deportivo fuera de pantalla**: eliminado al usar `AdaptivePopover` con `collisionPadding={16}` y bottom sheet en móvil.
- **Selector de idioma tapado por el dock**: `collisionPadding={{ bottom: 96 }}` y en móvil bottom sheet propio (no cae bajo el dock).
- **Trigger que muestra "Málaga" con "Toda la provincia" seleccionada**: normalizar el `getDisplayLabel` en `LocationFilter` para que el trigger derive siempre del `value` real, con etiqueta única "Toda la provincia" cuando `value === null | 'all'`.
- **Controles de 32–40 px**: todas las primitivas fuerzan `min-h-[44px]` en trigger y filas.

## 4. Detalles técnicos

- `AdaptivePopover` reutiliza `Sheet` y `Popover` (ya opacos tras Sprint UI 1). No introduce nueva dependencia.
- Breakpoint móvil: `useIsMobile()` existente (`< 768px`).
- `sideOffset={8}` y `collisionPadding={{ top: 72, bottom: 96, left: 12, right: 12 }}` por defecto para respetar TopNav y BottomNav.
- Anuncio ARIA: `role="listbox"`/`role="dialog"` según variante, `aria-multiselectable`, `aria-expanded`, `aria-controls` en el trigger.
- Retorno de foco: gestionado por Radix; para el bottom sheet, `onCloseAutoFocus` reenvía al trigger.
- Solo un `overflow-y-auto` interno por primitiva (evita scroll anidado).

## 5. Tests nuevos (`src/test/adaptive-*.test.tsx`)

- `adaptive-simple-select.test.tsx` — apertura/cierre teclado, Escape, selección con Enter, foco vuelve al trigger.
- `adaptive-searchable-select.test.tsx` — filtrado por texto, estado vacío, selección por teclado.
- `adaptive-multiselect.test.tsx` — borrador, Aplicar, Limpiar, contador, Escape descarta.
- `adaptive-responsive.test.tsx` — mock de `useIsMobile` para verificar que en móvil se abre Sheet y en escritorio Popover.
- `location-filter-label.test.tsx` — regresión del bug "Málaga / Toda la provincia".

## 6. Fuera de alcance

- No se toca lógica de datos, hooks, Supabase, rutas ni traducciones existentes (solo se leen claves ya presentes).
- No se rediseña el contenido de los filtros, solo su contenedor y comportamiento.
- Si algún filtro depende de un patrón muy específico (draft-selection ya implementado), se preserva su API pública.

## 7. Verificación final

- Comprobación manual en 375, 768, 1024, 1280 px.
- Ningún control interactivo < 44 × 44.
- Nunca fuera de viewport ni bajo el dock.
- Tests, `tsgo --noEmit` y build limpios.
- Informe final con archivos modificados y correcciones aplicadas.

¿Apruebas el plan para implementar?

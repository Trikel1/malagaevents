## Pulido visual — Inicio + Eventos

Objetivo: elevar la calidad visual a nivel institucional (Ayuntamiento de Málaga) sin rediseñar. Solo micro-ajustes de espaciado, jerarquía, tipografía, contraste y consistencia. Cero cambios de datos, hooks, rutas o textos funcionales.

### Auditoría (hallazgos concretos)

**Inicio (`src/pages/Index.tsx`)**
1. Densidad heterogénea: `space-y-8` alterna con paneles de padding muy distintos (`p-3`, `p-5`, `p-6`, `p-8`) — rompe el ritmo vertical.
2. Iconos con clase inválida `h-4.5 w-4.5` (Tailwind no la resuelve — se cae al tamaño por defecto). Aparece en Discover, Culture e Institutional.
3. Header hero: `-mt-9` sobre `pb-14` deja el panel de Quick Actions con un solape correcto, pero el `pt-5` superior queda apretado en escritorio; falta un `max-w` central en desktop (todo el contenido a 100% del ancho hasta 1280px se ve poco institucional).
4. "Cultura viva": tarjetas puramente decorativas sin acción — visualmente huecas.
5. Stats de cobertura: números en `text-base sm:text-lg` — poco jerárquicos frente al peso del bloque.
6. Section titles inconsistentes: unos con `px-1`, otros dentro de `glass-panel` — micro-desalineación en el eje izquierdo.
7. Botones "Ver todo" con `text-primary` sin subrayado hover — pierden affordance en modo claro.

**Eventos (`src/pages/EventsPage.tsx` + subcomponentes)**
1. Header `glass-nav` sticky: buena base, pero la fila búsqueda+location+near-me+filtros se apiña en móvil <360px (5 elementos en línea).
2. `LocationFilter` sin `showLabel` no señala visualmente que es un filtro geográfico — solo icono; hay ambigüedad con "Cerca de mí".
3. Preset chips (`Hoy / Mañana / Finde / 30 días`): altura 8 (32px) — por debajo del target táctil de 44px recomendado. `min-h-[36px]` como en el hero mejoraría.
4. Chips activos (fila de filtros aplicados) con `text-[11px]` muy pequeños; el botón "Limpiar" queda al final de la fila sin peso visual.
5. `EventCard` (grid denso): gap `mb-0.5` y `text-[11px]` para meta — legibilidad justa. Buena en móvil, pero en tablet/desktop se ve infantil por no escalar.
6. `GroupedEventsList` sticky header usa `--events-header-h` que **no está definido** en ningún sitio → sticky day-labels se pegan a `top: 0` sin offset y quedan tapadas por el `glass-nav`. Bug visual real.
7. `UpcomingHighlights` marquee: bien, pero el botón Pausar/Reanudar y el contador quedan en la misma línea sin separación consistente en móvil pequeño.
8. `EmptyState` de error no diferenciado del vacío estándar (variant existe pero puede afinarse solo con tokens actuales).
9. Sin `max-w` central en desktop → el listado se estira demasiado en ≥1200px.

**Compartido / Navegación**
- `BottomNav`: fuera de scope salvo variable CSS `--events-header-h` (afecta a Eventos), que se puede definir localmente en `EventsPage`. No se toca BottomNav.

### Cambios propuestos (mínimos, reversibles)

**`src/pages/Index.tsx`**
- Corregir `h-4.5 w-4.5` → `h-5 w-5` (3 ocurrencias) [bug].
- Añadir wrapper `max-w-6xl mx-auto` al `<main>` para acotar en desktop.
- Homogeneizar padding de secciones panel: usar `p-5 sm:p-6` de forma consistente (quitar el `p-3` del Quick Actions → `p-4 sm:p-5`).
- Unificar títulos de sección: quitar `px-1` cuando la sección no está dentro de un panel (o añadirlo siempre). Elegir: siempre sin `px-1`, con `main` ya con padding.
- Botón "Ver todo": añadir `hover:underline underline-offset-4`.
- Stats: subir a `text-lg sm:text-xl` el número y `font-semibold` en la label.
- Hero: añadir `max-w-6xl mx-auto` al contenido interior del header (título + búsqueda) para centrar en desktop sin tocar el fondo.

**`src/pages/EventsPage.tsx`**
- Definir `--events-header-h` en el header (`style={{ ['--events-header-h' as any]: '...' }}`) o mediante `ref` + `useLayoutEffect` mínimo para exponerlo al body — **preferido: valor fijo aproximado** `calc(env(safe-area-inset-top,0px) + 148px)` en móvil, con media query. Sin JS nuevo. Alternativa: aplicar la variable en el `<main>` de esta página únicamente.
- `max-w-6xl mx-auto` en `<main>` del listado.
- Preset chips: subir a `h-9` (36px) y `text-sm`.
- Chips activos: `text-[12px]` y separar "Limpiar" con `ml-auto`.
- Fila búsqueda en móvil pequeño: envolver LocationFilter + near-me + filtros en un grupo con `flex-shrink-0` y garantizar que `form` tenga `min-w-0` (ya existe) — verificar. Reducir a `gap-1.5` en `<380px`.
- `EventCard` denso: escalar meta a `text-xs sm:text-[13px]` para tablet/desktop; título a `text-sm sm:text-[15px]`.
- `UpcomingHighlights`: en móvil <380px poner el contador debajo del botón (wrap natural con `flex-wrap`).

**Sin cambios** (conservar):
- Toda la lógica de filtros, presets, geolocalización, favoritos, orden por cercanía.
- Sistema `glass-*`, tokens de color, gradientes.
- Estructura y orden de secciones en Inicio.
- SEO, JSON-LD, i18n keys, rutas, hooks, Supabase.
- Componentes de subcategoría (FilterDrawer, VenueKindFilter, LocationFilter internos).
- Nada de Calendar, Map, Sports, Pharmacies, Profile, Admin.

### Archivos a modificar

1. `src/pages/Index.tsx` — micro-ajustes de clases Tailwind.
2. `src/pages/EventsPage.tsx` — micro-ajustes de header, sticky offset, max-width.
3. `src/components/events/EventCard.tsx` — solo variante `dense`: escalado tipográfico responsive.
4. `src/components/events/GroupedEventsList.tsx` — valor por defecto para `--events-header-h` inline (fallback si no se define).
5. `src/components/events/UpcomingHighlights.tsx` — `flex-wrap` en la fila de encabezado.

### Verificación

- Tras editar: revisión visual con Playwright a 375px, 768px y 1280px de `/` y `/events`.
- Comprobar contraste de chips y botones "Ver todo" en claro y oscuro.
- Confirmar que los sticky day-labels de `GroupedEventsList` no quedan tapados por el header.
- `bunx vitest run` para asegurar que no rompemos pruebas.
- Sin cambios de dependencias ni de esquema.

Reversión: cada cambio es una clase Tailwind aislada — revert trivial fichero a fichero.

# Plan: Refinamiento premium e institucional de MalagaEvents

Objetivo: corregir el solapamiento del hero, rediseñar quick actions y categorías y elevar la calidad visual sin tocar lógica, rutas, providers, hooks, datos, auth ni Supabase. Solo presentación, layout, tokens y copy.

## 1. Home — `src/pages/Index.tsx`

- Hero: cambiar `pb-16` → `pb-8`. Eliminar margen negativo del `<main>` (`-mt-6` → `mt-5`). Usar `space-y-7` para ritmo limpio.
- Top bar reorganizada:
  - Izquierda: segmented Eventos/Deportes (mismo handler).
  - Derecha cluster: chip decorativo `Málaga` (no nuevo route, oculto en `<375px` con `hidden xs:inline-flex`) + `ThemeToggle` + `LanguageSelector`.
- Hero editorial: kicker `t('home.kicker', 'Agenda de la ciudad')`, título `text-[26px] sm:text-3xl leading-[1.12]`, subtítulo más legible.
- Search: `h-12 rounded-2xl shadow-soft focus-visible:ring-2 ring-primary`, placeholder `Buscar eventos, lugares…`. `id` + `<label sr-only>` para accesibilidad.
- Quick actions: contenedor `rounded-2xl border border-border/60 bg-card shadow-card p-3` con 4 columnas; cada item con círculo `h-11 w-11 bg-primary/10`, label `text-xs font-medium leading-tight` (2 líneas máx), `active:scale-[0.97] hover:bg-muted/60`. Mantener intactas las 4 acciones y sus `navigate(...)`.
- Contenedor de categorías: `flex gap-2 overflow-x-auto pb-2 px-0.5 -mx-0.5 scrollbar-hide` para evitar chips cortados.

## 2. CategoryChip — `src/components/events/CategoryChip.tsx`

- Reescribir como `<button>` con clases Tailwind estáticas por categoría (mapping literal, sin interpolación). Tinted surfaces: `bg-{c}-50/90 text-{c}-800 border-{c}-200/70` + dark variants.
- Punto de color `h-1.5 w-1.5 rounded-full` antes del label.
- Estado seleccionado: `bg-primary/10 text-primary border-primary/30 ring-1 ring-primary/40` (sin `ring-offset-2`).
- Sizes: default `h-9 px-4 text-sm`, sm `h-8 px-3.5 text-xs`. `font-semibold`. `focus-visible:ring-2 ring-primary`. `active:scale-[0.97]`.
- Mismo prop API y traducciones.

## 3. EventCard — `src/components/events/EventCard.tsx`

- `dense`: badge fecha `rounded-xl shadow-soft`, día `text-xs`, mes `text-[9px]`. Línea inferior con `·` mejor espaciado.
- Variante normal: `transition-all hover:border-primary/20`. Si hay `is_free`, badge `text-[10px]` en esquina; ya hay categoría — quitar competencia visual reduciéndola a `text-[10px]`.
- API y handlers de favoritos sin cambios.

## 4. EventDetailPage — `src/pages/EventDetailPage.tsx`

- No tocar CTA sticky ni handlers.
- Sustituir bloque "Quick Info" por grid 2×2 con etiquetas (`Fecha`, `Hora`, `Lugar`, `Precio`) — cada item `text-[10px] uppercase tracking-wide text-muted-foreground` para label y `text-sm font-semibold` para valor. Mantener iconografía actual.
- Botones secundarios `Ver en mapa` / `Guardar plan` con estilo `outline` y separación `gap-2`.
- Título `text-2xl sm:text-3xl font-bold tracking-tight`.

## 5. EventsPage — `src/pages/EventsPage.tsx`

- Header sticky: añadir `shadow-soft` (ya está) y micro-pulido espaciado.
- Cuando `totalActiveFilters > 0`, mostrar fila de chips de filtros activos (categorías + buscador + ubicaciones) con `bg-primary/10 text-primary border border-primary/20` y botón Limpiar discreto (ya existe). No tocar lógica.
- Empty state ya cálido en español; mantener.
- Mantener grid 2 columnas dense actual (es la pauta de proyecto, ver memoria layout-and-ux).

## 6. TicketsPage — `src/pages/TicketsPage.tsx`

- Header con tipografía `text-xl font-bold tracking-tight`.
- Si hay tickets: pequeño heading `text-xs uppercase tracking-wide text-muted-foreground mb-2` ("Tus entradas"). No introducir secciones nuevas que requieran lógica.
- Empty state copy: "Aún no tienes tickets" / "Guarda eventos o añade tus entradas para organizar tus próximos planes." (vía claves i18n con fallback en `t(...)`).
- Cards `rounded-2xl shadow-soft hover:shadow-card transition-shadow`.

## 7. ProfilePage — `src/pages/ProfilePage.tsx`

- Hero header: `pb-12 → pb-10`, `rounded-b-3xl` ya está. Cambiar tipografía a `text-2xl font-bold tracking-tight`.
- Cards con `rounded-2xl shadow-soft` y agrupación clara: Apariencia, Idioma, Cuenta (menú actual). Sin cambios a items ni `signOut`.

## 8. Tokens — `src/index.css` y `tailwind.config.ts`

- `shadow-soft`, `shadow-card`, `gradient-hero` ya existen. No reemplazar.
- Sin nuevas dependencias.

## Garantías de no-regresión

- Sin cambios en App.tsx, providers, contexts, hooks, queries, mutaciones, tipos, rutas, edge functions, `client.ts`, `types.ts`, lógica de favoritos/tickets/mapa/auth/admin/modo deportes/dark mode.
- APIs públicas de `EventCard` y `CategoryChip` intactas.

## Archivos a editar

- `src/pages/Index.tsx`
- `src/components/events/CategoryChip.tsx`
- `src/components/events/EventCard.tsx`
- `src/pages/EventDetailPage.tsx`
- `src/pages/EventsPage.tsx`
- `src/pages/TicketsPage.tsx`
- `src/pages/ProfilePage.tsx`

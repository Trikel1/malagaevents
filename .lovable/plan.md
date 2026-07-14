
# Sprint visual 1 — Identidad "Editorial mediterránea" (v2)

Alcance estrictamente visual y de layout. No se tocan hooks, datos, Supabase, farmacias, mapas, auth, rutas ni traducciones (no se crean claves nuevas). Sin nuevas dependencias.

## 1. Sistema de diseño (`src/index.css`, `tailwind.config.ts`)

**Tokens semánticos completos** — se reescriben los valores en `:root` y `.dark`, manteniendo **todas** las variables que shadcn/ui espera (nada se elimina; sólo se reajustan los valores HSL):

Claro:
- `--background` #FAF7F0 · `--foreground` #172033
- `--card` #FFFFFF · `--card-foreground` #172033
- `--popover` #FFFFFF · `--popover-foreground` #172033
- `--primary` #075985 · `--primary-foreground` #FFFFFF
- `--secondary` #C2410C · `--secondary-foreground` #FFFFFF
- `--accent` #B45309 · `--accent-foreground` #FFFFFF
- `--muted` #F1ECE2 · `--muted-foreground` #5B6472
- `--destructive` (se conserva, ajustado ligeramente) · `--destructive-foreground` #FFFFFF
- `--border` #DED7CA · `--input` #DED7CA · `--ring` = primary
- `--surface`, `--surface-elevated`, sombras y `--sidebar-*` recalibrados sobre la nueva paleta (mismos nombres, sin borrar).

Oscuro (equivalente accesible AA):
- `--background` #0E1726 · `--foreground` #F8F4EA
- `--card` #162235 · `--card-foreground` #F8F4EA
- `--popover` #162235 · `--popover-foreground` #F8F4EA
- `--primary` #38BDF8 · `--primary-foreground` #0E1726
- `--secondary` #FB923C · `--secondary-foreground` #0E1726
- `--accent` (variante cálida coherente) · `--accent-foreground` correspondiente
- `--muted` #253247 · `--muted-foreground` #AEB8C7
- `--destructive` / `--destructive-foreground` conservados y contrastados
- `--border` #334155 · `--input` #334155 · `--ring` = primary
- `--sidebar-*` completos, coherentes con el nuevo esquema.

**Modo Deportes** conserva su override (verde) sobre la nueva base.

**Sombras y superficies:**
- `--shadow-soft`/`--shadow-card` más planas (editorial, no SaaS).
- `--shadow-lift` sutil, teñida de secondary (terracota).
- `--gradient-hero` = azul profundo → turquesa con glow terracota sutil superpuesto por `radial-gradient`.

**Glass reducido:** las utilidades glass se conservan (usadas por dropdowns/modales/inputs y nav), pero en portada las **superficies de contenido** pasan a `bg-card` opaco con `border` + `shadow-card`. No se borran clases existentes para no romper otras vistas fuera de alcance.

**Tipografía:**
- `index.html`: añadir Google Fonts `Newsreader` (400/500/600) y `Public Sans` (400/500/600/700) con `preconnect` y `font-display: swap`; sustituyen a Inter en el `<head>`.
- `tailwind.config.ts`: `fontFamily.sans = ['Public Sans', system-ui, …]`; añadir `fontFamily.serif = ['Newsreader', 'ui-serif', 'Georgia', …]` y alias `display`.
- `body { font-size: 16px }` mínimo móvil. Fallbacks del sistema conservados para no latinos.

**Motion:** `--liquid-motion-fast` 160ms, `--liquid-motion-normal` 220ms. Animación `liquid-page-enter` reducida (opacity + `translateY(4px)`, 200ms). Solo `transform` y `opacity`. Regla global `@media (prefers-reduced-motion: reduce)` que anula transiciones/animaciones nuevas.

## 2. Navegación (`MainLayout.tsx`, `BottomNav.tsx`, `TopNav.tsx` nuevo)

**`MainLayout` — responsabilidad limitada:**
- Sólo gestiona: fondo global, `TopNav` (lg+), `BottomNav` (móvil), safe-area inferior y `scroll-padding-bottom`.
- **NO** aplica `max-w` al `<Outlet />`. Cada página controla su propio ancho. Mapas y otras páginas quedan intactos.
- `TopNav` es global pero se comporta como una barra sticky superior fina; no altera anchos ni altura útil del contenido debajo (usa `sticky top-0`, no `fixed`, para no requerir compensaciones en páginas de mapa). En páginas fullscreen tipo mapa el layout sigue funcionando exactamente igual.

**`BottomNav` (móvil, `< lg`):**
- Icono Lucide + etiqueta de texto en cada uno de los 5 destinos (`t(...)` ya existentes en `navItems`).
- `min-h-[44px] min-w-[44px]` por objetivo; padding vertical suficiente.
- Se elimina la navegación por arrastre: la burbuja sigue animando entre índices al cambiar de ruta, pero pointer-drag ya no cambia `hoverIndex` a otro destino. Sólo tap/click/Enter/Space navegan.
- Safe-area inferior respetada (ya presente, se refuerza).

**`TopNav` (escritorio, `≥ lg`):**
- Nuevo componente global en `src/components/layout/TopNav.tsx`, sticky, superficie glass sutil.
- Wordmark "Málaga" (invariable) + descriptor usando la clave existente `home.hero.subtitle` u otra clave `t(...)` ya presente para "Agenda ciudadana" — sin crear claves nuevas.
- Enlaces horizontales a los 5 destinos con icono + label vía `t(...)` existentes; estado activo con subrayado `primary`, `aria-current="page"`.
- Selector de idioma y ThemeToggle **solo aquí** en `≥ lg` (nunca simultáneamente con HeroHeader).
- Navegable por teclado, focus-visible con `ring-2 ring-ring`.

**Visibilidad exclusiva:**
- `TopNav`: `hidden lg:flex`.
- Selectores de idioma/tema dentro de `HeroHeader`: `lg:hidden`.
- `BottomNav`: `lg:hidden`.
- Nunca aparecen duplicados.

## 3. Portada (`src/pages/Index.tsx` + nuevos en `src/components/home/`)

**Contenedor:** el `max-w-[1180px] mx-auto px-4 lg:px-8` se aplica **sólo** dentro de `Index.tsx` en cada sección de contenido y en el bloque interno del hero. `MainLayout` no lo aplica.

**Hero full-width:**
- `HeroHeader.tsx`: sección `w-full` con gradiente mediterráneo (azul profundo → turquesa + radial terracota) ocupando **todo el ancho de pantalla**. Dentro, un contenedor `max-w-[1180px] mx-auto px-4 lg:px-8` centra el contenido (título "Málaga" wordmark + subtítulo vía `t('home.hero.subtitle')`, selector Eventos/Deportes, buscador principal, y en móvil idioma+tema).
- Título usa la clave existente `home.hero.title` cuando aplica y wordmark "Málaga" tratado como marca gráfica invariable.
- Buscador con `bg-card` opaco, `border`, texto legible en ambos temas, placeholder desde `t(...)` existente.

**Nuevos componentes en `src/components/home/`** (sólo presentación, sin lógica de datos nueva, sin textos hardcodeados en español — todo vía `t(...)` existentes):
- `HeroHeader.tsx`
- `QuickActionsGrid.tsx` — 6 acciones actuales en `grid-cols-3 gap-3` (móvil, 3×2) y `lg:grid-cols-6` (fila única). Iconos Lucide 20–22px + label vía `t(...)`. Compacto, foco visible, borde sutil, `min-h-[76px]`, tap ≥ 44px.
- `EventRail.tsx` — Carril horizontal en móvil (`overflow-x-auto`, `scroll-snap-type: x mandatory`, tarjetas `w-[78vw] max-w-[320px]` con `scroll-snap-align: start`, siguiente tarjeta parcialmente visible). En `lg+` cambia a `grid grid-cols-3 gap-6`. **Un único** botón "Ver todos" al final del carril (móvil) o al final del grid (escritorio); no se duplica.
- `InstitutionalStrip.tsx` — bloque institucional final, compacto, `text-muted-foreground`.

**`Index.tsx` — se conservan TODAS las secciones existentes:**
- Familia
- Ahora en Málaga
- Qué puedes encontrar
- Este fin de semana
- Málaga ciudad y provincia
- Cultura
- Deportes
- Bloque institucional

Todas mantienen sus enlaces y textos actuales (vía `t(...)`). Se compactan y reorganizan visualmente pero **ninguna desaparece**. "Ahora en Málaga" y "Este fin de semana" reciben mayor protagonismo (posición temprana, títulos serif, tarjetas más ricas); el bloque institucional queda al final y más compacto.

## 4. `EventCard.tsx` — nueva variante `home` explícita

- Añadir prop opcional `variant?: 'default' | 'dense' | 'compact' | 'home'`. Si no se pasa, comportamiento actual **intacto**.
- Sólo cuando `variant === 'home'`:
  - Superficie `bg-card` opaca, `border-border`, `shadow-card`; sin glass.
  - Título con `line-clamp-2` (2 líneas permitidas, sin truncar a 1).
  - Fecha/hora, recinto y badge "Gratis" (cuando aplique) legibles en ambos temas.
  - Imagen `aspect-video` 16:9.
- `dense`, `compact` y la variante por defecto usada en listados **no se modifican**.
- Sólo `EventRail` (portada) pasa `variant="home"`.

## 5. Accesibilidad y verificación

- Contraste WCAG AA verificado en cada par foreground/background (claro y oscuro).
- Todos los interactivos ≥ 44×44 px.
- `aria-current`, `aria-label` en icon-only, focus-visible con `ring-2 ring-ring`.
- Sin scroll horizontal en 375, 390, 768, 1024, 1280, 1440.
- Navegación completa por teclado; sin dependencia de gestos.
- `prefers-reduced-motion` respetado globalmente.
- `bunx vitest run` y build limpio.

## Fuera de alcance
Supabase, hooks/fuentes de datos, farmacias, mapas, auth, rutas, admin, otras páginas, traducciones globales (no se crean claves nuevas), migraciones.

## Archivos que se tocarán
- `src/index.css`
- `tailwind.config.ts`
- `index.html`
- `src/components/layout/MainLayout.tsx`
- `src/components/layout/BottomNav.tsx`
- `src/components/layout/TopNav.tsx` (nuevo)
- `src/pages/Index.tsx`
- `src/components/home/HeroHeader.tsx` (nuevo)
- `src/components/home/QuickActionsGrid.tsx` (nuevo)
- `src/components/home/EventRail.tsx` (nuevo)
- `src/components/home/InstitutionalStrip.tsx` (nuevo)
- `src/components/events/EventCard.tsx` (sólo variante `home` añadida)

## Reporte final
Al terminar informaré de archivos modificados, salida de tests/build, y verificación visual en las 6 anchuras.

# Refinamiento visual premium MalagaEvents

Cambios quirúrgicos, aditivos y sin tocar lógica.

## Archivos a editar

1. **`src/index.css`** — añadir tokens nuevos (`--surface`, `--surface-elevated`, `--shadow-soft/card/lift`, `--gradient-warm/hero/hero-sports/sunset`) en `:root` y en `.dark`. Aplicar `font-family: Inter` al `body`. Override de `--shadow-lift` para `[data-mode="deportes"]`. No se elimina ningún token existente.

2. **`tailwind.config.ts`** — extender `theme.extend` (aditivo): `boxShadow.{soft,card,lift}` ligados a tokens, `backgroundImage.{gradient-warm,gradient-hero,gradient-hero-sports,gradient-sunset}`, `fontFamily.sans` con Inter, animaciones `fade-in` y `lift`.

3. **`index.html`** — añadir `<link>` preconnect + Inter de Google Fonts en `<head>`. Sin scripts ni cambios funcionales.

4. **`src/components/layout/BottomNav.tsx`** — solo estética: `bg-card/85 backdrop-blur-xl`, pill activo (`bg-primary/10`), tap-target 44px. Mantiene todos los items y rutas.

5. **`src/components/events/EventCard.tsx`** — refinamiento de variantes `dense` y normal: badge fecha flotante sobre imagen, sombras suaves, hover lift. Contrato de props intacto.

6. **`src/pages/Index.tsx`** — hero editorial (“¿Qué hacemos hoy en Málaga?”), chips rápidos refinados con scroll horizontal, mejor jerarquía de secciones. Mantiene `useEvents`, modo deportes, `quickActions`, navegación a `/events?filter=...` y `/pharmacies`.

7. **`src/pages/EventsPage.tsx`** — solo estilos del header (sticky con sombra suave), spacing y tipografía. Sin tocar `useEventsOptimized`, `FilterDrawer`, `VenueGroupDropdown`, `LocationFilter`, ni handlers.

8. **`src/pages/EventDetailPage.tsx`** — hero con overlay editorial, info cards más limpias, sticky bottom CTA reutilizando handlers existentes (`window.open(event.ticket_url)`, `handleToggleFavorite`). Sin nuevos estados ni cambios de datos.

9. **`src/pages/ProfilePage.tsx`** — header con `bg-gradient-hero`, secciones más pulidas. `menuItems`, `signOut`, `useIsAdmin` y rutas intactos.

10. **`src/pages/TicketsPage.tsx`** — header sticky con sombra suave, cards más limpias, vacío más cálido. Mutaciones (`useDeleteTicket`, `useTickets`) intactas.

## Garantías

- Cero cambios en `App.tsx`, providers, contexts, hooks, supabase client/types, `MainLayout`, edge functions, módulos `src/modules/maps/*`, i18n, types.
- Cero rutas eliminadas o renombradas.
- Cero contratos de props alterados.
- Compatibilidad total con dark mode (todos los tokens nuevos tienen contraparte) y `data-mode="deportes"` (override de gradiente y sombra).
- Ninguna dependencia nueva (Inter por `<link>`).
- Las query strings de chips solo usan filtros ya soportados (`?filter=today|weekend|nearby`, `?category=…`, `?q=…`).

¿Procedo a aplicar?

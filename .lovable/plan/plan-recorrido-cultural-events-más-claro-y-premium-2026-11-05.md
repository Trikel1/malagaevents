# Plan: recorrido cultural /events más claro y premium

## 1. Diagnóstico (verificado en código)

- `/events` (`src/pages/EventsPage.tsx`, 706 líneas) ya usa la URL como fuente única de filtros (`eventsUrlState.ts`, con pruebas), búsqueda con debounce de 300 ms, conteo cargado vs total, estados de error y reintento separados de "sin favoritos". La base funcional es sólida; el problema es de **jerarquía y presentación**, no de lógica.
- Cabecera de filtros fragmentada en cuatro piezas que se solapan: `VenueKindFilter` (743 líneas), `LocationFilter` (286), `VenueGroupDropdown`/`VenueFilter` y `FilterDrawer` (507). El usuario ve varios selectores parecidos sin un resumen único de "qué estoy filtrando".
- `EventCard.tsx` (231) e `EventImage.tsx` (541) ya tienen fallback editorial con etiqueta «Imagen ilustrativa», hora "por confirmar" y precio solo acreditado. Pero la Home usa su propio sistema (`components/home/HomeEventCard.tsx`, `HomeEventImage.tsx`, `HomeEditorial.module.css`): dos lenguajes visuales distintos entre Home y /events.
- Tokens Liquid Glass ya existen en `src/index.css` (`--glass-*`); se reutilizan, no se crean nuevos.
- `EventsPage` importa `date-fns/locale/es` directamente: las fechas de la cabecera no siguen el idioma activo (afecta EN/DE/AR).
- Ficha (`EventDetailPage.tsx`): entradas, favorito, calendario y bloque práctico ya existen; volver a la lista depende del historial, sin garantía de restaurar el scroll ni los filtros si se entra por enlace directo.
- Sin verificar en este turno: aspecto actual a 360–1440 px, claro/oscuro y RTL; se capturará en la etapa 0.

## 2. Experiencia objetivo

Primer pantallazo (móvil 390 px, sin desplazarse):
1. Cabecera editorial corta: título "Agenda" + contexto vivo ("Esta semana · Málaga · 124 eventos").
2. Una sola barra de búsqueda grande (vidrio, 48 px) con botón "Filtros" que muestra el número de filtros activos.
3. Fila de atajos de fecha deslizable: Hoy · Mañana · Este finde · 7 días · Elegir fecha.
4. Fila de "filtros activos" como chips removibles (municipio, recinto, categoría, gratis) + "Limpiar todo".
5. Primera tarjeta visible con imagen 16:9, categoría, título a 2 líneas, fecha/hora, lugar y municipio, precio o "Gratis" solo si está acreditado.

Recorrido demostrable: buscar "flamenco" → elegir "Este finde" → filtrar Marbella → abrir evento → guardar favorito / compartir / ver entradas → "Volver a la agenda" y aparecer en la misma tarjeta con los mismos filtros.

Hoja de filtros única (vidrio, abajo en móvil, lateral en escritorio): Fecha, Municipio, Recinto (agrupado), Categoría, Precio (gratis/de pago/cualquiera), con recuento previo "Mostrar 37 eventos" y "Limpiar". Reutiliza el patrón borrador + "Mostrar"/"Limpiar" ya aprobado.

Cero resultados: explica qué filtros lo causan y ofrece quitar el último o ampliar a "Próximos 30 días" (ya implementado; se mejora presentación).

Escritorio (1280/1440): rejilla de 3–4 columnas, filtros en panel lateral fijo, misma URL.

## 3. Etapas (valor visible al final de cada una)

- **Etapa 0 – Línea base** (sin cambios): capturas actuales en 6 anchos × claro/oscuro × ES/AR. Valor: referencia para comparar.
- **Etapa 1 – Cabecera y búsqueda**: barra única de búsqueda + botón Filtros con contador, atajos de fecha, chips de filtros activos, contexto vivo, fechas en el idioma activo. Valor: el primer pantallazo cambia de forma evidente.
- **Etapa 2 – Tarjeta unificada**: `EventCard` adopta tipografía, ritmo e imagen del sistema Home Editorial (sin vidrio en tarjetas), estado (agotado/cancelado/aplazado solo si viene del origen), precio acreditado, objetivo táctil completo. Valor: Home y Agenda se sienten la misma app.
- **Etapa 3 – Hoja de filtros única**: consolidar municipio, recinto, categoría y precio en `FilterDrawer` con recuento previo; los selectores sueltos dejan de estar en la cabecera (se reutilizan dentro). Valor: un solo sitio para filtrar, siempre claro qué está activo.
- **Etapa 4 – Ficha y vuelta**: botón "Volver a la agenda" que conserva la URL de filtros y restaura scroll; compartir nativo con alternativa "copiar enlace"; acciones (entradas, favorito, calendario) ordenadas y sin duplicar. Valor: abrir y volver no pierde el contexto.
- **Etapa 5 – Estados y validación**: carga con esqueletos del mismo tamaño que la tarjeta, vacío, error con reintento, sin conexión; pasada completa de accesibilidad, RTL y capturas finales.

Cada etapa termina con typecheck, pruebas y capturas Playwright.

## 4. Archivos

Tocaría (solo presentación):
- `src/pages/EventsPage.tsx`, `EventsPage.module.css`
- `src/components/events/EventCard.tsx`, `FilterDrawer.tsx`, `GroupedEventsList.tsx`, `CategoryChip.tsx`
- Nuevos pequeños: `EventsSearchBar.tsx`, `ActiveFilterChips.tsx`, `DateQuickPresets.tsx`
- `src/pages/EventDetailPage.tsx` (solo barra de acciones y volver)
- `src/components/common/EmptyState.tsx`, `LoadingSkeleton.tsx` (variante de tarjeta)
- `src/i18n/locales/*.json` (claves nuevas en los 10 idiomas)
- Pruebas: ampliar `eventsUrlState.test.ts` (persistencia y precio) y prueba de chips activos.

Reutilizaría sin cambiar lógica: `eventsUrlState.ts` (solo se añade el parámetro de precio si no existe), `VenueKindFilter`, `LocationFilter`, `VenueGroupDropdown` (embebidos en la hoja), `EventImage.tsx`, tokens de `index.css`, `HomeEditorial.module.css` como referencia.

Intactos: navegación global y `HomeModeSwitch`/selector Eventos/Deportes, Home, calendario, mapa, farmacias, todo `components/sports`, hooks de datos (`useEventsOptimized`, `useFavorites`), `supabase/`, auth, RLS, recomendaciones, rutas.

## 5. Riesgos y dependencias de datos

- Precio: muchos eventos no tienen precio fiable; el filtro "de pago" solo puede usar eventos con precio acreditado y "cualquiera" debe incluir los desconocidos. Se mostrará "Precio no publicado", nunca un valor.
- Estado (agotado/cancelado): solo si el origen lo publica; muchas fuentes no lo hacen.
- Datos desactualizados: la última sincronización cultural registrada era del 2026-09-07; si sigue así, la agenda puede verse corta. No es un problema de interfaz y no se resolverá aquí; se mostrará el recuento real.
- Hora: muchos eventos sin hora → "Hora por confirmar".
- Imágenes: parte de los carteles son ilustrativos; se mantiene la etiqueta.
- Recuento previo en la hoja de filtros: si requiere una consulta extra, se usará el conteo ya devuelto por `useEventsOptimized` tras aplicar, para no tocar el backend.
- `VenueKindFilter` es grande; embeberlo sin reescribirlo puede limitar el pulido visual.
- Compartir nativo no existe en todos los navegadores de escritorio → alternativa "copiar enlace".

## 6. Criterios de aceptación

Funcionales
- Buscar, filtrar por fecha, municipio, recinto, categoría y precio; todo se refleja en la URL y sobrevive a recargar, abrir ficha y volver.
- Chips activos removibles uno a uno y "Limpiar todo" conserva parámetros ajenos (UTM).
- Cero resultados ofrece una salida útil; error ofrece reintento y nunca se presenta como "sin eventos".
- Ningún precio, hora, estado o lugar mostrado sin dato de origen.
- Volver desde la ficha restaura filtros y la posición de la tarjeta.

Responsive
- Sin desbordes ni cortes a 360, 390, 430, 768, 1280 y 1440 px; primer resultado visible en el primer pantallazo a 390 px.
- Selector de modo y navegación en la misma posición y comportamiento que hoy.

Accesibles
- Objetivos táctiles ≥ 44 px; foco visible en todos los controles; hoja de filtros con foco atrapado y cierre con Escape.
- Nombres accesibles en iconos (filtros, quitar chip, favorito, compartir); recuento anunciado por región viva.
- Contraste AA en claro y oscuro, también sobre vidrio; `prefers-reduced-motion` desactiva transiciones.
- AR en RTL con iconos de dirección invertidos; DE sin cortes por textos largos; fechas en el idioma activo.

Visuales
- Misma paleta, tipografía y ritmo que la Home Editorial; vidrio solo en barra de búsqueda, hoja de filtros y controles flotantes; sin tarjetas de vidrio ni superficies anidadas.
- Capturas antes/después en los 6 anchos, claro/oscuro, ES/EN/DE/AR.
- Typecheck limpio, todas las pruebas en verde, compilación correcta; sin publicar hasta tu revisión.

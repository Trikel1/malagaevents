# Auditoría de usabilidad inclusiva — 2026-09-07

Ámbito autorizado por el propietario: auditoría del recorrido público y correcciones
acotadas. Backend, scrapers y admin en **solo lectura**. **Sin cambios de base de
datos, RLS, esquema, secretos, rutas ni dependencias.**

## Enfoque

1. Registro previo del alcance (este documento).
2. Auditoría de código + verificación en navegador real (Playwright, localhost).
3. Correcciones mínimas y modulares con pruebas de regresión.
4. Puertas de validación: TypeScript, suite de pruebas, build, axe, anchos
   320/375/768/1440.

## Alcance de archivos

Nuevos:
- `src/lib/madridTime.ts` + `src/lib/madridTime.test.ts` — helpers de fecha
  Europe/Madrid con DST real (antes se usaban getters locales del navegador y
  saltos fijos de 24 h).
- `src/test/a11y-components.test.tsx` — axe sobre componentes reales.

Modificados:
- `src/hooks/useEvents.ts`, `src/hooks/useEventsOptimized.ts` — rangos "hoy",
  "mañana", "esta semana", "finde" y "30 días" calculados en Europe/Madrid;
  saneado del término de búsqueda para evitar `or()` inválido en PostgREST.
- `src/components/events/EventCard.tsx` — el botón de favorito deja de estar
  anidado dentro del enlace; tamaños de texto legibles (mes 11 px en vez de 8 px);
  nombre accesible completo; contraste del distintivo "Gratis".
- `src/components/layout/BottomNav.tsx` — etiqueta de texto visible en cada
  pestaña, cancelar un gesto ya no navega ni bloquea el teclado, foco visible.
- `src/components/layout/MainLayout.tsx` — un único landmark principal, enlace
  "Ir al contenido principal" y gestión de foco al cambiar de página (sin robarlo
  a los diálogos).
- `src/pages/Index.tsx` — búsqueda del inicio accesible por teclado (inerte al
  estar plegada, cierre con Escape, foco devuelto), textos que se ajustan al 200 %
  de zoom, y estados de carga/error/vacío honestos en "Este finde".
- `src/pages/EventsPage.tsx` — filtros compartibles por URL y compatibles con
  atrás/adelante, validación de categoría y franja temporal desconocidas, la
  búsqueda ya no borra el resto de parámetros, y los botones de franja pasan de
  un patrón de pestañas incompleto a botones de alternancia correctos.
- `src/pages/MapPage.tsx` — la página aporta su landmark principal (antes /map no
  tenía ninguno).
- `src/modules/maps/LeafletMap.tsx` — se elimina el único enlace externo que
  quedaba en la interfaz pública (prefijo de atribución de Leaflet).
- `src/index.css` — añadidos acotados y aditivos: etiqueta de la navegación
  inferior, foco visible y enlace de salto. Sin cambios de marca ni de tema.
- `src/i18n/locales/*.json` — clave `a11y.skipToContent` en los 9 idiomas.

## Impacto en datos

Ninguno. Sin migraciones, sin escrituras, sin ingestas de pago, sin integraciones
nuevas, sin publicación.

## Notas de honestidad

- No se fabrican eventos ni coberturas: los estados vacíos lo dicen tal cual.
- Sin afirmaciones de respaldo municipal ni de certificación legal de
  accesibilidad; lo verificado son comprobaciones automatizadas (axe) y manuales.
- Deriva de despliegue observada: el sitio publicado sirve una versión anterior
  del inicio. Se documenta; no se ha publicado nada en esta pasada.

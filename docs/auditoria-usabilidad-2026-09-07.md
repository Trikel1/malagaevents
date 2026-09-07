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

---

# Fase 2 — Fiabilidad de ubicación, datos y autorización (2026-09-07)

Autorizada por el propietario. Amplía el alcance a los hallazgos 1-8 descritos en
la petición. **Sin publicar.** Sin cambios de esquema, RLS ni datos de producción.

## Archivos e impacto

| Archivo | Cambio | Rollback |
|---|---|---|
| `src/lib/venueCoords.ts` | Elimina el jitter inventado de ±2 km; sólo coincidencia exacta del catálogo, marcada como aproximada; validadores de coordenadas finitas y en rango | revertir archivo |
| `src/lib/venueCoords.test.ts` (nuevo) | Pruebas de comportamiento: nunca inventa coordenadas | borrar |
| `src/pages/MapPage.tsx` | Resolución de coordenadas por prioridad (evento → recinto unido → catálogo aprox.), separa puntos sin ubicación en "Ubicación pendiente" sin pin, arregla campos de deportes (`start_at`/`venue`/`city`), lee `event/venue/kind/lat/lng/q` validados | revertir archivo |
| `src/hooks/useEvents.ts` | Proyecta `lat,lng,address` del evento | revertir línea |
| `src/pages/ProfilePage.tsx` | Elimina destino roto `/profile/notifications` | revertir bloque |
| `src/pages/MunicipalityAgendaPage.tsx` | Reconciliación por localidad exacta (slug = `location_normalized`), `lifecycle_status` nulo ya no excluye, estado de error honesto, "fuente oficial" sólo con `verified_at` | revertir archivo |
| `src/hooks/useSportsAgenda.ts` | Une la agenda con `sports_events` `confirmed` con procedencia verificable | revertir archivo |
| `src/lib/sportsAgendaMerge.ts` (+test, nuevo) | Normalización compartida del merge deportivo | borrar |
| `supabase/functions/_shared/security.ts` | Origen publicado real + guard de autorización reutilizable | revertir |
| `supabase/functions/{sync-events,scrape-events,discover-sources,scrape-pharmacies}/index.ts` | Guard **antes** de cualquier escritura, fetch externo o log de entrada | revertir |
| `supabase/functions/scrape-pharmacies/index.ts` | `dryRun` con cero escrituras (incluido `app_config`); borrado sólo en barrido completo; validación de fecha y método | revertir |
| `supabase/functions/scrape-events/index.ts` | Elimina la fecha inventada (+7 días a las 20:00); las fechas ilegibles se descartan y se contabilizan | revertir |
| `supabase/functions/sync-events/index.ts` | Las fuentes con URL rechazada quedan fuera del bucle de proceso | revertir |
| `supabase/functions/submit-event/index.ts` | Origen publicado, categorías alineadas con el frontend, `end_at >= start_at`, `captcha_passed: false` (no se finge verificación), logs sin email ni IP | revertir |

## Impacto de base de datos

Ninguno. No se ejecuta ingesta de pago, no se borran ni rellenan filas, no se
tocan tablas, RLS ni secretos. Las cabeceras de los cron jobs **no** se han
podido modificar: el rol de lectura del entorno no tiene permiso sobre el
esquema `cron` (`permission denied for schema cron`), por lo que el endurecimiento
de autorización queda **implementado pero sin desplegar** (ver informe final).

## Rollback global

Cada archivo es independiente; revertir los archivos listados restaura el
comportamiento previo. No hay migraciones que deshacer.

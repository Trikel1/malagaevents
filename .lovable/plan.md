# Fase 1 — Cierre técnico, datos verificados y miniaturas nuevas

Un solo documento de seguimiento: `docs/fase1-seguimiento.md` (problema, evidencia, causa, cambio, validación). Sin publicar, sin sincronizaciones masivas, sin pasarela de pago.

## 1. Hora del evento de Estepona (corrección puntual autorizada)

- Consultas de solo lectura para localizar el evento y sus ocurrencias: valor guardado, franja horaria y origen.
- Determinar la causa real entre las cuatro posibles (valor guardado, extractor, conversión de zona, presentación) comparando con la ficha oficial de esa edición.
- Corregir solo ese registro (y sus ocurrencias) con migración revisable; registrar valor anterior, corregido y fuente.
- Comprobar coherencia tarjeta / ficha / exportación de calendario.
- Consulta de candidatos con posible desfase (horas exactas en punto sospechosas, medianoche UTC): se entrega la lista, no se modifica en volumen.
- Confirmar que el extractor actual ya no reintroduce el fallo (pruebas existentes de fechas).

## 2. Dependencias y seguridad

- Leer versiones realmente instaladas en el archivo de bloqueo para React Router, Supabase (ws) y Recharts (lodash).
- Para cada alerta: aviso vigente, si aplica al uso concreto de esta aplicación, versión corregida y compatibilidad.
- Actualizaciones selectivas y mínimas; nada forzado ni masivo. Lo que exija migración mayor se delimita y se deja fuera de esta fase.
- Playwright y axe: ya hay `axe-core` y `vitest-axe`; se comprueba qué falta y solo se añade configuración útil si es imprescindible. No se añade Sentry.

## 3. Mapa

- Verificar el servicio de baldosas actual y su política vigente de uso/caché; documentar límites para un uso municipal. No se cambia de proveedor sin motivo.
- Comprobar en la aplicación: puntos reales, distinción entre ubicación confirmada, dirección publicada y aproximada, selección desde ficha, filtros, cierre de tarjeta, geolocalización denegada, atribución visible. Móvil y escritorio.
- Sin coordenadas inventadas: si no hay ubicación fiable, se explica y no se ofrecen indicaciones.
- Revisar el uso real de `leaflet`, `react-leaflet` y `maplibre-gl`; eliminar solo lo que se compruebe sin uso.

## 4. Fuentes y extracción

- Consolidar el inventario existente (CSV de `docs/fuentes/`) con las URL configuradas, indicando la cobertura exacta y lo no accesible.
- Por fuente: URL y entidad, extractor y activación, última comprobación, resultado y campos, bloqueos, muestra verificable.
- Contraste de muestras acotadas (no un rastreo completo): título, fecha, hora, recinto, municipio, imagen y entradas; zona Europe/Madrid, varios días, duplicados, capital frente a provincia.

## 5. Entradas e inscripciones

- Revisar destinos de "Ver entradas", "Inscribirme" y "Consultar en la web oficial"; mostrar el dominio de destino y no presentar una web general como página de entradas ni afirmar disponibilidad sin respaldo.

## 6. Miniaturas (entregable prioritario)

Recuperación de imágenes reales
- Ampliar la resolución de cartel en la ingesta y en el cliente: página del evento, datos estructurados, Open Graph, web oficial y plataforma de entradas; comprobar versión HTTPS antes de descartar por HTTP.
- Guardar procedencia, tipo de imagen y estado de verificación. No sobrescribir imágenes buenas por peores.
- Cervantes se mantiene como "no comprobado por bloqueo de acceso" mientras corresponda.

Colección editorial por categoría
- Generar un conjunto pequeño y coherente (música en directo, electrónica, teatro, exposiciones, familia, y reutilizando las deportivas existentes), primero una muestra de 2 para aprobar el estilo y luego el resto. Se guardan como recursos del proyecto; nunca se generan por visita.
- Sin textos ni marcas dentro de la imagen; no simulan artista, recinto ni evento real.

Presentación
- El componente compartido de imagen pasa a: imagen protagonista, proporción consistente, carteles verticales completos sobre fondo derivado del propio cartel, etiqueta "Imagen ilustrativa" discreta y no invasiva, procedencia consultable en la ficha.
- Se elimina el fondo con la palabra "Evento"/icono como resultado visible.
- Dimensiones reservadas, tamaños adaptados, carga diferida fuera de la primera pantalla, prioridad en la imagen principal, sin bucles de recarga.
- Se aplica en inicio, agenda, favoritos, recomendaciones, deportes y fichas mediante el componente ya compartido.

## 7. Validación y cierre

- Recorrido en español dentro de la aplicación (sin forzar el idioma a los demás), revisando 12 eventos reales que cubran cartel vertical, fotografía horizontal, imagen ausente, enlace roto, hora desconocida, ubicación aproximada y enlace externo de entradas.
- Capturas antes/después en móvil y escritorio.
- Tipos, pruebas y compilación ejecutados de verdad.
- Resumen breve con los 8 puntos pedidos y la fase 2 preparada.

## Notas técnicas

- Cambios acotados por área (hora, mapa, dependencias, imágenes), revisables por separado.
- Backend en modo lectura salvo la migración puntual del evento de Estepona.
- Sin dependencias nuevas salvo que una necesidad no quede cubierta por las existentes.

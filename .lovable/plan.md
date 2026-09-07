# Fase 1 — Cierre técnico, datos verificados y miniaturas nuevas

Un solo documento de seguimiento: `docs/fase1-seguimiento.md` (problema, evidencia, causa, cambio, validación). Sin publicar, sin sincronizaciones masivas, sin pasarela de pago.

Alcance del backend: se preparan e implementan en el repositorio extractores, almacenamiento de procedencia y migraciones. Lo restringido es ejecutarlos o desplegarlos en producción. Cada entrega se marca como **preparado**, **probado** o **activo en producción**.

## 1. Hora del evento de Estepona (corrección puntual autorizada)

- Consultas de solo lectura para localizar el evento y sus ocurrencias: valor guardado, franja horaria y origen.
- Determinar la causa real entre las cuatro posibles (valor guardado, extractor, conversión de zona, presentación) comparando con la ficha oficial de esa edición.
- Migración **condicionada al identificador y al valor anterior esperado**, revisable y sin capacidad de alterar registros inesperados; registrar valor anterior, corregido y fuente.
- Prueba del extractor concreto con el caso real que produjo el desfase (las pruebas genéricas de fechas no bastan).
- Comprobar coherencia tarjeta / ficha / exportación de calendario.
- Candidatos a desfase: las horas en punto y la medianoche UTC solo sirven para localizar; no se clasifican como erróneos sin contrastar la fuente y la precisión original de la fecha. Se entrega la lista, no se modifica en volumen.

## 2. Dependencias y seguridad

- Leer versiones realmente instaladas en el archivo de bloqueo para React Router, Supabase (ws) y Recharts (lodash).
- Para cada alerta: aviso vigente, si aplica al uso concreto de esta aplicación, versión corregida y compatibilidad.
- Actualizaciones selectivas y mínimas; nada forzado ni masivo, ni saltos de versión mayor indiscriminados.
- Lo que exija versión mayor se documenta con aplicabilidad, riesgo y alcance de la migración, y se separa del cambio actual **sin darlo por resuelto ni presentarlo como mejora opcional**.
- No se añade Sentry.

## 3. Mapa

- Verificar el servicio de baldosas actual y su política vigente de uso/caché; documentar límites para un uso municipal. No se cambia de proveedor sin motivo.
- Comprobar en la aplicación: puntos reales, distinción entre ubicación confirmada, dirección publicada y aproximada, selección desde ficha, filtros, cierre de tarjeta, geolocalización denegada, atribución visible. Móvil y escritorio.
- Sin coordenadas inventadas: si no hay ubicación fiable, se explica y no se ofrecen indicaciones.
- Revisar el uso real de `leaflet`, `react-leaflet`, `maplibre-gl` **y Google Maps con sus cargadores o componentes**; eliminar solo lo que se compruebe sin uso.

## 4. Fuentes y extracción

- Inventario con **todas** las fuentes conocidas y configuradas, indicando cobertura exacta y lo no accesible.
- Por fuente: URL y entidad, extractor y activación, última comprobación, resultado y campos, bloqueos, muestra verificable.
- Contraste por muestras acotadas: título, fecha, hora, recinto, municipio, imagen y entradas; zona Europe/Madrid, varios días, duplicados, capital frente a provincia.
- Cierre con cifras: inventariadas / comprobadas en esta fase / bloqueadas / pendientes. El muestreo no se presenta como validación completa.

## 5. Entradas e inscripciones

- Revisar destinos de "Ver entradas", "Inscribirme" y "Consultar en la web oficial"; mostrar el dominio de destino y no presentar una web general como página de entradas ni afirmar disponibilidad sin respaldo.

## 6. Miniaturas (entregable prioritario)

Recuperación de imágenes reales — **siempre en ingestión o proceso controlado**
- La búsqueda en página del evento, datos estructurados, Open Graph, web oficial y plataforma de entradas se hace en el servidor y se guarda el resultado. El navegador del visitante nunca rastrea fuentes externas: solo muestra la imagen ya seleccionada y gestiona fallos de carga.
- Guardar procedencia, tipo de imagen y estado de verificación. Comprobar versión HTTPS antes de descartar por HTTP. No sobrescribir imágenes buenas por peores.
- Cervantes se mantiene como "no comprobado por bloqueo de acceso" mientras corresponda.

Colección editorial por categoría
- Primero **dos imágenes de muestra**, aplicadas en tarjetas reales en móvil, para validar encuadre y legibilidad. Mientras se revisan, continúan las tareas técnicas independientes. El resto de la colección se genera solo después de la validación.
- Revisar las imágenes deportivas existentes y reutilizarlas si cumplen el nivel visual.
- Sin textos ni marcas dentro de la imagen; no simulan artista, recinto ni evento real. Se guardan como recursos; nunca se generan por visita.

Presentación
- Componente compartido: imagen protagonista, proporción consistente, carteles verticales completos sobre fondo derivado del propio cartel, etiqueta "Imagen ilustrativa" discreta, procedencia consultable en la ficha.
- Se elimina el fondo con la palabra "Evento"/icono como resultado visible.
- Dimensiones reservadas, tamaños adaptados, carga diferida fuera de la primera pantalla, prioridad en la imagen principal, sin bucles de recarga.
- Aplicado en inicio, agenda, favoritos, recomendaciones, deportes y fichas.

## 7. Pruebas

- Distinguir pruebas de componentes de recorridos de navegador: comprobar qué cobertura real existe para navegación, mapa, entradas y persistencia de intereses.
- Reutilizar las herramientas disponibles (axe-core, vitest-axe, Playwright del entorno) y añadir solo lo imprescindible.

## 8. Validación y cierre

- Recorrido en español dentro de la aplicación (sin forzar el idioma a los demás), revisando 12 eventos reales que cubran cartel vertical, fotografía horizontal, imagen ausente, enlace roto, hora desconocida, ubicación aproximada y enlace externo de entradas.
- Capturas antes/después en móvil y escritorio.
- Tipos, pruebas y compilación ejecutados de verdad.
- Resumen breve con los 8 puntos pedidos y la fase 2 preparada.

## Notas técnicas

- Cambios acotados por área (hora, mapa, dependencias, imágenes), revisables por separado.
- Sin dependencias nuevas salvo necesidad no cubierta por las existentes.

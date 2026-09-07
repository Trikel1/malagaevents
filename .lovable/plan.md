# Correcciones visuales: miniaturas, ficha, barra inferior y eventos online

## Lo que he comprobado antes de proponer nada

- **Miniaturas**: el catálogo editorial solo tiene dos imágenes (`música` y `teatro`). Todo lo demás cae en el recuadro con rayas, el icono de calendario y la palabra «EVENTO». En los datos reales hay **169 eventos futuros de categoría «otros», 111 sin imagen propia**, más música, ocio nocturno, infantil y comedia sin cartel. Por eso el placeholder es la norma y no la excepción.
- **Barra inferior**: el botón principal no permite recortar ni partir su texto y comparte fila con favorito y calendario; con la etiqueta larga «Consultar en la web oficial» la suma supera el ancho de pantalla y el texto se sale.
- **Ficha**: cada dato vive en su propia tarjeta con etiqueta en mayúsculas (FECHA/HORA/LUGAR/PRECIO); la hora usa icono de calendario; «Gratis» aparece hasta tres veces; la fecha se capitaliza palabra por palabra.
- **Las dos tarjetas del curso 3D**: son **dos registros distintos del mismo curso**, misma fuente (Agenda Municipal de Málaga), mismo título, mismo día 8 de septiembre; uno se recogió el 29 de agosto sin hora y otro el 2 de septiembre con la hora inventada de las 20:00 (22:00 en Málaga). La fuente no da identificador y la clave anti-duplicados que se guardó es aleatoria en cada recogida, así que nunca pudieron reconocerse como el mismo acto.

## 1. Cadena real de imágenes

Orden de preferencia, sin ninguna salida que acabe en el recuadro con «Evento»:

1. Cartel propio del evento, si es válido y seguro.
2. Imagen editorial de su temática.
3. Imagen editorial general de la agenda, cuando no se conoce la temática.

- Ampliar el catálogo editorial con imágenes nuevas de calidad (1024×576), generadas una sola vez y guardadas en el proyecto: formación y tecnología (el curso de 3D), exposiciones, infantil, ocio nocturno, festivales, conferencias, danza, comedia y una imagen general de agenda. Se reutilizan las de música y teatro y las deportivas ya existentes.
- Reforzar la detección de temática por título cuando la categoría llega como «otros» (curso, taller, formación, 3D, tecnología, VR, exposición, visita guiada…), sin inventar temáticas dudosas: si no hay señal clara, se usa la imagen general.
- Nunca se generan imágenes durante la navegación.
- Se mantiene la marca discreta «Imagen ilustrativa» y el texto accesible que aclara que no es el cartel oficial.
- Se aplica igual en tarjeta y en cabecera de ficha (mismo componente), y la cabecera deja de verse casi vacía.

## 2. Ficha más limpia

- Imagen bien proporcionada, categoría discreta, título completo con buena jerarquía.
- Bloque práctico compacto en una sola tarjeta ligera, con icono + valor y sin las etiquetas FECHA/HORA/LUGAR/PRECIO (los nombres se conservan solo para lectores de pantalla):
  - calendario + fecha, agrupada con reloj + hora u «Hora por confirmar»;
  - ubicación (o icono de actividad online) + lugar;
  - precio solo una vez, y solo cuando aporta.
- Se elimina la repetición de «Gratis» entre la insignia, el bloque práctico, el bloque de entradas y los detalles adicionales.
- Acciones claras arriba (calendario / cómo llegar) y descripción y detalles debajo.
- Fecha en español natural: «martes, 8 de septiembre», sin capitalizar cada palabra; el resto de idiomas conserva su formato.
- Menos relleno, sin reducir legibilidad ni el tamaño cómodo de los botones; el contenido se adapta a pantallas estrechas.

## 3. Barra inferior sin recortes

- Una sola acción principal visible, que puede reducir su texto y ajustarse al ancho disponible; etiqueta corta «Web oficial» cuando el destino es informativo, y «Ver entradas» / «Inscribirme» cuando corresponde.
- Se quitan de la barra el favorito y el calendario duplicados (siguen arriba en la ficha).
- El dominio de destino se muestra en una línea secundaria legible.
- Espacio seguro inferior respetado y hueco suficiente al final del contenido para que la barra no tape nada.
- No se aplica ningún truco de desplazamiento horizontal al documento.

## 4. Eventos online coherentes

- Cuando el lugar y la dirección indican actividad exclusivamente online (campos de lugar y dirección, no una palabra suelta del texto), se muestra «Online» una sola vez, sin municipio como dirección física y sin «Cómo llegar».
- El acceso o la inscripción solo aparece si hay enlace confirmado.
- Los casos híbridos o ambiguos conservan la información física; no se cambia nada de forma global.

## 5. Las dos tarjetas del curso 3D

- No se borra ni se fusiona nada por compartir título.
- Se documenta la causa concreta (clave anti-duplicados aleatoria en la Agenda Municipal + hora inventada de las 20:00 en una recogida antigua) y se propone una corrección acotada de esa fuente para futuras recogidas: clave estable a partir de título + fecha + lugar.
- Como los dos registros son del mismo día y el mismo curso, se propone además una revisión manual acotada de ese par; no se tocan datos históricos de forma masiva sin tu visto bueno.

## 6. Comprobación visual

Capturas reales de la aplicación a 320, 390 y 430 píxeles y en escritorio, en listado y ficha, con: cartel vertical, fotografía, evento sin imagen oficial, título largo, evento online, hora desconocida, evento con entradas y evento cuyo único enlace es la web oficial. Se comprueba además la barra inferior al entrar, bajar, subir y al final de la ficha, la ampliación de texto, el foco de teclado y la ausencia de desplazamiento horizontal. Los casos simulados, si hacen falta, se identifican como tales.

## Detalle técnico

- `src/lib/categoryImages.ts`: catálogo ampliado + imagen general por defecto; nueva resolución por título para categoría `other`.
- `src/components/events/EventImage.tsx`: el placeholder geométrico deja de ser la salida habitual; queda solo como último recurso si faltara un recurso.
- `src/pages/EventDetailPage.tsx`: bloque práctico compacto, iconos (`Clock` para la hora), formato de fecha, modo online, barra inferior con una acción y `min-w-0` + recorte controlado.
- Nuevo ayudante `src/lib/eventPlace.ts` con `isOnlineEvent` y sus pruebas.
- Pruebas nuevas: resolución de imagen por categoría y título, detección online, formato de fecha en español.
- No se publica nada; comprobación con tipos, pruebas y compilación además de las capturas.

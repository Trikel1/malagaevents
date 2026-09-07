# Auditoría de fuentes y extractores — 7 septiembre 2026

Comprobación real (lectura, sin escrituras en base de datos ni ingesta de pago) de
las 214 URL únicas registradas en `event_sources`, `sources_config`,
`sports_sources` y `scraping_sources`, y ejecución en seco de los 22 extractores
registrados.

Tablas de detalle:
- `docs/auditoria-fuentes-2026-09-07.csv` — una fila por URL.
- `docs/auditoria-extractores-2026-09-07.csv` — una fila por extractor.

## 1. Disponibilidad de las URL

| Resultado | URL |
|---|---|
| Responden correctamente (200) | 171 |
| Bloqueo del servidor (403) | 21 |
| robots.txt prohíbe la ruta | 6 |
| Error de conexión | 4 |
| Sin respuesta a tiempo | 4 |
| No existe (404) | 3 |
| Error de certificado | 3 |
| Límite de peticiones (429) / método no permitido (405) | 2 |

No se detectó ningún muro real de verificación tipo "un momento…" en las páginas
que respondieron 200; los avisos anteriores procedían de guiones de recaptcha
presentes en páginas normales.

Casos que requieren decisión del propietario (no se ha cambiado ninguna URL sin
prueba):

- `teatrocervantes.com` (7 URL): Cloudflare responde 403 a cualquier acceso
  automatizado. La fuente no es explotable sin acuerdo con el teatro.
- `malaga.es` (Diputación, Culturama, MVA, Deportes): 403 sistemático.
- `rfaf.es`, `torremolinos.es`, `pruebaspopulares.pmdt.es`,
  `datosabiertos.malaga.eu/api/3/action/package_list`: prohibidos por robots.txt;
  quedan excluidos.
- `uma.es/servicio-cultura/…/contenedor-cultural/`: 404, la página cambió de sitio.
- `cadenaser.com/tag/serpeques/` y `teatrodelsoho.com/evento/`: 404.
- `losalamosbeach.com`, `malagacf.com/entradas`, `museosdeandalucia.es`: certificado
  caducado o mal configurado.
- `entradas.com` (4 URL): agotan el tiempo de espera de forma constante.

Fuentes con datos aprovechables confirmados: CSV de datos abiertos del
Ayuntamiento (2024 y 2026), calendario ICS del Unicaja Baloncesto, y páginas con
datos estructurados en Turismo de Ronda, Teatro Estepona, mmalaga.es, LaLiga
(Málaga CF) y Auditorio Edgar Neville.

## 2. Extractores en seco

Producen eventos: datos abiertos de Málaga (901, 898 válidos), FYCMA (41),
La Térmica (35), Serranía de Ronda (20), Junta de Andalucía (9), Axarquía (2).

Producen cero y por qué:
- Bloqueo del sitio: Teatro Cervantes, MVA, Museo Thyssen, Sala Trinchera,
  La Cochera Cabaret.
- Página inexistente: Contenedor Cultural UMA, Teatro del Soho.
- Sin programación publicada en el momento de la comprobación: Teatro Cánovas,
  Museo Picasso, Sala París 15, Cine Albéniz.
- Requieren clave de pago que no está configurada: Diputación, Culturama,
  Visit Costa del Sol, agenda del Ayuntamiento (vía servicio externo).

## 3. Correcciones aplicadas en este trabajo

1. **Categorías**: varias fuentes escribían la categoría tal cual venía en
   español ("Cursos y talleres", "Fiestas populares", "Música", "Deportes"…).
   Los filtros de la aplicación buscan las claves internas, así que esos eventos
   no aparecían en ningún filtro. Ahora la ingesta traduce siempre la categoría
   de origen a la lista canónica, con pruebas.
2. **Enlaces rotos del CSV municipal**: 374 de 901 filas traían la dirección web
   vacía o sin formato válido y se guardaban igualmente. Ahora sólo se acepta una
   dirección completa; si no la hay, se conserva el enlace oficial del recurso.
3. **Imágenes relativas**: las fichas de la Junta de Andalucía devolvían rutas de
   imagen incompletas que llegaban rotas a la aplicación. Se completan contra la
   página de origen y, si no se puede, se descartan en lugar de guardar una
   imagen rota.
4. **Diagnóstico honesto en Teatro del Soho**: cuando falta el servicio externo de
   lectura, el extractor recibía la página sin convertir y devolvía cero sin
   explicación. Ahora registra el motivo real.

No se han modificado datos de producción, ni el esquema, ni los permisos, ni las
rutas de la aplicación, ni el diseño.

## 4. Pendiente de decisión

- Desactivar definitivamente el extractor duplicado `ayto-malaga-csv` (apunta al
  mismo CSV que `malaga-open-data-csv`, ya activo y de mejor calidad).
- Solicitar acceso o acuerdo a Teatro Cervantes y Diputación de Málaga.
- Localizar la nueva dirección de la agenda del Contenedor Cultural de la UMA.
- Valorar el calendario ICS del Unicaja Baloncesto como fuente deportiva fiable.

# Recomendación estratégica — Fase 3C-2

## Recomendación principal

**Antes de escribir un solo adaptador más, ejecuta y observa el dry-run real de `teatro-cervantes`.** Es la primera vez que un adaptador real corre end-to-end contra web pública. Hasta que no veas el `preview` con ojos humanos, no sabes:

- si Firecrawl devuelve el markdown que el parser espera,
- si las ~130–160 fechas se están infiriendo bien (año, hora 20:00 fallback, rangos),
- si el venue inference (Cervantes / Echegaray / Bodegueros / Factoría) acierta,
- si la dedupe key colisiona con eventos ya existentes en `events`,
- si el mapeo de categorías tiene sentido para los filtros que acabas de añadir (kids, music, theater, festivals).

Crear ahora Marenostrum / La Térmica / Soho multiplicaría los adaptadores sin haber validado ni una vez que la tubería produce datos limpios. Es el momento clásico donde se acumulan bugs sistémicos (todos los adaptadores replican el mismo error de fecha, por ejemplo).

El segundo cuello de botella es de **observabilidad**: `admin-ingest-dry-run` devuelve `previewCount` pero no el preview en sí. Ejecutar dry-run "a ciegas" desde /admin no te sirve para decidir si activar la fuente. Antes de más adaptadores, el panel tiene que mostrar el preview.

---

## Siguiente prompt sugerido (Fase 3C-2)

> **FASE 3C-2 — Preview inspeccionable de dry-run en /admin → Ingesta.**
>
> Objetivo: poder ver, para una fuente, los primeros N eventos que un dry-run devolvería, sin insertarlos, para decidir si el adaptador está listo antes de activarlo.
>
> Alcance:
> - `admin-ingest-dry-run`: además de contadores, devolver `preview` sanitizado (máx. 20 items) con `title`, `startAt`, `venueName`, `category`, `sourceUrl`, `ticketUrl`, `raw.timeAssumed`, `raw.dateLine`. Nada de headers, tokens ni HTML crudo. Truncar strings > 300 chars.
> - `scrape-source`: confirmar que ya expone `preview` en respuesta dry-run; si no, añadirlo (solo en modo dryRun, cap 20).
> - `IngestionRegistry.tsx`: al pulsar Dry-run, abrir un diálogo/drawer con contadores + tabla de preview + badges (`timeAssumed`, categoría, venue). Botón "Copiar JSON" para diagnóstico.
> - No tocar BD, no activar fuentes, no cambiar `enabled`/`robots_ok`, no insertar eventos, WRITE_ENABLED sigue false.
>
> QA: TS limpio; dry-run de `teatro-cervantes` desde /admin muestra 15–20 eventos parseables con fechas, venues y URLs correctas; sin secretos en el bundle ni en la respuesta.

Ejecutar ese prompt **ya es la prueba real** del adaptador Cervantes: no necesitas un prompt separado "probar dry-run" — el propio preview te lo enseña. Ahorra un ciclo.

---

## Orden de 3 fases

### Fase A — Observabilidad + validación Cervantes (siguiente prompt)
Preview inspeccionable + primer dry-run real de Cervantes visible en /admin. Iterar el parser de Cervantes si el preview revela fallos (fechas 2027, venues mal inferidos, títulos truncados). No se activa nada.

### Fase B — Segundo adaptador + endurecer normalización
Segundo adaptador. Recomendación: **Teatro del Soho CaixaBank**. Razones:
- Fuente monositio, estructura estable, pocas variantes de fecha.
- Complementa Cervantes en la misma categoría (theater/music) → estresa la dedupe entre fuentes con solapes reales (una gala anunciada en ambos).
- No requiere login ni JS pesado como MalagaEntradas.
- La Térmica tiene mucho contenido no-evento (talleres largos, cursos) que ensucia; mejor más tarde.
- Marenostrum es festival estacional → poco volumen ahora.

En paralelo, endurecer `dates.ts` / normalize con los edge cases que Cervantes haya revelado, y añadir tests unitarios ligeros del parser de fechas.

### Fase C — Primera activación controlada + UI pulida
- Activar SOLO `teatro-cervantes` (enabled=true, robots_ok=true tras verificar `robots.txt` manualmente) con WRITE_ENABLED=false todavía.
- Botón "Promote dry-run → write" en /admin que en un solo click flipa WRITE_ENABLED por-ejecución y hace un run real acotado (máx N inserts, con rollback fácil vía `event_sources_runs`).
- QA de /events con datos reales de Cervantes mezclados con lo existente: verificar filtros infantil/outdoor/edades siguen coherentes, no aparecen títulos rotos, imágenes cargan, dedupe no duplica.
- Solo entonces, replicar el patrón para Soho.

---

## Riesgos actuales (priorizados)

1. **Fechas silenciosamente incorrectas.** El fallback 20:00 y la inferencia de año son razonables pero no verificados. Un evento en enero-2027 leído hoy podría caer en enero-2026 pasado. Impacto: eventos "fantasma" o "vencidos" en el feed. Mitigación: preview + spot-check humano.
2. **Colisión de dedupe entre adaptadores futuros.** Cervantes usa venue "Teatro Cervantes"; si otra fuente lo escribe "T. Cervantes" o "Cervantes (Málaga)", `normalizeVenueName` puede no colapsarlas y duplicarás eventos. Impacto alto cuando entren 2ª y 3ª fuentes. Mitigación: catálogo canónico de venues antes de activar la 2ª fuente.
3. **robots.txt no verificado por fuente.** `robots_ok=false` en las 56 fuentes es correcto como default, pero antes de activar Cervantes hay que leer su `robots.txt` a mano y documentar la decisión. No confiar en un flag booleano sin evidencia.
4. **Firecrawl es coste variable.** Cada dry-run consume créditos. Sin caché de respuesta, iterar el parser 10 veces = 10 scrapes. Mitigación en Fase A: cachear el markdown en memoria/tmp durante desarrollo, o guardar un fixture en el repo para tests deterministas.
5. **Datos pobres = filtros mienten.** Si Cervantes no marca `is_family_friendly` correctamente para "Teatro Infantil", el filtro Infantil se llena de heurística y ruido. El backfill actual mitiga, pero solo para lo ya insertado. Los nuevos eventos entran sin pasar por `backfill_event_family_flags`. Mitigación: llamar la función tras cada write real, o replicar sus reglas en el adaptador.
6. **UI todavía asume dataset pequeño.** 196 family + resto ≈ pocos cientos. Si Cervantes suma 150, la fila de chips y `/events` deberían seguir bien, pero el mapa y el calendario mensual pueden empezar a saturarse. No es urgente pero conviene medir en Fase C.
7. **`admin-ingest-dry-run` devuelve poca info.** Ya cubierto en la recomendación principal.

---

## Qué NO haría todavía

- **No crear más adaptadores** (Marenostrum, La Térmica, MalagaEntradas) hasta validar Cervantes end-to-end. Riesgo de replicar bugs de fechas/venues en 4 sitios.
- **No activar ninguna fuente** (`enabled=true`, `robots_ok=true`) sin ver el preview y sin verificar robots manualmente.
- **No flipar WRITE_ENABLED** hasta Fase C, y solo por ejecución, nunca global permanente.
- **No tocar el motor de ingesta ni la dedupe SQL** hasta que el preview real muestre un problema concreto — refactor prematuro.
- **No añadir más filtros a /events** (por ejemplo distancia numérica, precio, franjas horarias). El filtro-set actual ya es amplio; primero llena de datos, luego decide qué filtro sobra o falta con evidencia.
- **No integrar MalagaEntradas todavía**: es agregador con anti-bot y estructura JS-heavy. Coste Firecrawl alto, ROI bajo mientras haya fuentes primarias más limpias.
- **No publicar/anunciar** la app "con eventos reales" hasta terminar Fase C con al menos una fuente activada y auditada.

---

## Resumen accionable

Ejecuta el prompt de Fase 3C-2 (preview inspeccionable). Ese único paso te da: prueba real de Cervantes, decisión informada para el siguiente adaptador, y la herramienta de auditoría que vas a necesitar para todos los adaptadores posteriores. Es el mayor retorno por crédito gastado en este momento.

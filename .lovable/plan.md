## Fase 0 — Auditoría operativa (hecha, con datos reales)

### Estado del pipeline nuevo (`event_sources` + adapters registry)

Consultado en vivo contra la BD:

| Métrica | Valor real |
|---|---|
| Filas en `event_sources` | 132 |
| Fuentes con `enabled=true` | **0** |
| Fuentes con `robots_ok=true` | **0** |
| Fuentes con `write_confirmed_at` (write gate pasado) | **0** |
| Runs ejecutados (`event_source_runs`) | **0** |
| Adapters implementados en filesystem | 21 |
| Fuentes con `adapter_key` apuntando a uno de los 21 | **9** |
| Eventos publicados en BD | 1.430 (157 futuros) |

**Descubrimiento clave**: los 1.430 eventos NO vienen del registry nuevo. Vienen del pipeline legacy (`sync-events`/`scrape-events`/`sync_runs` + Firecrawl). El sistema de "backbone provincial" que el prompt describe existe como código pero **jamás ha escrito un evento a producción**. Todo está en `pending_review` / `awaiting_admin_gate`.

### Matriz de cobertura real (fuentes prioritarias del brief)

```text
CAPA A — BACKBONE PROVINCIAL
fuente                          adapter?  source row?   enabled  robots  write_gate  runs
malaga-open-data-csv            SÍ        SÍ            no       no      no          0
ayto-malaga-csv                 SÍ        NO (huérfano) —        —       —           —
ayto-malaga                     SÍ        NO (huérfano) —        —       —           —
diputacion-malaga               SÍ        src-agenda-provincial no  no   no          0
culturama                       SÍ        src-culturama-agenda  no  no   no          0
junta-andalucia-cultura         SÍ        src-junta-agenda…     no  no   no          0
visit-costa-del-sol             SÍ        src-visit-costa…      no  no   no          0
axarquia-costa-del-sol          SÍ        src-eventos-axarquia… no  no   no          0
serrania-de-ronda               SÍ        src-eventos-serrania… no  no   no          0
sierra-de-las-nieves            NO        src-eventos-sierra…   no  no   no          bloqueado: wp_blog_posts
Agenda Cultural Málaga (capital)NO(*)     src-agenda-cultura…   no  no   no          0
```
(*) hay `ayto-malaga` y `ayto-malaga-csv` que probablemente cubren esto pero están huérfanos.

```text
CAPA B — MÁLAGA CAPITAL POR RECINTO
Adapter implementado pero SIN fila conectada en event_sources:
  teatro-cervantes, teatro-soho, teatro-canovas, la-termica, mva,
  museo-picasso, museo-thyssen, sala-trinchera, sala-paris-15,
  la-cochera-cabaret, contenedor-cultural-uma, cine-albeniz
Adapter FALTA:
  FYCMA, Teatro Echegaray, Centre Pompidou, Museo Ruso, MUCAC,
  Festival de Málaga, Fancine, La Noche en Blanco
```

```text
CAPA C — MUNICIPIOS P0/P1
Adapter falta en TODOS los P0: Marbella, Estepona, Fuengirola, Mijas,
  Benalmádena, Torremolinos, Antequera, Ronda, Vélez-Málaga, Nerja
  (existen source rows en pending para varios de ellos)
```

### Bloqueo exacto y crítico

No es un problema de adapters — es que **el gate de escritura no está abierto para ninguna fuente y no hay runs**. Implementar 20 adapters nuevos ahora no publicará ni un evento adicional: quedarían como los otros 12 adapters ya implementados que llevan meses sin `enabled=true`.

## Fase 1 realista para ESTA iteración

Objetivo: desbloquear el pipeline con **una sola fuente**, extremo a extremo, y demostrar métricas reales. Después replicar el patrón.

### Fuente elegida: `malaga-open-data-csv`

Motivos: CSV oficial del Ayto., adapter maduro (`supabase/functions/_shared/adapters/malaga-open-data-csv.ts`) con tests y fixture, sin scraping HTML, robots claros, cubre Málaga capital.

### Pasos concretos

1. **Verificar adapter con dry-run real** vía `admin-ingest-dry-run` contra `malaga-open-data-csv`. Leer:
   - candidatos, futuros, pasados, inválidos, duplicados
   - detección de horas falsas 01:00/02:00 por UTC-midnight
   - municipalities resueltos
   - venues principales
2. Si dry-run pasa umbrales de calidad: **preflight** vía `admin-ingest-preflight` — confirmar robots, licencia, terms.
3. **Abrir write gate** en la fila `malaga-open-data-csv` vía `admin-source-confirm-write` (setea `write_confirmed_at`, `robots_ok=true`, `enabled=true`).
4. **Ejecutar ingest real** vía `admin-ingest` (una sola pasada, sin cron aún).
5. **Verificar en BD y en `/events`**:
   - nuevos eventos con `source_url`, `source_id`, `external_id`, `verified/last_seen`, `dedupe_key`
   - filtros Hoy / Mañana / Este finde / municipio funcionan
   - cero duplicados frente a legacy
6. **Documentar métricas reales** en `docs/agenda-preflight/malaga-open-data-csv.md` (ya existe; actualizar con métricas post-ingest).

### Salida esperada de Fase 1

- 1 fuente end-to-end activa con runs reales y métricas.
- Patrón replicable documentado para las 9 fuentes restantes de Capa A.
- Confirmación de que dedupe con el pipeline legacy funciona (si no, decisión: apagar legacy para Málaga capital, o coexistir con `source_type` distinguidor).

### Qué NO se hace en esta iteración (control de créditos)

- No se implementan adapters nuevos (FYCMA, Marbella, Estepona, etc.).
- No se conecta `teatro-cervantes` ni el resto de Capa B — están implementados pero sin source row; su conexión va en Fase 2 cuando el patrón esté probado.
- No se redisea `/events` ni el admin.
- No se toca sports, farmacias, auth, routing ni estilos.

## Bloqueos que necesitan decisión tuya antes de continuar

1. **Coexistencia con legacy**: el pipeline `sync-events`/Firecrawl ya publica 1.430 eventos, muchos probablemente solapan con Open Data CSV. Opciones:
   - (a) Convivir usando `dedupe_key` — el existente lo genera por (título+venue+start). El nuevo también. Si `dedupe_key` coincide, `ON CONFLICT` decide quién gana según `trust_level` de `event_sources`.
   - (b) Congelar legacy para Málaga capital antes de activar Open Data CSV.
   - Mi recomendación: **(a)** y elevar `trust_level` de Open Data CSV por encima del legacy.

2. **9 source rows huérfanos con `adapter_key='pending'`** apuntando a recintos que sí tienen adapter (`src-teatro-cervantes-p`, `src-la-termica-p`, `src-picasso-p`, `src-thyssen-p`, `src-centro-mva-p`, etc.). Puedo actualizarlos en un `UPDATE` masivo para apuntar a su adapter real, pero eso solo tiene sentido después de probar el patrón con una fuente.

3. **`src-eventos-sierra-de-las-nieves`** marcada como `no_structured_event_data:wp_blog_posts` — su web no expone eventos estructurados. Correcto dejarla en moderación (Capa D del brief). Confirmación: no gastar tiempo aquí.

## Confirmación de no-tocar

Nada de este plan modifica: `sports_events`, `pharmacies_directory`, `auth`, routing (`App.tsx` no se toca), `src/index.css` global, `EventCard.tsx`, filtros de UI.

## Salida final (secciones 1-10 del brief)

1. **Matriz antes/después** — ver tabla arriba (después: pendiente Fase 1).
2. **Fuentes implementadas o corregidas** — 0 en esta llamada (bloqueo estructural detectado antes de tocar código).
3. **Métricas dry-run** — pendientes del run que ejecutaremos en Fase 1.
4. **Fuentes listas para preflight** — `malaga-open-data-csv` (candidata única propuesta).
5. **Bloqueos exactos** — write gate cerrado en 132/132 fuentes; runs=0; adapters huérfanos; convivencia con legacy sin política definida.
6. **Archivos modificados** — ninguno todavía (audit-only).
7. **DB objects tocados** — ninguno (solo SELECT).
8. **QA** — matriz verificada con `psql` directo contra la BD.
9. **Próximo bloque recomendado** — ejecutar los 6 pasos de Fase 1 sobre `malaga-open-data-csv`.
10. **Confirmación** — no se ha tocado deportes, farmacias, auth, routing ni estilos.

## Aprobar

Si apruebas este plan, en la siguiente llamada ejecuto los 6 pasos de Fase 1 sobre `malaga-open-data-csv` end-to-end y traigo métricas reales. Si prefieres otra fuente inicial (p. ej. `diputacion-malaga` o `culturama`) dímelo antes.

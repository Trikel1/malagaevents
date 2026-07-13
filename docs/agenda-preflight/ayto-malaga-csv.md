# Preflight — ayto-malaga-csv

**Fuente:** Ayuntamiento de Málaga · Portal Datos Abiertos (CKAN)
**Dataset:** `agenda-2026`
**Recurso CSV:** https://datosabiertos.malaga.eu/recursos/cultura/agenda/2026.csv
**Adapter:** `supabase/functions/_shared/adapters/ayto-malaga-csv.ts`
**Fecha preflight:** 2026-07-13

## 1. Robots.txt

- URL: https://datosabiertos.malaga.eu/robots.txt
- HTTP: `200`, `Content-Type: text/plain; charset=utf-8`
- Contenido relevante:

  ```
  User-agent: *
  Disallow: /dataset/rate/
  Disallow: /revision/
  Disallow: /dataset/*/history
  Disallow: /api/
  Crawl-Delay: 10
  ```

- La ruta del recurso, `/recursos/cultura/agenda/2026.csv`, **no está en
  ninguna regla `Disallow`**. Automatización permitida respetando
  `Crawl-Delay: 10` (nuestro adapter se ejecuta como mucho una vez cada
  varios minutos vía `polling_interval`, muy por encima del mínimo).
- La API CKAN (`/api/`) sí está bloqueada — solo la usamos manualmente
  para verificar metadatos de licencia; el pipeline productivo no llama a
  `/api/` en ningún caso.

## 2. Términos y licencia

- Metadatos del dataset (consulta manual a la API pública):
  - `title`: **Agenda 2026**
  - `name`: `agenda-2026`
  - `license_title`: **Creative Commons Atribución/Reconocimiento 4.0
    Licencia Pública Internacional — CC BY 4.0**
- Requisitos legales al ingestar:
  - Reconocer al Ayuntamiento de Málaga como fuente.
  - No inducir a error sobre la relación con el titular.
- Se cumplen mediante:
  - `event_sources.name = "Ayuntamiento de Málaga (CSV Open Data)"`
  - `events.source_ref` conserva la URL original de cada evento
    (`DIRECCION_WEB` cuando existe, si no la del propio CSV).
  - `events.source = "ayto-malaga-csv"`.
- **`terms_reviewed_at` pendiente de firma humana antes de habilitar
  escritura.** Ningún despliegue automático sobrescribirá esto.

## 3. Respuesta HTTP del recurso

- HTTP HEAD/GET rango 0-8191:
  - Status: `200` (rango: `206 Partial Content`)
  - `Content-Type`: `text/csv`
  - `Content-Length` (total, según Last-Modified): variable
  - `Last-Modified`: `Wed, 08 Jul 2026 22:05:07 GMT`
  - `ETag`: `"11bb75-65620b34b6537"`
- Codificación: **UTF-8** verificada byte a byte (`file` reporta
  `CSV Unicode text, UTF-8`).
- Separador: `,` — quoted fields con `"` doblado.

## 4. Esquema real (verificado 2026-07-13)

```
ID_EVENTO, EVENTO, ID_ACTIVIDAD, NOMBRE, DESCRIPCION, ACCESO_MIN,
ID_LUGAR, OTROS_LUGARES, HORARIO, TELEFONO, F_INICIO, F_FIN,
DESTINATARIOS, DESTINATARIOS_DESCRIPCION, DIRECCION_WEB, E_MAIL,
CATEGORIA, ESPECIALIDAD, ORGANIZA, EQP_DESCRIPCION, EQP_NOMBRECALLE,
EQP_DISTRITO, EQP_OTROS
```

Cada `ID_EVENTO` puede aparecer en varias filas (una por `ESPECIALIDAD`).
El ingestion layer las colapsa vía la dedupe key compartida
(`title | venue | locality | Madrid-minute`).

Fixture representativo derivado de este esquema (6 filas, sin datos
personales — teléfonos y emails vaciados):
`supabase/functions/_shared/adapters/__fixtures__/ayto-malaga-csv.sample.csv`.

## 5. Dry-run real

Comando (Deno, la misma runtime que producción):

```bash
deno run --allow-net=datosabiertos.malaga.eu --allow-env \
  scripts/dry-run-ayto-csv.ts > /tmp/dryrun.json
```

Resultado:

| Métrica                  | Valor  |
| ------------------------ | ------ |
| Filas descargadas        | 907    |
| Eventos canonicalizados  | 907    |
| Dedupe keys únicos       | 557    |
| Duplicados colapsados    | 350    |
| Duración                 | 1026 ms |

Muestra (primeras 3 filas del mismo `ID_EVENTO=51728` con distinta
`CATEGORIA` — todas colapsan al mismo `dedupe_key`):

```json
{
  "dedupe_key": "fc168eb939d6451f1a2ef785c923bdd6871ac2a461a6e06ef1496a315761e914",
  "external_id": "51728",
  "title": "Pasacalle de Reyes 2026 Distrito 11 Teatinos-Universidad",
  "startAt": "2026-01-03T23:00:00.000Z",
  "category": "Incidencias de tráfico"
}
```

## 6. Prueba de no-escritura

Estado de `public.events` antes y después del dry-run real:

| Momento | `SELECT COUNT(*) FROM events` |
| ------- | ----------------------------- |
| Antes   | **1430**                       |
| Después | **1430**                       |
| Diff    | **0 (idéntico ✓)**             |

Adicionalmente:

- `event_source_runs` para este `source_id` en los últimos 10 minutos: **0**.
- `ingestion_errors` para este `source_id` en los últimos 10 minutos: **0**.
- El adapter es una función pura (`fetchEvents → CanonicalEvent[]`); el
  test `src/test/ayto-malaga-csv-adapter.test.ts` garantiza estáticamente
  que el módulo no importa `supabase-js` ni contiene `.insert/.update/
  .upsert/.delete/.from('events')`.
- El gate `authorizeWrite` (ver `_shared/ingestion/write-auth.ts`) exige
  simultáneamente `writeEnabled=true`, `dryRun=false`, `enabled=true`,
  `robots_ok=true`, `write_confirmed_at IS NOT NULL`, `adapter_key`
  coincidente y `maxWrites ≤ 50`. Estado actual de la fuente:

  ```
  slug            = ayto-malaga-csv
  enabled         = false
  robots_ok       = false
  write_confirmed_at = NULL
  ```

  Ninguna de las tres puertas centrales pasa; incluso solicitando
  `writeEnabled=true` la función responde `403 write_not_authorized`.

## 7. Estado y bloqueo residual

- Adapter **implementado y verificado** contra el esquema real.
- Fuente permanece **`enabled=false`, `robots_ok=false`, `write_confirmed_at=NULL`**
  hasta:
  1. Firma humana de `terms_reviewed_at`.
  2. Activación explícita vía `admin-source-confirm-robots` y
     `admin-source-confirm-write` (ambos requieren rol admin y no están
     expuestos en cliente).
- No hay bloqueo externo: `robots.txt` permite la ruta, el CSV responde
  `200`, la licencia CC BY 4.0 permite reutilización con atribución.

# Preflight — malaga-open-data-csv

**Fuente:** Ayuntamiento de Málaga · Portal Datos Abiertos (CKAN)
**Dataset:** `agenda-2026`
**Recurso CSV:** https://datosabiertos.malaga.eu/recursos/cultura/agenda/2026.csv
**Adapter:** `supabase/functions/_shared/adapters/malaga-open-data-csv.ts`
**Fecha preflight:** 2026-07-13

## 0. Relación con `ayto-malaga-csv`

Este adapter es el **sucesor corregido** de `ayto-malaga-csv`. Ambos consumen
el mismo recurso, pero `malaga-open-data-csv`:

1. **No fabrica horas falsas.** `F_INICIO="dd/mm/YYYY 00:00:00"` (fecha
   sin hora, muy común en el CSV) NO se convierte a 01:00/02:00 Madrid.
2. **Parsea `HORARIO`** cuando existe hora explícita
   (`"17 a 20 horas"`, `"de 18:30 a 21:00"`, `"20:30 h"`, `"a las 20 h"`,
   `"17-20 h"`, …).
3. **Marca `timeAssumed=true`** cuando no hay hora recuperable; `startAt`
   se sitúa en UTC-medianoche del día calendario Madrid (sentinel que
   `hasExplicitTime()` ya trata como “Hora por confirmar”).
4. **Extrae `endAt`** de la parte final de `HORARIO` o de un `F_FIN`
   posterior al `F_INICIO` (multi-día).
5. Prefiere `CATEGORIA` sobre `ESPECIALIDAD`; usa `OTROS_LUGARES` como
   fallback cuando no hay `EQP_DESCRIPCION`.

`ayto-malaga-csv` permanece registrado sin cambios: no se activa nada.

## 1. Robots.txt

- URL: `https://datosabiertos.malaga.eu/robots.txt`
- `Content-Type: text/plain; charset=utf-8`, HTTP 200
- Reglas relevantes:

  ```
  User-agent: *
  Disallow: /dataset/rate/
  Disallow: /revision/
  Disallow: /dataset/*/history
  Disallow: /api/
  Crawl-Delay: 10
  ```

- La ruta `/recursos/cultura/agenda/2026.csv` **no está bloqueada**. El
  adapter respeta `Crawl-Delay: 10` con margen amplio.

## 2. Términos y licencia

- Licencia: **CC BY 4.0** — permite reutilización con atribución.
- Atribución en el pipeline:
  - `event_sources.name = "Málaga · Datos Abiertos (Agenda CSV)"`.
  - `events.source = "malaga-open-data-csv"` cuando se llegue a activar.
  - `events.source_ref` conservará `DIRECCION_WEB` cuando exista;
    en caso contrario la URL del propio recurso CSV.
- **`terms_reviewed_at` pendiente de firma humana** antes de habilitar
  escritura.

## 3. Respuesta HTTP del recurso

- HTTP 200 · `Content-Type: text/csv` · `text/plain` inspector reporta
  `CSV Unicode text, UTF-8`.
- Separador: coma. Campos con comillas dobles y `""` como quote escape.
- El adapter usa `fetchCsv` con `timeout=25s`, `retries=2`, `maxRows=8000`.

## 4. Esquema real (verificado 2026-07-13)

```
ID_EVENTO, EVENTO, ID_ACTIVIDAD, NOMBRE, DESCRIPCION, ACCESO_MIN,
ID_LUGAR, OTROS_LUGARES, HORARIO, TELEFONO, F_INICIO, F_FIN,
DESTINATARIOS, DESTINATARIOS_DESCRIPCION, DIRECCION_WEB, E_MAIL,
CATEGORIA, ESPECIALIDAD, ORGANIZA, EQP_DESCRIPCION, EQP_NOMBRECALLE,
EQP_DISTRITO, EQP_OTROS
```

Mapping → `CanonicalEvent`:

| CanonicalEvent | Origen CSV |
| --- | --- |
| `title` | `NOMBRE` |
| `description` | `DESCRIPCION` |
| `startAt` | `F_INICIO` + `HORARIO` (Madrid TZ) |
| `endAt` | `HORARIO` fin, o `F_FIN` si multi-día |
| `venueName` | `EQP_DESCRIPCION` → fallback `OTROS_LUGARES` |
| `venueAddress` | `EQP_NOMBRECALLE` → fallback `EQP_DISTRITO` |
| `locality` | `"Málaga"` (constante — CSV es municipal) |
| `category` | `CATEGORIA` → fallback `ESPECIALIDAD` |
| `sourceUrl` | `DIRECCION_WEB` si es `http(s)://`, si no URL del CSV |
| `ticketUrl` | `DIRECCION_WEB` si contiene `entradas/tickets/reservas/inscripcion` |
| `priceText` | `"Entrada libre"` si `ACCESO_MIN == "S"` |
| `externalId` | `ID_EVENTO` |
| `organizer` | `ORGANIZA` |
| `timeAssumed` | `true` cuando no hay hora explícita en ninguna columna |

## 5. Dry-run real — métricas 2026-07-13

Comando:

```bash
deno run --allow-net --allow-env scripts/dry-run-malaga-open-data-csv.ts
```

| Métrica                                    | Valor    |
| ------------------------------------------ | -------- |
| Duración                                   | 484 ms   |
| Filas descargadas                          | 907      |
| Filas parseadas y canonicalizadas          | 907      |
| Filas rechazadas                           | 0        |
| Futuras/vigentes (≥ ahora)                 | **66**   |
| Pasadas                                    | 841      |
| Sin recinto (`venueName`)                  | 0        |
| Sin dirección (`venueAddress`)             | 479      |
| Sin `locality`                             | 0        |
| Sin URL específica (usa fallback CSV)      | 567      |
| Sin descripción                            | 0        |
| **Horas explícitas**                       | **707**  |
| **Horas asumidas (`timeAssumed=true`)**    | **200**  |
| Con `endAt`                                | 403      |
| Dedupe keys únicos                         | 567      |
| Colapsados por fingerprint                 | 340      |
| Filas con `external_id` duplicado          | 827      |
| Filas con `sourceUrl` duplicado            | 874      |

> El `ID_EVENTO` aparece repetido porque el CSV emite una fila por
> `ESPECIALIDAD`. El motor de dedupe existente (título · recinto ·
> localidad · minuto Madrid) las colapsa a 567 candidatos únicos.

Top 5 categorías: Cursos y talleres (359) · Espectaculos (118) ·
Música (68) · Colectivo (61) · Congresos, conferencias y festivales (59).

Top 5 recintos: La Caja Blanca (193) · Málaga capital (116) ·
Biblioteca Manuel Altolaguirre (73) · Biblioteca Cristóbal Cuevas (56) ·
MuCAC – La Coracha (29).

### 5.a Previews sanitizados (5 primeros)

Verificación clave: `04/01/2026` con `HORARIO="17 a 20 horas"` produce
`startAt=2026-01-04T16:00:00Z` (17:00 Madrid invierno, offset +01:00) y
`endAt=2026-01-04T19:00:00Z`. **NO** aparece la falsa hora 01:00.

```
2026-01-04T16:00:00Z  assumed=false  Pasacalle de Reyes 2026 D11  Solar Avda. Plutarco  Fiestas populares
2026-01-04T16:00:00Z  assumed=false  Pasacalle de Reyes 2026 D11  Solar Avda. Plutarco  Colectivo
2026-01-03T10:00:00Z  assumed=false  Pasacalle de Reyes 2026 D11  Solar Avda. Plutarco  Fiestas populares
…
```

## 6. Prueba de no-escritura

| Momento              | `SELECT COUNT(*) FROM events` |
| -------------------- | ----------------------------- |
| Antes del dry-run    | **1430**                      |
| Después del dry-run  | **1430**                      |
| Diff                 | **0 (idéntico)**              |

Adicional:

- Estado registrado en `event_sources`:

  ```
  slug             = malaga-open-data-csv
  adapter_key      = malaga-open-data-csv
  enabled          = false
  robots_ok        = false
  write_confirmed_at = NULL
  terms_reviewed_at  = NULL
  paused_reason    = 'awaiting_admin_gate'
  licence          = 'CC BY 4.0'
  ```

- El gate `authorizeWrite` sigue exigiendo simultáneamente
  `writeEnabled=true`, `enabled=true`, `robots_ok=true`,
  `write_confirmed_at IS NOT NULL`, `adapter_key` coincidente y
  `maxWrites ≤ 50`.
- El módulo es una función pura; no importa `supabase-js` y no llama
  `insert/update/upsert/delete`.

## 7. Cómo hacer la **primera importación controlada** (mínimo paso)

Todos los pasos requieren rol admin autenticado; ninguno se ejecuta desde
cliente público:

1. **Firmar términos** (una sola vez):
   ```sql
   update public.event_sources
     set terms_reviewed_at = now()
     where slug = 'malaga-open-data-csv';
   ```
2. **Confirmar robots** desde el panel admin, que llama a
   `admin-source-confirm-robots` (marca `robots_ok=true`).
3. **Confirmar escritura** desde el panel admin, que llama a
   `admin-source-confirm-write` (marca `write_confirmed_at=now()`,
   `write_confirmed_by=<admin uid>`).
4. **Habilitar la fuente**:
   ```sql
   update public.event_sources
     set enabled = true, paused_reason = null
     where slug = 'malaga-open-data-csv';
   ```
5. **Primer dry-run administrado** (sin escritura) para validar en
   producción real:
   `POST /functions/v1/admin-ingest-dry-run { "slug": "malaga-open-data-csv" }`.
6. **Primera importación acotada** vía `admin-ingest` con `maxWrites=25`
   (o menor). El gate `authorizeWrite` rechaza cualquier ejecución que no
   cumpla las condiciones anteriores.

Cualquier fallo en 1–4 deja la fuente en el mismo estado actual: cero
riesgo de escritura no autorizada.

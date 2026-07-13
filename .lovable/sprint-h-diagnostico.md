# Sprint H — Diagnóstico "eventos a las 02:00" y propuesta segura

## H0 · Causa raíz

623 filas en `public.events` tienen `start_at` con **hora exacta `00:00:00 UTC`**.
En Europe/Madrid eso se renderiza como:

- **01:00** en horario de invierno (UTC+1)
- **02:00** en horario de verano (UTC+2)

No es un bug de timezone ni del formatter: es un patrón de dato "fecha sin
hora" (ingestas legacy) codificado como medianoche UTC.

Distribución de horas locales (últimos 30 días de eventos):

| local hour | count |
|-----------:|------:|
| 01         | 8     |
| **02**     | **89**|
| 20         | 35    |
| 22         | 129   |
| 23         | 64    |

Los venues más afectados por el patrón midnight-UTC (365d):

| venue                                              | rows |
|----------------------------------------------------|-----:|
| La Caja Blanca                                     | 127  |
| Museo Picasso Málaga                               | 43   |
| Bibliotecas Públicas Municipales (varias)          | 100+ |
| FYCMA                                              | 21   |
| **La Térmica**                                     | **19** |
| Museos MUCAC / La Coracha                          | 20+  |
| La Cochera Cabaret                                 | 10   |

**Conclusión:** el problema afecta a muchos más venues que La Térmica.
Es sistémico y viene de ingestas donde no había hora explícita.

## H0.1 · Fix aplicado (UI, seguro, no toca datos)

- Nuevo helper `src/lib/eventTime.ts` con `hasExplicitTime()` /
  `isMidnightUtc()`.
- `src/components/events/EventCard.tsx` y `src/pages/EventDetailPage.tsx`
  ahora, cuando el evento es midnight-UTC, muestran **"Hora por confirmar"**
  (i18n en 10 idiomas: `events.timeTBC`) en lugar del falso `02:00`.
- Los eventos con hora real (Cervantes, Soho, etc.) siguen mostrando su
  hora normalmente.
- `end_at` sólo se muestra si también tiene hora explícita.

## H0.2 · Propuesta SQL — NO EJECUTADA

Requiere aprobación explícita. Dos opciones seguras:

### Opción A — "Marcar como hora asumida" en el JSON `raw`

```sql
-- Preview:
SELECT id, title, venue_name, start_at
FROM public.events
WHERE EXTRACT(HOUR FROM start_at AT TIME ZONE 'UTC') = 0
  AND EXTRACT(MINUTE FROM start_at AT TIME ZONE 'UTC') = 0
  AND EXTRACT(SECOND FROM start_at AT TIME ZONE 'UTC') = 0;
-- 623 filas esperadas.

-- Update propuesto (NO ejecutar sin aprobación):
UPDATE public.events
SET raw = COALESCE(raw, '{}'::jsonb) || jsonb_build_object(
  'timeAssumed', true,
  'timeSource', 'legacy_midnight_utc'
)
WHERE EXTRACT(HOUR FROM start_at AT TIME ZONE 'UTC') = 0
  AND EXTRACT(MINUTE FROM start_at AT TIME ZONE 'UTC') = 0
  AND EXTRACT(SECOND FROM start_at AT TIME ZONE 'UTC') = 0;
```

Ventaja: no cambia `start_at`. La UI ya cubre este caso.

### Opción B — Reasignar a 20:00 Europe/Madrid

```sql
-- NO ejecutar. Cambio destructivo.
UPDATE public.events
SET start_at = (
  (start_at AT TIME ZONE 'UTC')::date::timestamp
  + interval '20 hours'
) AT TIME ZONE 'Europe/Madrid'
WHERE ...
```

Desaconsejada: sobrescribe información con un dato inventado.

**Recomendación: Opción A**, y mantener la corrección de UI como
fuente de verdad visual.

## Fases pendientes de este sprint

- H1 (data-quality harness), H2 (parser dedicado La Térmica), H3
  (catálogo completo de salas/teatros en dropdown), H4 (QA de filtros),
  H5 (parsers dedicados MVA/Cánovas/museos), H6 (Playwright).

Estas fases **no** se han cerrado en este run. La corrección de raíz
del síntoma visible (02:00) sí está cerrada. El siguiente paso técnico
recomendado es aprobar la Opción A y arrancar H2 (parser La Térmica
dedicado con WP-JSON REST) en un run enfocado.

## Safety gates — sin cambios

- `events` count: **1430** (sin cambios)
- `event_sources.enabled=true`: **0**
- `event_sources.robots_ok=true`: **0**
- `event_sources.write_confirmed_at NOT NULL`: **0**
- No migraciones, no RLS, no auth, no routing, no cron.

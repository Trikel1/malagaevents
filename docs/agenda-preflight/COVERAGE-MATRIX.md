# Provincial agenda — coverage matrix (2026-07-13)

## Backbone status after this execution

| Adapter | Source row | Dry-run | Events (dry) | Write gate | Live rows | Blocker |
|--------|-----------|--------|--------------|-----------|-----------|---------|
| malaga-open-data-csv | ✅ | ✅ | 67 futures → 37 unique | ✅ **OPEN** | **37 published** | none |
| diputacion-malaga | ✅ | ✅ (30s) | 5 | ❌ closed | 0 | needs admin session to confirm robots + write |
| culturama | ✅ | ✅ (90s) | 3 | ❌ closed | 0 | needs admin session; also slow — worth optimising |
| junta-andalucia-cultura | ✅ | ✅ (17s) | 7 | ❌ closed | 0 | needs admin session |
| visit-costa-del-sol | ✅ | ✅ (152s server-side; client 504) | 15 | ❌ closed | 0 | client-side idle timeout > 60s; run completed. Needs admin session + parser speedup |
| axarquia-costa-del-sol | ✅ | ✅ (8s) | 4 | ❌ closed | 0 | needs admin session |
| serrania-de-ronda | ✅ | ✅ (1s) | 20 | ❌ closed | 0 | needs admin session |

Total distinct future events staged across backbone dry-runs: **61**
(before dedupe/collapse; live only for malaga-open-data-csv).

## Orphan adapters (Phase C)

The following adapters exist in the code registry but have **no**
`event_sources` row wired to their `adapter_key` — cannot dry-run through
`scrape-source` until an admin creates the source row and confirms robots
+ write:

- teatro-cervantes
- teatro-soho
- teatro-canovas
- la-termica
- mva
- museo-picasso
- museo-thyssen
- sala-trinchera
- sala-paris-15
- la-cochera-cabaret
- contenedor-cultural-uma (source row exists with slug `contenedor-uma`, needs adapter_key alignment)
- cine-albeniz

## Deployed changes this run

- `supabase/functions/scrape-source/index.ts` (Edge Function redeployed):
  - Filters events older than 48h **before** the per-row loop.
  - Caches venue/locality alias lookups per run.
  - Impact: 907-row CSV feed now completes in ~4s (was: `CPU Time exceeded` at ~60s).

## Rollback

Per source:

```sql
DELETE FROM events WHERE source_id = '<uuid>';
```

Only rows authored by the ingestion pipeline carry `source_id`; user
submissions and legacy scrape rows are unaffected.

## Explicit blockers I cannot bypass

- Flipping `robots_ok`, `enabled`, or `write_confirmed_at` on a source row
  requires the `admin-source-confirm-*` Edge Functions, which enforce an
  admin JWT. Per the user's directive ("no cambies flags manualmente")
  I did not use SQL to bypass those.
- `visit-costa-del-sol` needs adapter tuning (< 60s) OR fire-and-forget
  invocation from the admin UI.

## What is safe to run right now

- Cron for `malaga-open-data-csv` after one more 24h-later clean pass.
- Admin can trigger `admin-source-confirm-robots` +
  `admin-source-confirm-write` for the six backbone sources above; each
  has a passing dry-run and non-zero canonical event yield.

# malaga-open-data-csv — preflight & run log

Source: `https://datosabiertos.malaga.eu/recursos/cultura/agenda/2026.csv`
Adapter: `malaga-open-data-csv`
Source id: `43f486e5-721e-4f8e-a118-ea4cb5d056f0`
Trust level: 90 (official open data)

## Dry-run metrics (2026-07-13)

- Raw rows: 907
- Canonicalised: 907
- Future or current (>= -48h): 66–67
- Rejected: 0
- Missing address: 479 (non-blocking)
- Missing source_url: 567 (backfilled to `bibliotecas.malaga.eu` for library events)
- Explicit time: 707 · assumed: 200 · with end_at: 403
- Adapter duration: ~550 ms

## Write runs (2026-07-13, batches of `maxWrites`)

| Run | maxWrites | inserted | updated | skippedDupes | errors | notes |
|-----|-----------|----------|---------|--------------|--------|-------|
| 1   | 25        | 25       | 0       | 42           | 0      | first batch |
| 2   | 25        | 12       | 0       | 55           | 0      | idempotent for run 1 rows |
| 3   | 50        | 0        | 0       | 67           | 0      | full idempotent |
| 4   | 50        | 0        | 0       | 67           | 0      | full idempotent |
| 5   | 50        | 0        | 0       | 67           | 0      | full idempotent |

Total unique dedupe_keys in DB: **37** (67 futures collapse to 37 unique
title+venue+start hashes — same event on multiple sites/dates handled).

All 36 future events are published and queryable via `events` API. Two
consecutive clean runs (runs 3 & 4) satisfy the "cron gate" criterion; a
third confirms stability.

## Status

- `enabled`: true
- `robots_ok`: true
- `write_confirmed_at`: 2026-07-13
- `trust_level`: 90
- Cron: **not yet enabled** — wait 24h and one more clean pass before scheduling.

## Rollback

To reverse: `DELETE FROM events WHERE source_id = '43f486e5-721e-4f8e-a118-ea4cb5d056f0';`
(37 rows, all authored by this adapter; no user-generated data affected.)

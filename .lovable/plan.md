# Repair scheduled culture/pharmacy sync + FYCMA reconciliation (plan only)

## 1. Diagnosis (read-only evidence, 2026-10-12)

Cron route (metadata only, no commands or headers printed):

```text
job 1 scrape-malaga-events-daily  06:00 UTC -> /functions/v1/scrape-events     x-sync-key: yes  timeout_ms: none
job 2 sync-events-every-6h        */6h      -> /functions/v1/sync-events       x-sync-key: yes  timeout_ms: none
job 4 sync-sports-hourly          hourly    -> /functions/v1/sync-sports       x-sync-key: yes  timeout_ms: none
job 5 refresh-pharmacies-directory 04:00    -> /functions/v1/scrape-pharmacies x-sync-key: yes  timeout_ms: none
job 6 sync-sports-normalized      */2h      -> /functions/v1/sync-sports-normalized
```

Handler gates:
- scrape-events, sync-events, scrape-pharmacies -> `authorizeAdminRequest` (`_shared/security.ts:471`): compares header to the **environment** `SYNC_SPORTS_KEY` only; else requires admin JWT -> 401.
- sync-sports (`index.ts:745-755`) and sync-sports-normalized (`:48-57`): environment compare, **then** `verify_sync_sports_key` RPC fallback (compares against **Vault**).

Outcomes:
- Sports last success 2026-10-12 14:01 (works). Culture last run 2026-09-07 18:02; pharmacy last rota 2026-09-07 (both stopped).
- Retained pg_net responses (10 total): 1x 401, 9x "Timeout of 5000 ms reached".

Conclusion (likely, not proven): cron jobs 1/2/5 send the Vault value since the 2026-09-07 header change. Sports passes via the Vault RPC fallback; the three env-only handlers do not, which is consistent with an env/Vault mismatch. The 5 s timeouts are the pg_net default (no `timeout_milliseconds`). These only mean the caller stopped waiting, not that the handler failed. 
Uncertainty: I cannot compare the values without exposing them, and only 10 responses are retained, so I cannot map each one to a job. The repair below fixes the issue either way.

## 2. Isolated auth/timeout repair

Files (only these):
- `supabase/functions/_shared/security.ts`: in `authorizeAdminRequest`, when the environment compare fails and an `x-sync-key` is present, call the existing `verify_sync_sports_key` RPC with a service-role client (same pattern as sync-sports). Constant-time env path unchanged. JWT+`has_role` path unchanged. No new secrets, no relaxed checks. Add an injectable dep for tests.
- `supabase/functions/_shared/security_test.ts` / `src/test/` existing guard tests: add cases for env match, Vault-only match, both mismatch -> 401, missing header -> 401.
- Deploy only scrape-events, sync-events, scrape-pharmacies (the functions that import it; discover-sources also imports it and will be redeployed, but no behaviour change for JWT callers).

DB impact (owner runs, via existing connector, as before): `cron.alter_job` for jobs 1, 2, 5 only, adding `timeout_milliseconds := 60000` inside the existing `net.http_post` call. The header stays the same and nothing is printed. 
Rollback: redeploy previous function versions; `cron.alter_job` back to the prior command (owner keeps a copy).

Bounded validation:
1. Unit tests + typecheck.
2. Anonymous POST to each of the 3 functions -> 401 (unchanged).
3. One pharmacy run, `dryRun: true`, single zone, via the admin-JWT path -> 200, no writes.
4. After the next scheduled 04:00/06:00 runs: new `sync_runs` row, `pharmacies_guard` row covering today, pg_net status 200 (status only).

## 3. FYCMA reconciliation (dry-run first, no bulk enable)

Use the existing adapter `_shared/adapters/fycma.ts` + `admin-fycma-reconcile-dry-run`. Code fixes:
- Identity: match by Tribe `id` (`external_id`), then by detail `url`. Never key by title. Existing rows keep their `id`, so favorites stay intact. Rows that no longer exist officially get `lifecycle_status`, not delete.
- Time: `madridWallToIso` uses one offset guess. Near DST it can shift the hour by 1 (Revolver: 21:00 shows as 22:00). Prefer `utc_start_date`/`utc_end_date` from the API when present. Add a fixture test for Dec 12 21:00 and a DST-edge date.
- all_day: store as day-only (no fabricated hour), with an `end_at` for the final day. This fixes AGRITECH showing Nov 3 (a midnight UTC shift).
- Multi-day: keep `end_at` from `end_date` (Congress Oct 15-16).
- Category: Tribe categories plus a title fallback (congreso/salón/feria -> conferences/other). No blanket `exhibitions`.
- Venue: link `venue_id` to the existing FYCMA venue row via `venue_aliases` (lookup, no new venue).
Validation: dry-run diff of 38 official vs 6 existing (insert/update/unchanged counts, 3 named cases checked by field). The owner confirms robots and write for the FYCMA source through the existing admin buttons. Then one gated write (maxWrites cap). Visible check: Playwright `/events?q=AGRITECH`, Revolver detail, and Congress detail show official dates, Madrid times and FYCMA venue. A favorited FYCMA event still resolves.

## 4. Needs more evidence before acting

- Env vs Vault mismatch: confirmed only indirectly. The fallback fixes it either way.
- Whether timeouts hide successful handler runs: check edge logs for jobs 1/2/5 after the fix.
- Legacy `sources_config` FYCMA entry: decide whether to disable it after the new source writes, to avoid double ingestion. Owner decision.
- Utc fields presence in every FYCMA payload: verify in the dry-run output.
- Pharmacy source availability today: verified only by the dry-run in step 3.

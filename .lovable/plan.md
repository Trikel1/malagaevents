
# Implementation Plan: Sports Mode Backend (Migration + Edge Function)

## Current State

- **sports_events** table exists but is missing 3 columns: `normalized_title`, `normalized_venue`, `start_date`
- **Indexes** `idx_sports_events_start` and `idx_sports_events_cat_start` already exist (different names than planned)
- **Triggers** exist on `sports_events` (`trg_sports_events_updated_at`) but NOT on `sports_sources` or `sports_venues`
- **Functions** `set_updated_at()` and `sports_is_admin()` do NOT exist yet
- **0 rows** in sports_events, so backfill is trivial
- `FIRECRAWL_API_KEY` secret exists; `SYNC_ADMIN_KEY` does NOT exist yet

## Step 1: Database Migration

Single migration that:
1. Adds 3 missing columns (`normalized_title`, `normalized_venue`, `start_date`) using `ADD COLUMN IF NOT EXISTS`
2. Backfills `start_date` with timezone-aware conversion, then fallback to `now()` for any remaining NULLs
3. Sets `start_date` as NOT NULL
4. Creates `set_updated_at()` trigger function
5. Creates `sports_is_admin()` placeholder function (NOT used for write RLS -- all writes via SERVICE_ROLE)
6. Adds triggers on `sports_sources` and `sports_venues` using safe DO blocks (checking `pg_trigger`)
7. Creates only `idx_sports_events_start_date` index (the other two already exist with different names)

## Step 2: Edge Function

Create `supabase/functions/sync-sports/index.ts`:
- Uses the exact Firecrawl v1/scrape pattern from `sync-events` (POST with `formats: ['json']`, `jsonOptions`, `onlyMainContent`, `waitFor`, `timeout`, AbortController)
- Security: `x-admin-key` header validated against `SYNC_ADMIN_KEY` env var
- Domain allowlist: 10 approved sport domains
- Per-source cooldown via `last_sync_at`
- Source-specific extraction prompts for football, basketball, running, triathlon, federation
- SHA-256 dedupe_key generation
- Upserts into `sports_events` on conflict `dedupe_key`
- Logs in `sports_sync_runs`, updates `sports_sources`
- All DB writes via SERVICE_ROLE (bypasses RLS)

## Step 3: Config

The `supabase/config.toml` is auto-managed. The function will be deployed via the deploy tool.

## Step 4: Request SYNC_ADMIN_KEY

After deployment, request the secret from the user.

## Files Changed

| File | Action |
|------|--------|
| Migration SQL (via tool) | NEW |
| `supabase/functions/sync-sports/index.ts` | NEW |

## Files NOT Changed

All cultural event files, hooks, pages, components, and existing edge functions remain untouched.

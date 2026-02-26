

# Plan: Admin Sports Sync -- JWT-Protected Proxy + Admin UI

## Overview

Create a JWT-protected edge function that proxies to `sync-sports`, and add a "Deportes" tab to the Admin page with a sync button and recent runs list.

## Files Changed

| File | Action |
|------|--------|
| `supabase/functions/admin-sync-sports/index.ts` | CREATE |
| `src/pages/AdminPage.tsx` | EDIT (add Deportes tab) |

Note: `supabase/config.toml` is auto-managed and will be configured via the deploy tool.

## Step 1: Edge Function `admin-sync-sports/index.ts`

**Security flow:**
1. `verify_jwt = true` in config -- platform enforces valid JWT before the function runs
2. Create a user-scoped Supabase client using the request's `Authorization` header
3. Call `supabase.auth.getUser()` to get the authenticated user's ID
4. Create a SERVICE_ROLE client, query `user_roles` table for `role = 'admin'` where `user_id = uid`
5. If not admin, return 403
6. If admin, internally `fetch()` the `sync-sports` function at `${SUPABASE_URL}/functions/v1/sync-sports` with:
   - `x-admin-key: SYNC_ADMIN_KEY` (from env, never exposed to client)
   - Forward `{ force, cooldownMinutes }` from request body
7. Also query last 10 `sports_sync_runs` via SERVICE_ROLE client
8. Return `{ ok, syncResult, recentRuns }`

**Config entry:**
```text
[functions.admin-sync-sports]
verify_jwt = true
```

## Step 2: Admin Page -- "Deportes" Tab

Add to the existing `TabsList` in `AdminPage.tsx`:

**New tab trigger:** "Deportes" (4th tab)

**Tab content includes:**
- **Sync button** ("Sync Deportes ahora"): Calls `supabase.functions.invoke('admin-sync-sports', { body: { force: true, cooldownMinutes: 0 } })`. Shows loading spinner, success/error toast.
- **Recent runs list**: After sync completes (or on tab load), display last 10 `sports_sync_runs` from the response. Each row shows:
  - `started_at` (formatted date)
  - `source_slug`
  - `status` (color-coded Badge: green for completed, red for failed, yellow for running)
  - `items_upserted` / `items_failed` counts
  - Truncated `error_sample` if present

Uses existing Card, Badge, Button, Loader2 components -- no new components or files.

## Security Summary

- `SYNC_ADMIN_KEY` stays server-side only (edge function env var)
- Client sends standard JWT via `supabase.functions.invoke()` (automatic)
- Admin check uses existing `user_roles` table + `has_role` pattern (queried via SERVICE_ROLE)
- `verify_jwt = true` provides platform-level JWT enforcement
- No new secrets needed (all exist already)


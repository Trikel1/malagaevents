

# Plan: Sports Mode Database + Scraping Pipeline + Frontend Integration

## Files to Create/Edit

**New files:**
- `supabase/functions/sync-sports/index.ts` -- Edge function for scraping sports events
- `src/hooks/useSportsEvents.ts` -- React Query hooks for sports data

**Database migration (via migration tool):**
- Create tables: `sports_sources`, `sports_events`, `sports_venues`, `sports_sync_runs`
- Add indexes, RLS policies, and seed data

**Seed data (via insert tool):**
- 10 sports_sources rows (one per URL)
- ~10 sports_venues rows (Malaga core venues)

**Edited files:**
- `src/types/sports.ts` -- Add `running`, `triathlon`, `federation` categories + icons
- `src/components/sports/SportsContent.tsx` -- Use DB data instead of mocks
- `src/components/sports/SportEventCard.tsx` -- Accept DB event shape
- `src/pages/CalendarPage.tsx` -- Sports branch uses DB data
- `src/pages/VenuesPage.tsx` -- Use DB venues
- 9x `src/i18n/locales/*.json` -- Add running/triathlon/federation keys

## How Culture Mode is Protected

- Zero changes to `EventsPage.tsx`, `useEvents.ts`, `useEventsOptimized.ts`, `sync-events/`, or any cultural event tables/queries
- CalendarPage edits are scoped exclusively to the `appMode === 'deportes'` branches
- New tables (`sports_*`) are completely separate from `events`, `venues`, `locations`

## Security Choice for sync-sports

Using `verify_jwt = false` with a custom `x-admin-key` header checked against `SYNC_ADMIN_KEY` secret. This allows cron jobs to call it without a JWT while still preventing public access.

**Domain allowlist** (hardcoded in function):
`malagacf.com`, `koobin.com`, `unicajabaloncesto.com`, `entradas.com`, `ironman.com`, `maratonmalaga.com`, `zurichmaratonmalaga.es`, `runedia.mundodeportivo.com`, `sportmaniacs.com`, `tickets.rfef.es`

## Database Schema

### sports_sources
| Column | Type | Default |
|--------|------|---------|
| id | uuid PK | gen_random_uuid() |
| name | text NOT NULL | |
| slug | text UNIQUE NOT NULL | |
| url | text NOT NULL | |
| sport_category | text NOT NULL | 'other' |
| is_active | boolean | true |
| last_sync_at | timestamptz | null |
| last_error | text | null |
| items_fetched | int | 0 |
| items_upserted | int | 0 |
| created_at | timestamptz | now() |

RLS: Public SELECT, Admin ALL.

### sports_events
| Column | Type | Default |
|--------|------|---------|
| id | uuid PK | gen_random_uuid() |
| title | text NOT NULL | |
| sport_category | text NOT NULL | |
| competition | text | null |
| teams | text | null |
| start_datetime | timestamptz NOT NULL | |
| end_datetime | timestamptz | null |
| venue_name | text | |
| city | text | 'Malaga' |
| address | text | null |
| price_info | text | null |
| tickets_url | text | null |
| image_url | text | null |
| source_id | uuid FK | |
| source_url | text | null |
| external_id | text | null |
| dedupe_key | text UNIQUE | |
| status | text | 'scheduled' |
| created_at | timestamptz | now() |
| updated_at | timestamptz | now() |

Indexes: `(start_datetime)`, `(sport_category, start_datetime)`
RLS: Public SELECT, Admin ALL.

### sports_venues
| Column | Type | Default |
|--------|------|---------|
| id | uuid PK | gen_random_uuid() |
| name | text NOT NULL | |
| normalized_name | text | |
| sports | text[] | '{}' |
| city | text | 'Malaga' |
| address | text | null |
| lat | numeric | null |
| lng | numeric | null |
| created_at | timestamptz | now() |

RLS: Public SELECT, Admin ALL.

### sports_sync_runs
| Column | Type | Default |
|--------|------|---------|
| id | uuid PK | gen_random_uuid() |
| source_slug | text NOT NULL | |
| status | text | 'running' |
| started_at | timestamptz | now() |
| finished_at | timestamptz | null |
| items_fetched | int | 0 |
| items_parsed | int | 0 |
| items_upserted | int | 0 |
| items_failed | int | 0 |
| error_sample | text | null |

RLS: Admin-only SELECT + ALL.

## Edge Function: sync-sports

- CORS headers + OPTIONS handling
- Validates `x-admin-key` header against `SYNC_ADMIN_KEY` env var (returns 401 otherwise)
- Rate limits by IP (in-memory)
- Iterates active `sports_sources`
- For each source: scrapes via Firecrawl with JSON extraction schema for sport events
- Generates dedupe_key = hash of `title + start_datetime + venue_name + sport_category + source_url`
- Upserts into `sports_events` on conflict(dedupe_key)
- Logs run in `sports_sync_runs`, updates `sports_sources.last_sync_at`
- Domain allowlist prevents scraping non-approved URLs

## Frontend Hook: useSportsEvents

- `useSportsEvents(filters)` -- fetches from `sports_events` with optional sport_category, date range
- `useSportsVenues()` -- fetches from `sports_venues`
- Returns loading/error/data states
- Uses React Query with appropriate cache times

## i18n Additions (all 9 locales)

Add 3 new keys under `sports`: `running`, `triathlon`, `federation` with translations per language.

## Implementation Order

1. Database migration (create 4 tables + indexes + RLS)
2. Seed data (sources + venues)
3. Request SYNC_ADMIN_KEY secret
4. Create sync-sports edge function
5. Create useSportsEvents hook
6. Update sports.ts types
7. Update SportsContent, CalendarPage (sports branch), VenuesPage
8. Update 9 locale files



# End-to-End Sports Mode: Real Data + Venues Dropdown + Admin Sync

## Files to Create/Edit

| File | Action | Purpose |
|------|--------|---------|
| `supabase/functions/sync-sports/index.ts` | EDIT | Add missing domains + source prompts for all 10 sources |
| `supabase/functions/admin-sync-sports/index.ts` | EXISTS (no change needed) | Already correctly implements JWT proxy |
| `src/hooks/useSportsEvents.ts` | CREATE | React Query hooks for sports_events + sports_venues |
| `src/components/sports/SportsVenuesDropdown.tsx` | CREATE | Multi-select venue dropdown mirroring Culture VenueGroupDropdown |
| `src/components/sports/SportsContent.tsx` | EDIT | Replace mocks with DB hooks |
| `src/pages/CalendarPage.tsx` | EDIT | Sports branch uses DB instead of mocks |
| `src/pages/VenuesPage.tsx` | EDIT | Use sports_venues from DB |
| `src/types/sports.ts` | EDIT | Remove MOCK_SPORT_EVENTS, keep types/constants |
| `src/types/venues-sports.ts` | EDIT | Remove MOCK_SPORT_VENUES, keep interface |
| 9 locale JSON files | EDIT | Add `sports.allVenues` and `sports.loading` keys |

## How Culture Mode Stays Untouched

- All new hooks query `sports_events` and `sports_venues` tables only
- `SportsContent.tsx` is sports-only, never rendered in culture mode
- `CalendarPage.tsx` changes are inside `appMode === 'deportes'` guards -- culture branch unchanged
- `VenuesPage.tsx` only renders in deportes mode
- No changes to `events`, `venues`, `locations` tables or hooks
- No changes to routing, navigation, global styles

## ALLOWED_DOMAINS (exact hostnames covered)

The `isDomainAllowed` function matches `hostname === domain || hostname.endsWith("." + domain)`, so adding parent domains covers `www.` subdomains automatically:

```
malagacf.com          -> www.malagacf.com, malagacf.com
koobin.com            -> malagacf.koobin.com
unicajabaloncesto.com -> www.unicajabaloncesto.com
entradas.com          -> www.entradas.com
ironman.com           -> www.ironman.com
maratonmalaga.com     -> www.maratonmalaga.com
zurichmaratonmalaga.es -> www.zurichmaratonmalaga.es
mundodeportivo.com    -> runedia.mundodeportivo.com
sportmaniacs.com      -> www.sportmaniacs.com
rfef.es               -> tickets.rfef.es
```

Domains to ADD to the existing set (keeping existing ones):
- `koobin.com`
- `entradas.com`
- `maratonmalaga.com`
- `zurichmaratonmalaga.es`
- `mundodeportivo.com`
- `sportmaniacs.com`
- `rfef.es`

Domains to REMOVE (no longer needed since they have no seeded sources):
- `besoccer.com`, `rfaf.es`, `rfebm.com`, `atletismomalaga.com`, `triatlondemalaga.com`, `fam.es`, `juntadeandalucia.es`

Actually we keep the old ones for safety -- they do no harm and may be added as sources later.

## Query Strategy (start_date, Europe/Madrid)

The `sports_events` table has a `start_date` column (DATE type) derived in Madrid timezone. All filtering uses this column:

- **Today**: `start_date = 'YYYY-MM-DD'` where date is computed in Madrid TZ client-side using `formatInTimeZone(new Date(), 'Europe/Madrid', 'yyyy-MM-dd')`
- **Weekend**: `start_date IN (fri, sat, sun)` -- computed client-side
- **Upcoming 14d**: `start_date >= today AND start_date <= today+14`
- **Calendar month**: `start_date >= gridStart AND start_date <= gridEnd`
- **Selected day**: filter from already-fetched month data by `start_date === selectedDate`

---

## Detailed Implementation

### A) sync-sports/index.ts Changes

1. Add 7 new domains to `ALLOWED_DOMAINS`
2. Add source-specific prompts for all 10 DB slugs:
   - `malagacf` (exists)
   - `unicaja` (exists)
   - `ironman` (exists)
   - `malagacf-koobin`: "Extract upcoming Malaga CF football match tickets. Include match title, date, time, opponent, price, buy URL."
   - `entradas-com`: "Extract upcoming sports events in Malaga. Include title, date, time, venue, sport type, teams, ticket URL, price."
   - `maraton-malaga`: "Extract upcoming marathon and running events in Malaga. Include event title, date, time, start location, registration URL, distance."
   - `zurich-maraton`: "Extract upcoming Zurich Marathon Malaga race details. Include event title, date, time, start location, distances, registration URL."
   - `runedia`: "Extract upcoming running races and trail events near Malaga, Andalucia. Include race title, date, location/city, distance, registration URL."
   - `sportmaniacs`: "Extract upcoming sports and running events near Malaga. Include event title, date, location, sport type, registration URL."
   - `rfef-tickets`: "Extract upcoming Spanish football federation match tickets. Include match title, date, time, teams, competition, venue, ticket URL."

### B) useSportsEvents.ts (new hook)

Exports:
- `useSportsEvents({ fromDate?, toDate?, categories?, venueNames?, limit? })` -- main query
- `useSportsEventsToday()` -- wraps main with today's Madrid date
- `useSportsEventsWeekend()` -- wraps main with Fri/Sat/Sun dates
- `useSportsEventsByDay(date)` -- wraps main with single day
- `useSportsVenues()` -- queries sports_venues table

Maps DB `sports_events` rows to `SportEvent` interface:
- `id` -> `id`
- `sport_category` -> `sport`
- `title` -> `title`
- `teams` -> `teams`
- `competition` -> `competition`
- `start_datetime` -> `start_at`
- `venue_name` -> `venue`
- `city` -> `city`
- `tickets_url` -> `ticketsUrl`
- `image_url` -> `imageUrl`

### C) SportsContent.tsx

- Remove `MOCK_SPORT_EVENTS` import
- Import `useSportsEvents` and `useSportsVenues`
- Compute `fromDate`/`toDate` based on time filter (today/weekend/upcoming)
- Pass `selectedSport` as `categories` filter and venue selection as `venueNames`
- Add `SportsVenuesDropdown` to filter area
- Add loading/error/empty states

### D) SportsVenuesDropdown.tsx (new component)

Mirrors `VenueGroupDropdown.tsx` exactly:
- Popover with `avoidCollisions={true}`, `collisionPadding={16}`, `sticky="always"`
- `onOpenAutoFocus` prevented on mobile via `useIsMobile()`
- Command + CommandList with manual search input (no autoFocus)
- ScrollArea with `-webkit-overflow-scrolling: touch`, `overscroll-contain`
- Multi-select checkboxes
- "Todos los recintos" option at top
- Props: `selectedVenueNames: string[]`, `onSelectionChange: (names: string[]) => void`
- Uses `useSportsVenues()` for data

### E) CalendarPage.tsx (sports branch only)

- Replace `import { MOCK_SPORT_EVENTS }` with `useSportsEvents` hook
- `sportEventsForMonth`: call `useSportsEvents({ fromDate: gridStart, toDate: gridEnd })`
- `getSportEventsForDay`: filter fetched data by `start_date`
- `daysWithEvents`: computed from DB data
- All culture-mode code untouched

### F) VenuesPage.tsx

- Replace `MOCK_SPORT_VENUES` import with `useSportsVenues()` hook
- Add loading state
- Keep identical UI, just data source changes

### G) Types cleanup

- `src/types/sports.ts`: Remove `MOCK_SPORT_EVENTS` array (lines 43-144), keep `SportEvent`, `SPORT_CATEGORIES`, `SportCategory`, `SPORT_ICONS`, `SPORT_LABELS`
- `src/types/venues-sports.ts`: Remove `MOCK_SPORT_VENUES` array (lines 13-24), keep `SportVenue` interface

### H) i18n (all 9 locales)

Add two keys to the `sports` section of each locale:
- `sports.allVenues` -- "Todos los recintos" (es), "All venues" (en), etc.
- `sports.loading` -- "Cargando..." (es), "Loading..." (en), etc.

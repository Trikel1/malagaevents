/**
 * The Events Calendar (WordPress "Tribe") REST adapter.
 *
 * Many municipal and venue agendas in Málaga run on this plugin and expose a
 * complete, paginated feed at /wp-json/tribe/events/v1/events. Reading it is
 * strictly better than scraping the listing HTML: it carries the source's own
 * identifier and canonical URL, the published image, the cost string and the
 * all-day flag, and it paginates over the whole upcoming programme instead of
 * the first page only.
 *
 * Nothing here invents data: a field absent from the feed stays absent.
 */

export interface TribeOccurrence {
  /** ISO date, YYYY-MM-DD, in the venue's local calendar. */
  date: string;
  /** HH:MM when the source published a time; undefined for all-day entries. */
  time?: string;
  end_time?: string;
}

export interface TribeNormalizedEvent {
  externalId: string;
  eventUrl: string;
  title: string;
  description?: string;
  occurrences: TribeOccurrence[];
  /** Only when the feed publishes a venue; never defaulted. */
  venue?: string;
  city?: string;
  address?: string;
  imageUrl?: string;
  ticketUrl?: string;
  price?: string;
  isFree?: boolean;
  categories: string[];
  allDay: boolean;
  /** Cancelled / postponed, when the feed states it. */
  scheduleStatus?: 'scheduled' | 'canceled' | 'postponed';
}

export interface TribeFetchResult {
  ok: boolean;
  /** 'complete' only when every page of the feed was read. */
  coverage: 'complete' | 'partial' | 'none';
  endpoint: string | null;
  httpStatus?: number;
  pagesVisited: number;
  totalReported: number | null;
  events: TribeNormalizedEvent[];
  error?: string;
}

export type FetchLike = (url: string) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

export function tribeEndpointFor(baseUrl: string): string | null {
  try {
    const url = new URL(baseUrl);
    return `${url.origin}/wp-json/tribe/events/v1/events`;
  } catch {
    return null;
  }
}

const splitDateTime = (value: unknown): { date: string; time?: string } | null => {
  if (typeof value !== 'string') return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (!match) return null;
  const [, y, m, d, hh, mm] = match;
  const date = `${y}-${m}-${d}`;
  if (hh === undefined) return { date };
  return { date, time: `${hh}:${mm}` };
};

const asText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const clean = value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
  return clean || undefined;
};

export function mapTribeEvent(raw: Record<string, unknown>): TribeNormalizedEvent | null {
  const title = asText(raw.title);
  const eventUrl = typeof raw.url === 'string' ? raw.url : '';
  const externalId = typeof raw.global_id === 'string' && raw.global_id
    ? raw.global_id
    : raw.id !== undefined && raw.id !== null
      ? String(raw.id)
      : '';
  if (!title || (!eventUrl && !externalId)) return null;

  const allDay = raw.all_day === true;
  const start = splitDateTime(raw.start_date);
  if (!start) return null;
  const end = splitDateTime(raw.end_date);

  const venueRaw = raw.venue as Record<string, unknown> | unknown[] | undefined;
  const venueObj = venueRaw && !Array.isArray(venueRaw) ? venueRaw : undefined;

  const imageRaw = raw.image as Record<string, unknown> | undefined;
  const imageUrl = imageRaw && typeof imageRaw.url === 'string' ? imageRaw.url : undefined;

  const cost = asText(raw.cost);
  // "Precio desconocido" is never "Gratis": free only when the feed says so.
  const isFree = cost ? /^(gratis|free|gratuito|entrada libre|0\s*€?)$/i.test(cost) : undefined;

  const categories = Array.isArray(raw.categories)
    ? (raw.categories as Array<Record<string, unknown>>)
        .map((c) => (typeof c?.name === 'string' ? c.name : null))
        .filter((c): c is string => Boolean(c))
    : [];

  const statusRaw = typeof raw.status === 'string' ? raw.status.toLowerCase() : '';
  const scheduleStatus = statusRaw === 'canceled' || statusRaw === 'cancelled'
    ? 'canceled'
    : statusRaw === 'postponed'
      ? 'postponed'
      : undefined;

  return {
    externalId: externalId || eventUrl,
    eventUrl,
    title,
    description: asText(raw.description) ?? asText(raw.excerpt),
    occurrences: [{
      date: start.date,
      time: allDay ? undefined : start.time,
      end_time: allDay ? undefined : end?.time,
    }],
    venue: venueObj && typeof venueObj.venue === 'string' ? asText(venueObj.venue) : undefined,
    city: venueObj && typeof venueObj.city === 'string' ? asText(venueObj.city) : undefined,
    address: venueObj && typeof venueObj.address === 'string' ? asText(venueObj.address) : undefined,
    imageUrl,
    ticketUrl: typeof raw.website === 'string' && raw.website ? raw.website : eventUrl || undefined,
    price: cost,
    isFree,
    categories,
    allDay,
    scheduleStatus,
  };
}

/**
 * Reads the whole upcoming feed, page by page. Stops at `maxPages` and reports
 * `partial` coverage instead of pretending the agenda was fully read.
 */
export async function fetchTribeEvents(
  baseUrl: string,
  fetchFn: FetchLike,
  options: { perPage?: number; maxPages?: number } = {},
): Promise<TribeFetchResult> {
  const endpoint = tribeEndpointFor(baseUrl);
  const perPage = options.perPage ?? 50;
  const maxPages = options.maxPages ?? 6;
  const base: TribeFetchResult = {
    ok: false, coverage: 'none', endpoint, pagesVisited: 0, totalReported: null, events: [],
  };
  if (!endpoint) return { ...base, error: 'invalid base url' };

  const events: TribeNormalizedEvent[] = [];
  const seen = new Set<string>();
  let pagesVisited = 0;
  let totalReported: number | null = null;
  let totalPages = 1;
  let lastStatus: number | undefined;

  for (let page = 1; page <= Math.min(totalPages, maxPages); page++) {
    let response;
    try {
      response = await fetchFn(`${endpoint}?per_page=${perPage}&page=${page}`);
    } catch (error) {
      return {
        ...base,
        pagesVisited,
        totalReported,
        events,
        coverage: events.length > 0 ? 'partial' : 'none',
        error: error instanceof Error ? error.message : String(error),
      };
    }
    lastStatus = response.status;
    if (!response.ok) {
      // A 404 means the plugin is simply not installed — not an outage.
      return {
        ...base,
        httpStatus: response.status,
        pagesVisited,
        totalReported,
        events,
        coverage: events.length > 0 ? 'partial' : 'none',
        error: `HTTP ${response.status}`,
      };
    }

    let payload: any;
    try {
      payload = await response.json();
    } catch (error) {
      return {
        ...base,
        httpStatus: response.status,
        pagesVisited,
        events,
        coverage: events.length > 0 ? 'partial' : 'none',
        error: 'invalid JSON',
      };
    }
    pagesVisited++;
    if (typeof payload?.total === 'number') totalReported = payload.total;
    if (typeof payload?.total_pages === 'number') totalPages = payload.total_pages;

    const list = Array.isArray(payload?.events) ? payload.events : [];
    for (const raw of list) {
      const mapped = mapTribeEvent(raw as Record<string, unknown>);
      if (!mapped) continue;
      if (seen.has(mapped.externalId)) continue;
      seen.add(mapped.externalId);
      events.push(mapped);
    }
    if (list.length === 0) break;
  }

  const paginationComplete = totalPages <= maxPages;
  return {
    ok: true,
    coverage: paginationComplete ? 'complete' : 'partial',
    endpoint,
    httpStatus: lastStatus,
    pagesVisited,
    totalReported,
    events,
  };
}

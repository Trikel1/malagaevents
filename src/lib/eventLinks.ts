/**
 * Outbound links for a cultural event: tickets / official page / directions.
 *
 * Honesty rules:
 * - Nothing is invented. A link is only offered when the record actually
 *   carries one and it parses as a real http(s) destination.
 * - Data files (the open-data CSV dumps) and bare listing pages are NOT the
 *   event's own page, so they never become a user-facing link.
 * - "Ver entradas" is only claimed for known ticketing destinations; anything
 *   else is presented as the official page.
 */

export type TicketActionKind = 'tickets' | 'register' | 'official' | 'pending';

export interface TicketAction {
  kind: TicketActionKind;
  url: string | null;
  /** Host shown to the user so the destination is never a surprise. */
  host: string | null;
}

/** Ticketing platforms — a link here really does sell/allocate seats. */
const TICKETING_HOSTS = [
  'unientradas.es',
  'giglon.com',
  'ticketandroll.com',
  'crashmusic.es',
  'entradas.com',
  'ticketmaster.es',
  'eventbrite.es',
  'eventbrite.com',
  'wegow.com',
  'mutick.com',
  'janto.es',
  'vivaticket.com',
  'atrapalo.com',
  'koobin.com',
  'tomaticket.es',
  'compralaentrada.com',
  'enterticket.es',
  'tickelia.com',
  'redentradas.com',
];

const TICKET_PATH_HINTS = ['/entradas', '/tickets', '/comprar', '/venta', '/taquilla'];
const REGISTER_PATH_HINTS = ['/inscri', '/registro', '/register', '/matricula', '/apunta'];

/** Open-data dumps and other machine files are never a page for a human. */
const DATA_FILE_RE = /\.(csv|json|xml|ics|rss|txt|zip)(\?|#|$)/i;

/** Listing pages that show many events at once — not this event's page. */
const LISTING_PATHS = [
  '/la-ciudad/agenda/',
  '/agenda/',
  '/eventos/',
  '/events/',
  '/cartelera/',
];

const stripWww = (host: string) => host.replace(/^www\./i, '');

/**
 * Accepts an absolute http(s) URL, or a bare domain such as
 * `www.example.com` which some sources store without a scheme.
 * Returns an https-first absolute URL, or null when it is not usable.
 */
export function normalizeExternalUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  if (!value) return null;

  let candidate = value;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(candidate)) {
    // Bare domain (must look like one) — assume https, never http.
    if (!/^[\w-]+(\.[\w-]+)+(\/|$|\?)/.test(candidate)) return null;
    candidate = `https://${candidate}`;
  }

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  // Prefer a secure destination; http pages are still opened as https first.
  if (url.protocol === 'http:') url.protocol = 'https:';
  if (!url.hostname.includes('.')) return null;
  return url.toString();
}

const isDataFile = (url: string) => DATA_FILE_RE.test(url);

const isBareListing = (url: string): boolean => {
  try {
    const u = new URL(url);
    if (u.search) return false;
    const path = u.pathname.endsWith('/') ? u.pathname : `${u.pathname}/`;
    return LISTING_PATHS.some((p) => path.toLowerCase() === p);
  } catch {
    return false;
  }
};

const classify = (url: string): 'tickets' | 'register' | 'official' => {
  try {
    const u = new URL(url);
    const host = stripWww(u.hostname.toLowerCase());
    const path = u.pathname.toLowerCase();
    if (TICKETING_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) return 'tickets';
    if (TICKET_PATH_HINTS.some((p) => path.includes(p))) return 'tickets';
    if (REGISTER_PATH_HINTS.some((p) => path.includes(p))) return 'register';
    return 'official';
  } catch {
    return 'official';
  }
};

export interface TicketLinkSource {
  buy_url?: string | null;
  ticket_url?: string | null;
  url?: string | null;
}

/**
 * Pick the best real destination for this event, in order of usefulness:
 * purchase link → ticket link → official page.
 */
export function resolveTicketAction(event: TicketLinkSource | null | undefined): TicketAction {
  const pending: TicketAction = { kind: 'pending', url: null, host: null };
  if (!event) return pending;

  const candidates = [event.buy_url, event.ticket_url, event.url];
  for (const raw of candidates) {
    const url = normalizeExternalUrl(raw);
    if (!url) continue;
    if (isDataFile(url) || isBareListing(url)) continue;
    let host: string | null = null;
    try {
      host = stripWww(new URL(url).hostname);
    } catch {
      host = null;
    }
    return { kind: classify(url), url, host };
  }
  return pending;
}

export type DirectionsBasis = 'coords' | 'address';

export interface DirectionsTarget {
  url: string;
  basis: DirectionsBasis;
}

/**
 * Build a "Cómo llegar" destination for the user's maps app.
 * Coordinates win; otherwise a real written address is used. Never both
 * invented: with neither, the caller must say the location is pending.
 */
export function buildDirectionsUrl(input: {
  point?: { lat: number; lng: number } | null;
  address?: string | null;
  venueName?: string | null;
}): DirectionsTarget | null {
  const { point } = input;
  if (point && Number.isFinite(point.lat) && Number.isFinite(point.lng)) {
    return {
      url: `https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}`,
      basis: 'coords',
    };
  }

  const address = (input.address ?? '').trim();
  if (address.length >= 6) {
    const venue = (input.venueName ?? '').trim();
    const query = venue && !address.toLowerCase().includes(venue.toLowerCase())
      ? `${venue}, ${address}`
      : address;
    return {
      url: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`,
      basis: 'address',
    };
  }

  return null;
}

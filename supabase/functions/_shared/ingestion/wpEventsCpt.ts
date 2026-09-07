/**
 * WordPress custom-post-type agendas (e.g. Teatro del Soho's "events" type).
 *
 * The listing page carries no machine-readable programme, but the site exposes
 * the whole post type over the WordPress REST API, and every detail page
 * publishes a schema.org Event with the real date. We therefore list through
 * the API (complete and paginated) and read the date from each detail page.
 *
 * A detail page without a published date yields no date: nothing is inferred.
 */

export interface WpCptOccurrence {
  date: string;
  time?: string;
  end_time?: string;
}

export interface WpCptEvent {
  externalId: string;
  eventUrl: string;
  title: string;
  description?: string;
  occurrences: WpCptOccurrence[];
  imageUrl?: string;
  ticketUrl?: string;
  price?: string;
  isFree?: boolean;
  /** True when the source published a day but no clock time. */
  dateOnly: boolean;
}

export interface WpCptResult {
  ok: boolean;
  coverage: 'complete' | 'partial' | 'none';
  events: WpCptEvent[];
  listed: number;
  withoutDate: number;
  httpStatus?: number;
  error?: string;
}

export type TextFetch = (url: string) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>;
export type JsonFetch = (url: string) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

const decode = (value: string): string =>
  value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#8217;|&#039;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, ' ')
    .trim();

const collectEventNodes = (node: unknown, out: Record<string, unknown>[]): void => {
  if (Array.isArray(node)) {
    for (const item of node) collectEventNodes(item, out);
    return;
  }
  if (!node || typeof node !== 'object') return;
  const record = node as Record<string, unknown>;
  const type = record['@type'];
  const isEvent = typeof type === 'string'
    ? /event/i.test(type)
    : Array.isArray(type) && type.some((t) => typeof t === 'string' && /event/i.test(t));
  if (isEvent && typeof record.startDate === 'string') out.push(record);
  if (record['@graph']) collectEventNodes(record['@graph'], out);
};

/** Reads the schema.org Event published on a detail page, if any. */
export function extractEventJsonLd(html: string): Record<string, unknown> | null {
  const nodes: Record<string, unknown>[] = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    try {
      collectEventNodes(JSON.parse(match[1].trim()), nodes);
    } catch {
      // A malformed block is ignored; the others are still read.
    }
  }
  return nodes[0] ?? null;
}

const splitIso = (value: unknown): { date: string; time?: string } | null => {
  if (typeof value !== 'string') return null;
  const match = value.match(/^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (!match) return null;
  return { date: match[1], time: match[2] ? `${match[2]}:${match[3]}` : undefined };
};

const priceFromOffers = (offers: unknown): { price?: string; isFree?: boolean } => {
  const list = Array.isArray(offers) ? offers : offers ? [offers] : [];
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue;
    const offer = raw as Record<string, unknown>;
    const value = offer.price ?? offer.lowPrice;
    if (value === undefined || value === null || value === '') continue;
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      // 0 is only free when the source states the price explicitly.
      return numeric === 0
        ? { price: 'Gratis', isFree: true }
        : { price: `${numeric} ${typeof offer.priceCurrency === 'string' ? offer.priceCurrency : '€'}`.trim(), isFree: false };
    }
    return { price: String(value), isFree: false };
  }
  return {};
};

export function eventFromDetail(html: string, fallbackUrl: string, externalId: string): WpCptEvent | null {
  const node = extractEventJsonLd(html);
  if (!node) return null;
  const start = splitIso(node.startDate);
  if (!start) return null;
  const end = splitIso(node.endDate);
  const name = typeof node.name === 'string' ? decode(node.name) : '';
  if (!name) return null;

  const image = Array.isArray(node.image) ? node.image[0] : node.image;
  const offers = priceFromOffers(node.offers);
  const offerUrl = (() => {
    const list = Array.isArray(node.offers) ? node.offers : node.offers ? [node.offers] : [];
    for (const raw of list) {
      if (raw && typeof raw === 'object' && typeof (raw as Record<string, unknown>).url === 'string') {
        return (raw as Record<string, unknown>).url as string;
      }
    }
    return undefined;
  })();

  return {
    externalId,
    eventUrl: typeof node.url === 'string' ? node.url : fallbackUrl,
    title: name,
    description: typeof node.description === 'string' ? decode(node.description) : undefined,
    occurrences: [{
      date: start.date,
      time: start.time,
      // An end time is only carried when it belongs to the same day.
      end_time: end && end.date === start.date ? end.time : undefined,
    }],
    imageUrl: typeof image === 'string' ? image : undefined,
    ticketUrl: offerUrl ?? (typeof node.url === 'string' ? node.url : fallbackUrl),
    price: offers.price,
    isFree: offers.isFree,
    dateOnly: !start.time,
  };
}

export async function fetchWpCptEvents(
  origin: string,
  restBase: string,
  fetchJson: JsonFetch,
  fetchText: TextFetch,
  options: { perPage?: number; maxItems?: number } = {},
): Promise<WpCptResult> {
  const perPage = options.perPage ?? 50;
  const maxItems = options.maxItems ?? 120;
  let listing: Array<Record<string, unknown>> = [];
  let lastStatus: number | undefined;

  try {
    for (let page = 1; listing.length < maxItems; page++) {
      const response = await fetchJson(`${origin}/wp-json/wp/v2/${restBase}?per_page=${perPage}&page=${page}&orderby=date&order=desc`);
      lastStatus = response.status;
      if (!response.ok) {
        if (page === 1) return { ok: false, coverage: 'none', events: [], listed: 0, withoutDate: 0, httpStatus: response.status, error: `HTTP ${response.status}` };
        break;
      }
      const batch = await response.json();
      if (!Array.isArray(batch) || batch.length === 0) break;
      listing = listing.concat(batch as Array<Record<string, unknown>>);
      if (batch.length < perPage) break;
    }
  } catch (error) {
    return {
      ok: false, coverage: 'none', events: [], listed: 0, withoutDate: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  const events: WpCptEvent[] = [];
  let withoutDate = 0;
  const slice = listing.slice(0, maxItems);
  for (const item of slice) {
    const link = typeof item.link === 'string' ? item.link : '';
    if (!link) continue;
    const externalId = item.id !== undefined ? String(item.id) : link;
    try {
      const page = await fetchText(link);
      if (!page.ok) { withoutDate++; continue; }
      const mapped = eventFromDetail(await page.text(), link, externalId);
      if (!mapped) { withoutDate++; continue; }
      events.push(mapped);
    } catch {
      withoutDate++;
    }
  }

  return {
    ok: true,
    coverage: listing.length > maxItems ? 'partial' : 'complete',
    events,
    listed: listing.length,
    withoutDate,
    httpStatus: lastStatus,
  };
}

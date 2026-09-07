/**
 * Stable identity for an ingested event.
 *
 * Identity comes from the source itself whenever the source publishes one: an
 * external id, or the event's own URL. Only when neither exists do we derive a
 * key from the normalized fields (source, title, venue, locality, day), plus
 * the published time when — and only when — the source actually published one.
 *
 * `lookupKeys` lets a later import that adds the missing time recognise the row
 * inserted by an earlier day-only import, instead of creating a duplicate.
 */

export interface EventIdentityInput {
  sourceSlug: string;
  externalId?: string | null;
  eventUrl?: string | null;
  /** Listing URL of the source; never a per-event identity. */
  sourceUrl?: string | null;
  title: string;
  venueNormalized?: string | null;
  locationNormalized?: string | null;
  /** Start instant, ISO string. */
  startAt: string;
  /** True when the source published a real clock time. */
  hasExplicitTime: boolean;
}

export interface EventIdentity {
  /** Key to persist on the row. */
  key: string;
  /** Keys to look up before inserting (includes `key`). */
  lookupKeys: string[];
}

const normalizeText = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const normalizeUrl = (raw: string): string | null => {
  try {
    const url = new URL(raw);
    url.hash = '';
    for (const param of [...url.searchParams.keys()]) {
      if (/^utm_|^fbclid$|^gclid$/i.test(param)) url.searchParams.delete(param);
    }
    const path = url.pathname.replace(/\/+$/, '');
    return `${url.host.replace(/^www\./, '')}${path}${url.search}`.toLowerCase();
  } catch {
    return null;
  }
};

const hash = (value: string): string => {
  let h = 0;
  for (let i = 0; i < value.length; i++) {
    h = ((h << 5) - h) + value.charCodeAt(i);
    h = h & h;
  }
  return Math.abs(h).toString(36);
};

const madridDay = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'unknown-day';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
};

const madridTime = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '00:00';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
};

export function buildEventIdentity(input: EventIdentityInput): EventIdentity {
  const slug = normalizeText(input.sourceSlug).replace(/\s+/g, '-') || 'source';

  const externalId = input.externalId?.trim();
  if (externalId) {
    const key = `${slug}_id_${hash(externalId)}`;
    return { key, lookupKeys: [key] };
  }

  const eventUrl = input.eventUrl ? normalizeUrl(input.eventUrl) : null;
  const listingUrl = input.sourceUrl ? normalizeUrl(input.sourceUrl) : null;
  if (eventUrl && eventUrl !== listingUrl) {
    const key = `${slug}_url_${hash(eventUrl)}`;
    return { key, lookupKeys: [key] };
  }

  const base = [
    slug,
    normalizeText(input.title),
    normalizeText(input.venueNormalized ?? ''),
    normalizeText(input.locationNormalized ?? ''),
    madridDay(input.startAt),
  ].join('|');

  const dayKey = `${slug}_d_${hash(base)}`;
  if (!input.hasExplicitTime) {
    return { key: dayKey, lookupKeys: [dayKey] };
  }
  const key = `${slug}_dt_${hash(`${base}|${madridTime(input.startAt)}`)}`;
  return { key, lookupKeys: [key, dayKey] };
}

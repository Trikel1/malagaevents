import { matchEventFromTicket } from './trinchera-ticket.ts';

const LISTING = 'https://salatrinchera.com/category/proximos-eventos/';
const PROVIDERS = new Set(['mutick.com', 'www.mutick.com', 'ticketandroll.com', 'www.ticketandroll.com', 'dice.fm']);
const object = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const decodeUrl = (x: string) => x.replace(/&amp;|&#0*38;|&#x0*26;/gi, '&');

export function allowedTrincheraUrl(raw: string, base = LISTING): string | undefined {
  try {
    const url = new URL(decodeUrl(raw), base);
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) return undefined;
    if (url.hostname !== 'salatrinchera.com' && !PROVIDERS.has(url.hostname)) return undefined;
    url.hash = '';
    return url.href;
  } catch { return undefined; }
}

function links(html: string, base: string): string[] {
  return [...new Set([...html.matchAll(/<a\b[^>]*\shref\s*=\s*(["'])(.*?)\1/gi)]
    .map(match => allowedTrincheraUrl(match[2], base)).filter((url): url is string => !!url))];
}

function nodes(html: string): unknown[] {
  const out: unknown[] = [];
  for (const match of html.matchAll(/<script\b[^>]*\stype\s*=\s*(["'])application\/ld\+json\1[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data: unknown = JSON.parse(match[2]);
      const queue = Array.isArray(data) ? [...data] : [data];
      while (queue.length) {
        const node = queue.shift();
        if (!object(node)) continue;
        if (Array.isArray(node['@graph'])) queue.push(...node['@graph']);
        out.push(node);
      }
    } catch { /* A malformed block must not hide other published blocks. */ }
  }
  return out;
}

export interface VerifiedTrincheraEvent {
  officialTitle: string;
  officialUrl: string;
  ticketUrl: string;
  metadata: Record<string, unknown>;
}

/** Bounded official listing → venue detail → explicitly linked ticket page.
 * No LLM, guessed year, publication date or poster filename enters the result.
 */
export async function fetchVerifiedTrincheraEvents(fetcher: typeof fetch = fetch): Promise<{
  events: VerifiedTrincheraEvent[]; cards: number; skipped: number; partial: boolean; diagnostics: string[];
}> {
  const diagnostics: string[] = [];
  const deadline = Date.now() + 45000;
  let requests = 0;
  const load = async (raw: string): Promise<{ html: string; url: string }> => {
    let url = allowedTrincheraUrl(raw);
    if (!url) throw new Error('Unapproved destination');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(1, Math.min(10000, deadline - Date.now())));
    try {
      for (let hop = 0; hop < 4; hop++) {
        if (++requests > 100 || Date.now() >= deadline) throw new Error('Source request budget reached');
        const response = await fetcher(url, { redirect: 'manual', signal: controller.signal, headers: { 'User-Agent': 'MalagaConnect/1.0' } });
        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get('location');
          const next = location ? allowedTrincheraUrl(location, url) : undefined;
          await response.body?.cancel();
          if (!next) throw new Error('Unapproved redirect');
          url = next;
          continue;
        }
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const html = await response.text();
        if (html.length > 2000000) throw new Error('Oversized source page');
        return { html, url };
      }
      throw new Error('Too many redirects');
    } finally { clearTimeout(timer); }
  };

  const cards = new Map<string, string>();
  let listing: string | undefined = LISTING;
  // Explicit caps are reported as partial coverage, never silently complete.
  for (let page = 0; listing && page < 2; page++) {
    let current: { html: string; url: string };
    try { current = await load(listing); }
    catch (error) {
      if (!cards.size) throw error;
      diagnostics.push(`${listing}: ${String(error)}`);
      break;
    }
    for (const match of current.html.matchAll(/<h3\b[^>]*>\s*<a\b[^>]*\shref\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>\s*<\/h3>/gi)) {
      const url = allowedTrincheraUrl(match[2], current.url);
      const title = match[3].replace(/<[^>]*>/g, '').trim();
      if (url && new URL(url).hostname === 'salatrinchera.com' && /^\d{1,2}\/\d{1,2}\s/.test(title)) cards.set(url, title);
      if (cards.size >= 40) break;
    }
    listing = links(current.html, current.url).find(url => {
      const next = new URL(url);
      return next.hostname === 'salatrinchera.com' && next.pathname === `/category/proximos-eventos/page/${page + 2}/`;
    });
    if (cards.size >= 40) break;
  }
  const entries = [...cards].slice(0, 40);
  const results: Array<VerifiedTrincheraEvent | undefined> = Array(entries.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: 3 }, async () => {
    while (cursor < entries.length) {
      const index = cursor++;
      const [officialUrl, officialTitle] = entries[index];
      try {
        const detail = await load(officialUrl);
        const candidates = links(detail.html, detail.url).filter(url => PROVIDERS.has(new URL(url).hostname) && new URL(url).pathname !== '/').slice(0, 2);
        const matches: VerifiedTrincheraEvent[] = [];
        for (const ticketUrl of candidates) {
          try {
            const ticket = await load(ticketUrl);
            const metadata = matchEventFromTicket(officialTitle, nodes(ticket.html));
            if (metadata) matches.push({ officialTitle, officialUrl, ticketUrl: ticket.url, metadata });
          } catch (error) { diagnostics.push(`${officialUrl}: ${String(error)}`); }
        }
        if (matches.length === 1) results[index] = matches[0];
        else diagnostics.push(`${officialUrl}: ${matches.length ? 'ambiguous ticket metadata' : 'no verified complete event date'}`);
      } catch (error) { diagnostics.push(`${officialUrl}: ${String(error)}`); }
    }
  }));
  const events = results.filter((x): x is VerifiedTrincheraEvent => !!x);
  if (!entries.length) diagnostics.push('No recognized event cards in official listing');
  return { events, cards: entries.length, skipped: entries.length - events.length, partial: !!listing || cards.size >= 40 || !entries.length || events.length !== entries.length, diagnostics };
}

import { describe, expect, it } from 'vitest';
import { allowedTrincheraUrl, fetchVerifiedTrincheraEvents } from '../../supabase/functions/_shared/ingestion/trinchera';

const listing = 'https://salatrinchera.com/category/proximos-eventos/';
const official = 'https://salatrinchera.com/the-silencers/';
const ticket = 'https://mutick.com/e/entradas-the-silencers-malaga-2';
const metadata = { '@type': 'Event', name: 'The Silencers', startDate: '2026-10-15T20:00:00+0200', location: { name: 'Sala La Trinchera', address: { addressLocality: 'Málaga' } }, image: 'https://mutick.com/poster.jpeg' };
const card = `<h3><a href="${official}">15/10 The Silencers</a></h3>`;
const jsonld = (data: unknown) => `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
const fixture = (overrides: Record<string, string | Response> = {}) => {
  const pages: Record<string, string | Response> = {
    [listing]: card,
    [official]: `<a href="${ticket}">Entradas</a>`,
    [ticket]: jsonld({ '@graph': [metadata] }), ...overrides,
  };
  const visited: string[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input); visited.push(url);
    expect(init?.redirect).toBe('manual');
    if (!(url in pages)) throw new Error(`Unexpected request: ${url}`);
    const page = pages[url];
    return typeof page === 'string' ? new Response(page) : page.clone();
  };
  return { fetcher, visited };
};

describe('verified Trinchera ingestion chain', () => {
  it('retains the exact official→ticket relationship and published instant', async () => {
    const { fetcher, visited } = fixture();
    const result = await fetchVerifiedTrincheraEvents(fetcher);
    expect(result.events).toEqual([{ officialTitle: '15/10 The Silencers', officialUrl: official, ticketUrl: ticket, metadata }]);
    expect(visited).toEqual([listing, official, ticket]);
    expect(result.partial).toBe(false);
  });
  it('reads the next official listing page without duplicating an event', async () => {
    const second = listing + 'page/2/';
    const { fetcher } = fixture({ [listing]: card + `<a href="${second}">Siguiente</a>`, [second]: card });
    const result = await fetchVerifiedTrincheraEvents(fetcher);
    expect(result.cards).toBe(1);
    expect(result.events).toHaveLength(1);
  });
  it('reports a provider 403 as partial, without creating an event or assuming cancellation', async () => {
    const { fetcher } = fixture({ [ticket]: new Response('Blocked', { status: 403 }) });
    const result = await fetchVerifiedTrincheraEvents(fetcher);
    expect(result.events).toEqual([]);
    expect(result.skipped).toBe(1);
    expect(result.partial).toBe(true);
    expect(result.diagnostics.join(' ')).toContain('HTTP 403');
  });
  it('keeps verified first-page events when the next listing page fails', async () => {
    const second = listing + 'page/2/';
    const { fetcher } = fixture({ [listing]: card + `<a href="${second}">Siguiente</a>`, [second]: new Response('Unavailable', { status: 503 }) });
    const result = await fetchVerifiedTrincheraEvents(fetcher);
    expect(result.events).toHaveLength(1);
    expect(result.partial).toBe(true);
    expect(result.diagnostics.join(' ')).toContain('HTTP 503');
  });
  it('follows only href, not a data-href attribute containing an unrelated ticket', async () => {
    const { fetcher, visited } = fixture({ [official]: `<a href="https://other.test/" data-href="${ticket}">More</a>` });
    expect((await fetchVerifiedTrincheraEvents(fetcher)).events).toEqual([]);
    expect(visited).toEqual([listing, official]);
  });
  it('rejects an unapproved redirect before requesting its destination', async () => {
    const { fetcher, visited } = fixture({ [ticket]: new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/admin' } }) });
    const result = await fetchVerifiedTrincheraEvents(fetcher);
    expect(result.events).toEqual([]);
    expect(visited).toEqual([listing, official, ticket]);
    expect(result.diagnostics.join(' ')).toContain('Unapproved redirect');
  });
  it('never supplies a missing year from publication date or footer', async () => {
    const { fetcher } = fixture({ [ticket]: jsonld({ ...metadata, startDate: '15/10', datePublished: '2026-01-01' }) + '<footer>2026</footer>' });
    expect((await fetchVerifiedTrincheraEvents(fetcher)).events).toEqual([]);
  });
  it('does not interpret an empty layout as complete coverage', async () => {
    const { fetcher } = fixture({ [listing]: '<html>New venue layout</html>' });
    const result = await fetchVerifiedTrincheraEvents(fetcher);
    expect(result.partial).toBe(true);
    expect(result.diagnostics.join(' ')).toContain('No recognized event cards');
  });
  it.each(['https://mutick.com.evil.test/e/show', 'https://user:password@mutick.com/e/show', 'http://mutick.com/e/show', 'https://mutick.com:8443/e/show', 'javascript:alert(1)'])('rejects unapproved source destination %s', url => {
    expect(allowedTrincheraUrl(url)).toBeUndefined();
  });
});

import { describe, it, expect } from 'vitest';
import {
  extractEventJsonLd,
  eventFromDetail,
  fetchWpCptEvents,
} from '../../supabase/functions/_shared/ingestion/wpEventsCpt';
import { parseSecutixList, parseSpanishLongDate } from '../../supabase/functions/_shared/ingestion/secutixList';

// Trimmed from the live Teatro del Soho detail page (2026-09-07).
const sohoDetail = `
<html><head>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Event","name":"Concierto de Cuaresma - Larios Pop del Soho",
"startDate":"2027-03-12T19:00","endDate":"2027-03-12T21:00",
"url":"https://teatrodelsoho.com/evento/concierto-de-cuaresma-larios-pop-del-soho-2027/",
"image":["https://teatrodelsoho.com/cabecera.jpg"],
"offers":[{"@type":"Offer","price":"25","priceCurrency":"EUR","url":"https://entradas.teatrodelsoho.com/x"}]}
</script>
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebPage"}]}</script>
</head><body></body></html>`;

const sohoDetailDayOnly = sohoDetail
  .replace('"startDate":"2027-03-12T19:00"', '"startDate":"2027-03-12"')
  .replace('"endDate":"2027-03-12T21:00"', '"endDate":"2027-03-13"');

// Trimmed from the live entradas.fuengirola.es listing (2026-09-07).
const secutixList = `
<a href="/selection/event/date?productId=10229711154670" class="product_link"></a>
<div class="content product-with-logo">
  <span class="product_image_container"><img data-original="https://s3.eu-central-1.amazonaws.com/x/large/abc.jpg" class="lazy product_image"></span>
  <p class="location"><span class="site">Casa de Cultura</span></p>
  <a href="/selection/event/date?productId=10229711154670" class="title ">&ldquo;LA DOBLE VIDA DE VIRGINIA WOOLF&rdquo;</a>
  <p class="date"><span class="unique"><span class="day">jueves 22 octubre 2026</span><span class="time">
      20:00
  </span></span></p>
</div>
<div class="content product-with-logo">
  <a href="/selection/event/date?productId=10229711154999" class="title ">CONCIERTO SIN FECHA</a>
  <p class="date"><span class="unique"><span class="day">pr&oacute;ximamente</span></span></p>
</div>`;

describe('WordPress CPT agenda adapter', () => {
  it('reads the published Event and its real time', () => {
    const event = eventFromDetail(sohoDetail, 'https://teatrodelsoho.com/evento/x/', '93836');
    expect(event).not.toBeNull();
    expect(event!.title).toBe('Concierto de Cuaresma - Larios Pop del Soho');
    expect(event!.occurrences[0]).toEqual({ date: '2027-03-12', time: '19:00', end_time: '21:00' });
    expect(event!.dateOnly).toBe(false);
    expect(event!.price).toBe('25 EUR');
    expect(event!.isFree).toBe(false);
    expect(event!.ticketUrl).toBe('https://entradas.teatrodelsoho.com/x');
    expect(event!.imageUrl).toBe('https://teatrodelsoho.com/cabecera.jpg');
  });

  it('never invents a clock time when the source only publishes the day', () => {
    const event = eventFromDetail(sohoDetailDayOnly, 'https://teatrodelsoho.com/evento/x/', '1');
    expect(event!.occurrences[0].time).toBeUndefined();
    expect(event!.occurrences[0].end_time).toBeUndefined();
    expect(event!.dateOnly).toBe(true);
  });

  it('ignores malformed JSON-LD blocks and pages without an Event', () => {
    expect(extractEventJsonLd('<script type="application/ld+json">{oops</script>')).toBeNull();
    expect(eventFromDetail('<html></html>', 'https://x/y', '1')).toBeNull();
  });

  it('lists the whole post type and skips entries without a published date', async () => {
    const listing = [
      { id: 1, link: 'https://soho.test/evento/a/' },
      { id: 2, link: 'https://soho.test/evento/b/' },
    ];
    const result = await fetchWpCptEvents(
      'https://soho.test',
      'events',
      async (url) => ({
        ok: true,
        status: 200,
        json: async () => (url.includes('page=1') ? listing : []),
      }),
      async (url) => ({
        ok: true,
        status: 200,
        text: async () => (url.endsWith('/a/') ? sohoDetail : '<html>no data</html>'),
      }),
      { perPage: 50 },
    );
    expect(result.ok).toBe(true);
    expect(result.listed).toBe(2);
    expect(result.events).toHaveLength(1);
    expect(result.withoutDate).toBe(1);
  });

  it('reports a failing API instead of returning an empty programme as success', async () => {
    const result = await fetchWpCptEvents(
      'https://soho.test',
      'events',
      async () => ({ ok: false, status: 503, json: async () => null }),
      async () => ({ ok: true, status: 200, text: async () => '' }),
    );
    expect(result.ok).toBe(false);
    expect(result.coverage).toBe('none');
    expect(result.httpStatus).toBe(503);
  });
});

describe('SecuTix listing adapter', () => {
  it('parses the published day, time, venue and ticket link', () => {
    const { events, skippedWithoutDate } = parseSecutixList(secutixList, 'https://entradas.fuengirola.es');
    expect(events).toHaveLength(1);
    expect(events[0].title).toBe('LA DOBLE VIDA DE VIRGINIA WOOLF');
    expect(events[0].occurrences[0]).toEqual({ date: '2026-10-22', time: '20:00' });
    expect(events[0].venue).toBe('Casa de Cultura');
    expect(events[0].ticketUrl).toBe('https://entradas.fuengirola.es/selection/event/date?productId=10229711154670');
    expect(events[0].imageUrl).toContain('abc.jpg');
    expect(skippedWithoutDate).toBe(1);
  });

  it('rejects impossible and incomplete dates', () => {
    expect(parseSpanishLongDate('lunes 31 noviembre 2026')).toBeNull();
    expect(parseSpanishLongDate('22 octubre')).toBeNull();
    expect(parseSpanishLongDate('miércoles 3 de marzo de 2027')).toBe('2027-03-03');
  });
});

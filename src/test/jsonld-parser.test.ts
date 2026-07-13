import { describe, it, expect } from 'vitest';
import {
  extractEvents,
  extractJsonLdBlocks,
} from '../../supabase/functions/_shared/adapters/lib/jsonld';

const HTML_EVENT = `
<!doctype html>
<html>
<head>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "MusicEvent",
    "@id": "https://ex.test/evt/1",
    "name": "Concierto \\"Málaga\\"",
    "startDate": "2026-08-01T21:00:00+02:00",
    "endDate": "2026-08-01T23:00:00+02:00",
    "eventStatus": "https://schema.org/EventScheduled",
    "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
    "url": "https://ex.test/evt/1",
    "image": "https://ex.test/img/1.jpg",
    "description": "Jazz",
    "location": {
      "@type": "Place",
      "name": "Teatro Cervantes",
      "url": "https://cervantes.test",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "C/ Ramos Marín s/n",
        "addressLocality": "Málaga",
        "postalCode": "29012",
        "addressRegion": "Málaga",
        "addressCountry": "ES"
      },
      "geo": { "@type": "GeoCoordinates", "latitude": 36.723, "longitude": -4.418 }
    },
    "organizer": { "@type": "Organization", "name": "Ayto. Málaga" },
    "performer": [{ "@type": "Person", "name": "Trio X" }],
    "offers": [
      { "@type": "Offer", "price": "20.00", "priceCurrency": "EUR", "url": "https://tickets.test/1", "availability": "https://schema.org/InStock" }
    ]
  }
  </script>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", "name": "Organizer" },
      { "@type": "TheaterEvent", "name": "Obra", "startDate": "2026-09-10T20:00" }
    ]
  }
  </script>
  <script type="application/ld+json">
  { malformed json here }
  </script>
</head>
<body></body>
</html>`;

describe('extractJsonLdBlocks', () => {
  it('skips malformed blocks without throwing', () => {
    const blocks = extractJsonLdBlocks(HTML_EVENT);
    // Two valid blocks, one malformed dropped.
    expect(blocks).toHaveLength(2);
  });

  it('returns empty array when no ld+json is present', () => {
    expect(extractJsonLdBlocks('<html><body>hi</body></html>')).toEqual([]);
  });
});

describe('extractEvents', () => {
  const events = extractEvents(HTML_EVENT);

  it('returns Event + subtypes and skips non-events (Organization)', () => {
    expect(events).toHaveLength(2);
    expect(events.map((e) => e.types[0])).toEqual(['MusicEvent', 'TheaterEvent']);
  });

  it('normalizes location with address and geo', () => {
    const e = events[0];
    expect(e.name).toBe('Concierto "Málaga"');
    expect(e.startDate).toBe('2026-08-01T21:00:00+02:00');
    expect(e.location).toMatchObject({
      name: 'Teatro Cervantes',
      address: 'C/ Ramos Marín s/n',
      locality: 'Málaga',
      postalCode: '29012',
      country: 'ES',
      latitude: 36.723,
      longitude: -4.418,
    });
  });

  it('normalizes organizer/performer as strings and offers as array', () => {
    const e = events[0];
    expect(e.organizer).toBe('Ayto. Málaga');
    expect(e.performer).toBe('Trio X');
    expect(e.offers).toHaveLength(1);
    expect(e.offers[0]).toMatchObject({
      price: '20.00',
      priceCurrency: 'EUR',
      url: 'https://tickets.test/1',
      availability: 'https://schema.org/InStock',
    });
  });

  it('walks @graph arrays to find events nested inside', () => {
    expect(events[1].name).toBe('Obra');
    expect(events[1].startDate).toBe('2026-09-10T20:00');
    expect(events[1].location).toBeNull();
    expect(events[1].offers).toEqual([]);
  });

  it('returns empty when a page has no ld+json events', () => {
    expect(extractEvents('<html></html>')).toEqual([]);
  });
});

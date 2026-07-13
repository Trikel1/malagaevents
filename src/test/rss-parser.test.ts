import { describe, it, expect } from 'vitest';
import { parseFeed } from '../../supabase/functions/_shared/adapters/lib/rss';

const RSS_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Cultura Málaga</title>
    <link>https://example.test/cultura</link>
    <description>Agenda cultural</description>
    <language>es-ES</language>
    <lastBuildDate>Mon, 13 Jul 2026 09:00:00 +0200</lastBuildDate>
    <item>
      <title><![CDATA[Concierto de "verano" &amp; jazz]]></title>
      <link>https://example.test/e/1</link>
      <guid isPermaLink="false">evt-0001</guid>
      <pubDate>Sat, 01 Aug 2026 21:00:00 +0200</pubDate>
      <description><![CDATA[<p>Cita en el Teatro Cervantes</p>]]></description>
      <category>Música</category>
      <category>Jazz</category>
      <enclosure url="https://example.test/img/1.jpg" type="image/jpeg" length="12345"/>
    </item>
    <item>
      <title>Exposición sin GUID</title>
      <link>https://example.test/e/2</link>
      <pubDate>malformed-date</pubDate>
      <description>Descripción con &amp; entidades</description>
    </item>
  </channel>
</rss>`;

const ATOM_FIXTURE = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="es">
  <title>Agenda Ronda</title>
  <link href="https://ronda.test/agenda"/>
  <updated>2026-07-13T09:00:00Z</updated>
  <entry>
    <id>urn:evt:42</id>
    <title>Feria de Pedro Romero</title>
    <link href="https://ronda.test/evt/42"/>
    <published>2026-08-30T18:00:00Z</published>
    <updated>2026-07-01T12:00:00Z</updated>
    <summary>Corridas y actos culturales</summary>
    <category term="Festival"/>
    <category term="Tradición"/>
  </entry>
</feed>`;

describe('parseFeed (RSS 2.0)', () => {
  const feed = parseFeed(RSS_FIXTURE);

  it('detects RSS kind and channel metadata', () => {
    expect(feed.kind).toBe('rss');
    expect(feed.channel.title).toBe('Cultura Málaga');
    expect(feed.channel.language).toBe('es-ES');
    expect(feed.channel.updatedAt?.toISOString()).toBe('2026-07-13T07:00:00.000Z');
  });

  it('decodes CDATA + entities in item titles and descriptions', () => {
    expect(feed.items[0].title).toBe('Concierto de "verano" & jazz');
    expect(feed.items[0].description).toContain('Teatro Cervantes');
    expect(feed.items[1].description).toBe('Descripción con & entidades');
  });

  it('picks guid or falls back to link as id', () => {
    expect(feed.items[0].id).toBe('evt-0001');
    expect(feed.items[1].id).toBe('https://example.test/e/2');
  });

  it('parses valid dates and leaves malformed ones as null', () => {
    expect(feed.items[0].publishedAt?.toISOString()).toBe('2026-08-01T19:00:00.000Z');
    expect(feed.items[1].publishedAt).toBeNull();
  });

  it('collects multiple categories and enclosure url', () => {
    expect(feed.items[0].categories).toEqual(['Música', 'Jazz']);
    expect(feed.items[0].enclosureUrl).toBe('https://example.test/img/1.jpg');
    expect(feed.items[1].enclosureUrl).toBeNull();
  });
});

describe('parseFeed (Atom 1.0)', () => {
  const feed = parseFeed(ATOM_FIXTURE);

  it('detects Atom kind', () => {
    expect(feed.kind).toBe('atom');
    expect(feed.channel.title).toBe('Agenda Ronda');
    expect(feed.channel.link).toBe('https://ronda.test/agenda');
  });

  it('normalizes entry into the shared FeedItem shape', () => {
    expect(feed.items).toHaveLength(1);
    const it = feed.items[0];
    expect(it.id).toBe('urn:evt:42');
    expect(it.link).toBe('https://ronda.test/evt/42');
    expect(it.publishedAt?.toISOString()).toBe('2026-08-30T18:00:00.000Z');
    expect(it.updatedAt?.toISOString()).toBe('2026-07-01T12:00:00.000Z');
    expect(it.categories).toEqual(['Festival', 'Tradición']);
  });
});

describe('parseFeed (empty / unknown)', () => {
  it('returns empty shape without throwing on empty input', () => {
    const feed = parseFeed('');
    expect(feed.kind).toBe('unknown');
    expect(feed.items).toEqual([]);
  });

  it('returns unknown kind for non-syndication XML', () => {
    const feed = parseFeed('<?xml version="1.0"?><doc><x/></doc>');
    expect(feed.kind).toBe('unknown');
  });
});

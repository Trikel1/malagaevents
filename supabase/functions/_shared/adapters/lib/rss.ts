// Lightweight RSS 2.0 + Atom 1.0 parser for ingestion adapters.
//
// Design goals:
// - No third-party XML dependency. Uses tight regex extraction with CDATA
//   and entity decoding. The upstream feeds we ingest are well-formed
//   syndication XML, not arbitrary XML.
// - Deterministic output shape (`FeedItem`) regardless of source flavour.
// - Never throws on missing fields — returns empty strings and null dates so
//   adapters can filter/normalize downstream.
// - Bounded fetch via `safeFetch` (size + timeout + redirects).

import { safeFetch, type SafeFetchOptions } from "./http.ts";

export interface FeedChannel {
  title: string;
  link: string;
  description: string;
  language: string;
  updatedAt: Date | null;
}

export interface FeedItem {
  /** RSS `<guid>` or Atom `<id>`. Falls back to link. */
  id: string;
  title: string;
  link: string;
  /** Best-effort HTML/plain description. */
  description: string;
  /** Publication date. `null` when unparseable or missing. */
  publishedAt: Date | null;
  /** Last-update date. `null` when unparseable or missing. */
  updatedAt: Date | null;
  categories: string[];
  /** Optional enclosure (image / audio). */
  enclosureUrl: string | null;
}

export interface ParsedFeed {
  kind: "rss" | "atom" | "unknown";
  channel: FeedChannel;
  items: FeedItem[];
}

// --- entity + CDATA helpers ---------------------------------------------------

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, ent: string) => {
    if (ent.startsWith("#x") || ent.startsWith("#X")) {
      const cp = parseInt(ent.slice(2), 16);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : m;
    }
    if (ent.startsWith("#")) {
      const cp = parseInt(ent.slice(1), 10);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : m;
    }
    return NAMED_ENTITIES[ent] ?? m;
  });
}

function stripCData(input: string): string {
  return input.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_m, inner) => inner);
}

function normalizeText(input: string): string {
  return decodeEntities(stripCData(input)).trim();
}

// --- tag extraction -----------------------------------------------------------

function pickTag(block: string, tag: string): string {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = block.match(re);
  return m ? normalizeText(m[1]) : "";
}

function pickAttr(block: string, tag: string, attr: string): string {
  const re = new RegExp(`<${tag}\\b[^>]*\\b${attr}=("([^"]*)"|'([^']*)')`, "i");
  const m = block.match(re);
  return m ? (m[2] ?? m[3] ?? "") : "";
}

function pickAll(block: string, tag: string): string[] {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(block))) out.push(normalizeText(m[1]));
  return out;
}

function parseDate(raw: string): Date | null {
  if (!raw) return null;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? new Date(t) : null;
}

// --- RSS 2.0 ------------------------------------------------------------------

function parseRss(xml: string): ParsedFeed {
  const channelMatch = xml.match(/<channel\b[^>]*>([\s\S]*?)<\/channel>/i);
  const channelBlock = channelMatch ? channelMatch[1] : "";

  const items: FeedItem[] = [];
  const itemRe = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(channelBlock))) {
    const block = m[1];
    const link = pickTag(block, "link") || pickAttr(block, "link", "href");
    const guid = pickTag(block, "guid") || link;
    items.push({
      id: guid || pickTag(block, "title"),
      title: pickTag(block, "title"),
      link,
      description:
        pickTag(block, "content:encoded") || pickTag(block, "description"),
      publishedAt: parseDate(pickTag(block, "pubDate")),
      updatedAt:
        parseDate(pickTag(block, "atom:updated")) ||
        parseDate(pickTag(block, "dc:date")),
      categories: pickAll(block, "category"),
      enclosureUrl: pickAttr(block, "enclosure", "url") || null,
    });
  }

  return {
    kind: "rss",
    channel: {
      title: pickTag(channelBlock, "title"),
      link: pickTag(channelBlock, "link"),
      description: pickTag(channelBlock, "description"),
      language: pickTag(channelBlock, "language"),
      updatedAt:
        parseDate(pickTag(channelBlock, "lastBuildDate")) ||
        parseDate(pickTag(channelBlock, "pubDate")),
    },
    items,
  };
}

// --- Atom 1.0 -----------------------------------------------------------------

function parseAtom(xml: string): ParsedFeed {
  const feedMatch = xml.match(/<feed\b[^>]*>([\s\S]*?)<\/feed>/i);
  const feedBlock = feedMatch ? feedMatch[1] : xml;

  const items: FeedItem[] = [];
  const entryRe = /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi;
  let m: RegExpExecArray | null;
  while ((m = entryRe.exec(feedBlock))) {
    const block = m[1];
    const link = pickAttr(block, "link", "href") || pickTag(block, "link");
    const id = pickTag(block, "id") || link;
    const categories: string[] = [];
    const catRe = /<category\b[^>]*\bterm=("([^"]*)"|'([^']*)')/gi;
    let cm: RegExpExecArray | null;
    while ((cm = catRe.exec(block))) {
      categories.push(cm[2] ?? cm[3] ?? "");
    }
    items.push({
      id,
      title: pickTag(block, "title"),
      link,
      description: pickTag(block, "content") || pickTag(block, "summary"),
      publishedAt: parseDate(pickTag(block, "published")),
      updatedAt: parseDate(pickTag(block, "updated")),
      categories,
      enclosureUrl: null,
    });
  }

  return {
    kind: "atom",
    channel: {
      title: pickTag(feedBlock, "title"),
      link: pickAttr(feedBlock, "link", "href") || pickTag(feedBlock, "link"),
      description: pickTag(feedBlock, "subtitle"),
      language: pickAttr(feedBlock, "feed", "xml:lang"),
      updatedAt: parseDate(pickTag(feedBlock, "updated")),
    },
    items,
  };
}

// --- Public API ---------------------------------------------------------------

export function parseFeed(xml: string): ParsedFeed {
  const trimmed = xml.trim();
  if (!trimmed) {
    return {
      kind: "unknown",
      channel: {
        title: "",
        link: "",
        description: "",
        language: "",
        updatedAt: null,
      },
      items: [],
    };
  }
  if (/<feed\b[^>]*xmlns=["']http:\/\/www\.w3\.org\/2005\/Atom/i.test(trimmed))
    return parseAtom(trimmed);
  if (/<rss\b/i.test(trimmed) || /<channel\b/i.test(trimmed))
    return parseRss(trimmed);
  if (/<entry\b/i.test(trimmed) && /<feed\b/i.test(trimmed))
    return parseAtom(trimmed);
  return {
    kind: "unknown",
    channel: {
      title: "",
      link: "",
      description: "",
      language: "",
      updatedAt: null,
    },
    items: [],
  };
}

export async function fetchFeed(
  url: string,
  opts: SafeFetchOptions = {},
): Promise<ParsedFeed> {
  const res = await safeFetch(url, {
    accept:
      "application/atom+xml, application/rss+xml, application/xml;q=0.9, text/xml;q=0.9, */*;q=0.5",
    ...opts,
  });
  return parseFeed(res.body);
}

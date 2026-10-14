/** Official WordPress posters keyed by the event link that contains the image. */
const decodeAttribute = (value: string): string => value.replace(
  /&(?:amp|quot|apos|#39|#\d+|#x[\da-f]+);/gi,
  entity => {
    const named: Record<string, string> = { '&amp;': '&', '&quot;': '"', '&apos;': "'", '&#39;': "'" };
    if (named[entity.toLowerCase()]) return named[entity.toLowerCase()];
    const hex = /^&#x/i.test(entity);
    const code = parseInt(entity.slice(hex ? 3 : 2, -1), hex ? 16 : 10);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
  },
);

const attribute = (tag: string, name: string): string | undefined => {
  const match = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, 'i').exec(tag);
  return match ? decodeAttribute(match[2]) : undefined;
};

export function resolveCocheraCardUrl(raw: string, baseUrl: string): string | undefined {
  try {
    const url = new URL(decodeAttribute(raw), baseUrl);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}

export function extractCocheraPosters(html: string, baseUrl: string): Map<string, string> {
  const posters = new Map<string, string>();
  const anchors = /<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi;
  for (const anchor of html.matchAll(anchors)) {
    const href = attribute(anchor[1], 'href');
    const eventUrl = href ? resolveCocheraCardUrl(href, baseUrl) : undefined;
    const imageTag = anchor[2].match(/<img\b[^>]*>/i)?.[0];
    if (!eventUrl || !imageTag || posters.has(eventUrl)) continue;

    const candidates: Array<{ width: number; url: string }> = [];
    for (const srcset of [attribute(imageTag, 'srcset'), attribute(imageTag, 'data-srcset')]) {
      for (const entry of (srcset ?? '').split(',')) {
        const match = entry.trim().match(/^(\S+)\s+(\d+)w$/);
        if (!match) continue;
        const width = Number(match[2]);
        const url = resolveCocheraCardUrl(match[1], baseUrl);
        if (url && width > 0 && width <= 1600) candidates.push({ width, url });
      }
    }
    candidates.sort((a, b) => b.width - a.width);
    const fallback = attribute(imageTag, 'data-src') ?? attribute(imageTag, 'src');
    const imageUrl = candidates[0]?.url ?? (fallback ? resolveCocheraCardUrl(fallback, baseUrl) : undefined);
    if (imageUrl) posters.set(eventUrl, imageUrl);
  }
  return posters;
}

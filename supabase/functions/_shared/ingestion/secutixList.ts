/**
 * SecuTix ticketing listings (entradas.fuengirola.es and siblings).
 *
 * The listing HTML carries the published day, time, venue and product link in
 * stable classes. Nothing is inferred: an entry without a parseable date is
 * reported as skipped rather than given a made-up one.
 */

export interface SecutixEvent {
  externalId: string;
  title: string;
  occurrences: Array<{ date: string; time?: string }>;
  venue?: string;
  imageUrl?: string;
  ticketUrl: string;
}

export interface SecutixParseResult {
  events: SecutixEvent[];
  skippedWithoutDate: number;
}

const MONTHS: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

const clean = (value: string): string =>
  value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&ldquo;|&rdquo;|&quot;|[“”]/g, '"')
    .replace(/&oacute;/g, 'ó')
    .replace(/&aacute;/g, 'á')
    .replace(/&eacute;/g, 'é')
    .replace(/&iacute;/g, 'í')
    .replace(/&uacute;/g, 'ú')
    .replace(/&ntilde;/g, 'ñ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, ' ')
    .trim();


/** "jueves 22 octubre 2026" -> 2026-10-22. Returns null when incomplete. */
export function parseSpanishLongDate(text: string): string | null {
  const match = clean(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .match(/(\d{1,2})\s+(?:de\s+)?([a-z]+)\s+(?:de\s+)?(\d{4})/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = MONTHS[match[2]];
  const year = Number(match[3]);
  if (!month || day < 1 || day > 31) return null;
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  // Reject impossible days such as 31 de noviembre.
  const probe = new Date(`${iso}T00:00:00Z`);
  if (probe.getUTCDate() !== day || probe.getUTCMonth() + 1 !== month) return null;
  return iso;
}

export function parseSecutixList(html: string, baseUrl: string): SecutixParseResult {
  const events: SecutixEvent[] = [];
  const seen = new Set<string>();
  let skippedWithoutDate = 0;

  const blocks = html.split(/<div[^>]*class="content product-with-logo"/i).slice(1);
  for (const block of blocks) {
    const idMatch = block.match(/productId=(\d+)/);
    const titleMatch = block.match(/class="title[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
    if (!idMatch || !titleMatch) continue;
    const title = clean(titleMatch[1]).replace(/^"|"$/g, '');
    if (!title) continue;
    const externalId = idMatch[1];
    if (seen.has(externalId)) continue;

    const dayText = block.match(/class="day"[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? '';
    const date = parseSpanishLongDate(dayText);
    if (!date) { skippedWithoutDate++; continue; }
    const timeRaw = clean(block.match(/class="time"[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? '');
    const time = /^\d{1,2}:\d{2}$/.test(timeRaw) ? timeRaw.padStart(5, '0') : undefined;

    const venue = clean(block.match(/class="site"[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? '') || undefined;
    const imageUrl = block.match(/data-original="(https?:\/\/[^"]+)"/i)?.[1];

    seen.add(externalId);
    events.push({
      externalId,
      title,
      occurrences: [{ date, time }],
      venue,
      imageUrl,
      ticketUrl: new URL(`/selection/event/date?productId=${externalId}`, baseUrl).toString(),
    });
  }

  return { events, skippedWithoutDate };
}

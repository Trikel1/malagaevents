import { parseSpanishDateToMadrid } from './dates.ts';

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const normalized = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
const fullInstant = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/i;
const madridDay = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', day: '2-digit', month: '2-digit' });

/** Match a date explicitly published on the ticket page linked by the venue.
 * DD/MM from the venue is only a cross-check, never a source for a year.
 */
export function matchEventFromTicket(officialTitle: string, ticketEvents: unknown[]): Record<string, unknown> | undefined {
  const prefix = /^\s*(\d{1,2})\/(\d{1,2})(?:\s|$)/.exec(officialTitle);
  if (!prefix || !Array.isArray(ticketEvents)) return undefined;
  const day = Number(prefix[1]);
  const month = Number(prefix[2]);
  const matches = ticketEvents.filter((input): input is Record<string, unknown> => {
    if (!record(input) || typeof input.startDate !== 'string' || !fullInstant.test(input.startDate)) return false;
    const types = Array.isArray(input['@type']) ? input['@type'] : [input['@type']];
    if (!types.some(type => typeof type === 'string' && /(?:^|\/)(?:Event|MusicEvent)$/.test(type))) return false;
    if (input.eventStatus !== undefined && (typeof input.eventStatus !== 'string' || !/(?:^|\/)Event(?:Scheduled|Rescheduled)$/.test(input.eventStatus))) return false;
    const location = input.location;
    if (!record(location) || typeof location.name !== 'string' || !/trinchera/i.test(location.name)) return false;
    if (location.address !== undefined) {
      if (!record(location.address)) return false;
      const city = location.address.addressLocality;
      if (city !== undefined && (typeof city !== 'string' || normalized(city) !== 'malaga')) return false;
    }
    const date = parseSpanishDateToMadrid(input.startDate);
    if (!date) return false;
    const parts = madridDay.formatToParts(date);
    return Number(parts.find(part => part.type === 'day')?.value) === day &&
      Number(parts.find(part => part.type === 'month')?.value) === month;
  });
  return matches.length === 1 ? matches[0] : undefined;
}

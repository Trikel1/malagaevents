/**
 * Online-only detection.
 *
 * Only the structured place fields (venue name / address) count. A stray word
 * in the description ("retransmisión online") never turns a physical event into
 * an online one, and hybrid wording keeps the physical information.
 */

const normalize = (value: string) =>
  value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

/** Values that, on their own, mean "there is no physical venue". */
const ONLINE_VALUES = new Set([
  'online',
  'on line',
  'on-line',
  'en linea',
  'virtual',
  'evento online',
  'actividad online',
  'formato online',
  'zoom',
  'streaming',
  'retransmision online',
  'youtube',
  'plataforma online',
]);

const HYBRID_TERMS = ['presencial', 'hibrid', 'y online', 'online y'];

const isOnlineToken = (raw?: string | null): boolean => {
  if (!raw) return false;
  const value = normalize(raw);
  if (!value) return false;
  if (HYBRID_TERMS.some((term) => value.includes(term))) return false;
  if (ONLINE_VALUES.has(value)) return true;
  // "Online, Málaga" — the venue is online and the city is only administrative.
  const parts = value.split(/[,·|/]+/).map((part) => part.trim()).filter(Boolean);
  if (parts.length > 1 && ONLINE_VALUES.has(parts[0])) return true;
  return false;
};

export interface EventPlaceInput {
  venue_name?: string | null;
  address?: string | null;
}

/** True only when both structured place fields point to an online-only activity. */
export function isOnlineEvent(event: EventPlaceInput): boolean {
  const venueOnline = isOnlineToken(event.venue_name);
  if (!venueOnline) return false;
  // An address that names a real street contradicts the online venue.
  const address = event.address ? normalize(event.address) : '';
  if (!address) return true;
  if (isOnlineToken(event.address)) return true;
  const hasStreet = /\b(calle|c\/|avda|avenida|plaza|paseo|camino|carretera|ctra|urb|poligono)\b/.test(address) || /\d{1,4}/.test(address);
  return !hasStreet;
}

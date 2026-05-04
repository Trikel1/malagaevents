export interface SportEvent {
  id: string;
  sport: string;
  title: string;
  teams?: string;
  competition: string;
  start_at: string;
  venue: string;
  city: string;
  address?: string;
  ticketsUrl?: string;
  imageUrl?: string;
  price_info?: string | null;
  source_url?: string | null;
}

export const SPORT_CATEGORIES = [
  'futbol', 'baloncesto', 'futsal', 'balonmano',
  'atletismo', 'motor', 'tenis', 'otros'
] as const;

export type SportCategory = typeof SPORT_CATEGORIES[number];

export const SPORT_LABELS: Record<SportCategory, string> = {
  futbol: 'Fútbol',
  baloncesto: 'Baloncesto',
  futsal: 'Fútbol Sala',
  balonmano: 'Balonmano',
  atletismo: 'Atletismo',
  motor: 'Motor',
  tenis: 'Tenis',
  otros: 'Otros',
};

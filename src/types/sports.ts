export interface SportEvent {
  id: string;
  sport: string;
  title: string;
  teams?: string;
  competition: string;
  start_at: string;
  venue: string;
  city: string;
  ticketsUrl?: string;
  imageUrl?: string;
}

export const SPORT_CATEGORIES = [
  'futbol', 'baloncesto', 'futsal', 'balonmano',
  'atletismo', 'motor', 'tenis', 'otros'
] as const;

export type SportCategory = typeof SPORT_CATEGORIES[number];

export const SPORT_ICONS: Record<SportCategory, string> = {
  futbol: '⚽',
  baloncesto: '🏀',
  futsal: '⚽',
  balonmano: '🤾',
  atletismo: '🏃',
  motor: '🏎️',
  tenis: '🎾',
  otros: '🏅',
};

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

export const MOCK_SPORT_EVENTS: SportEvent[] = [
  {
    id: 'sp1',
    sport: 'futbol',
    title: 'Málaga CF vs Cádiz CF',
    teams: 'Málaga CF - Cádiz CF',
    competition: 'LaLiga Hypermotion',
    start_at: '2026-02-14T18:30:00',
    venue: 'Estadio La Rosaleda',
    city: 'Málaga',
    ticketsUrl: 'https://malagacf.com/entradas',
  },
  {
    id: 'sp2',
    sport: 'baloncesto',
    title: 'Unicaja vs Real Madrid',
    teams: 'Unicaja - Real Madrid',
    competition: 'Liga Endesa',
    start_at: '2026-02-15T20:00:00',
    venue: 'Martín Carpena',
    city: 'Málaga',
    ticketsUrl: 'https://unicaja.club/entradas',
  },
  {
    id: 'sp3',
    sport: 'futsal',
    title: 'BeSoccer UMA vs Jaén FS',
    teams: 'BeSoccer UMA - Jaén FS',
    competition: 'Primera RFEF Futsal',
    start_at: '2026-02-14T12:00:00',
    venue: 'Pabellón Universitario',
    city: 'Málaga',
  },
  {
    id: 'sp4',
    sport: 'balonmano',
    title: 'BM Málaga vs Puente Genil',
    teams: 'BM Málaga - Puente Genil',
    competition: 'División de Honor Plata',
    start_at: '2026-02-15T17:00:00',
    venue: 'Ciudad de Málaga',
    city: 'Málaga',
  },
  {
    id: 'sp5',
    sport: 'atletismo',
    title: 'Media Maratón de Málaga',
    competition: 'RFEA',
    start_at: '2026-02-16T09:00:00',
    venue: 'Paseo del Parque',
    city: 'Málaga',
    ticketsUrl: 'https://mediamaratonmalaga.com',
  },
  {
    id: 'sp6',
    sport: 'tenis',
    title: 'ATP Challenger Marbella',
    competition: 'ATP Challenger Tour',
    start_at: '2026-02-14T10:00:00',
    venue: 'Club de Tenis Puente Romano',
    city: 'Marbella',
  },
  {
    id: 'sp7',
    sport: 'futbol',
    title: 'Antequera CF vs Marbella FC',
    teams: 'Antequera CF - Marbella FC',
    competition: 'Segunda RFEF',
    start_at: '2026-02-15T11:30:00',
    venue: 'Estadio El Maulí',
    city: 'Antequera',
  },
  {
    id: 'sp8',
    sport: 'motor',
    title: 'Rally Costa del Sol',
    competition: 'Campeonato de Andalucía',
    start_at: '2026-02-16T08:00:00',
    venue: 'Circuito urbano Málaga',
    city: 'Málaga',
  },
  {
    id: 'sp9',
    sport: 'baloncesto',
    title: 'CB Marbella vs CB Granada',
    teams: 'CB Marbella - CB Granada',
    competition: 'Liga EBA',
    start_at: '2026-02-14T19:00:00',
    venue: 'Pabellón Serrano Lima',
    city: 'Marbella',
  },
  {
    id: 'sp10',
    sport: 'futbol',
    title: 'Vélez CF vs Torremolinos CF',
    teams: 'Vélez CF - Torremolinos CF',
    competition: 'Tercera RFEF',
    start_at: '2026-02-16T12:00:00',
    venue: 'Estadio Vivar Téllez',
    city: 'Vélez-Málaga',
  },
];

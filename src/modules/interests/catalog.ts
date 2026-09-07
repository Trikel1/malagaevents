/**
 * Interest catalog — Fase 4.
 *
 * Stable, versioned identifiers for the "Mis gustos" feature. Ids are decoupled
 * from the legacy category values stored in the database: each entry declares
 * the legacy values and keyword signals it maps to, so the catalog can grow
 * without a migration and without rewriting stored rows.
 */

export type InterestDomain = 'culture' | 'sports';

export interface InterestDefinition {
  /** Stable id persisted in storage / database. Never rename. */
  id: string;
  domain: InterestDomain;
  /** i18n key under `interests.items`. */
  labelKey: string;
  /** Legacy `events.category` / `sports_entities.sport` values this maps to. */
  legacyValues: string[];
  /** Normalized (lowercase, unaccented) word signals matched with word boundaries. */
  keywords: string[];
}

export const INTEREST_CATALOG_VERSION = 1;

export const INTEREST_CATALOG: InterestDefinition[] = [
  // ---------------- CULTURA Y OCIO ----------------
  {
    id: 'concerts',
    domain: 'culture',
    labelKey: 'concerts',
    legacyValues: ['music', 'concert', 'musica', 'conciertos'],
    keywords: ['concierto', 'conciertos', 'concert', 'gira', 'recital', 'banda', 'directo'],
  },
  {
    id: 'electronic_music',
    domain: 'culture',
    labelKey: 'electronicMusic',
    legacyValues: [],
    keywords: ['electronica', 'electronico', 'techno', 'house', 'dj', 'djs', 'rave', 'trance', 'edm', 'drum', 'bass', 'electronic'],
  },
  {
    id: 'nightlife',
    domain: 'culture',
    labelKey: 'nightlife',
    legacyValues: ['nightlife', 'noche'],
    keywords: ['nocturna', 'nocturno', 'noche', 'club', 'discoteca', 'sala', 'afterwork', 'fiesta', 'nightlife'],
  },
  {
    id: 'theater',
    domain: 'culture',
    labelKey: 'theater',
    legacyValues: ['theater', 'theatre', 'teatro'],
    keywords: ['teatro', 'obra', 'dramaturgia', 'monologo', 'comedia', 'musical', 'theatre'],
  },
  {
    id: 'dance',
    domain: 'culture',
    labelKey: 'dance',
    legacyValues: ['dance', 'danza'],
    keywords: ['danza', 'ballet', 'baile', 'contemporanea', 'dance'],
  },
  {
    id: 'flamenco',
    domain: 'culture',
    labelKey: 'flamenco',
    legacyValues: ['flamenco'],
    keywords: ['flamenco', 'tablao', 'cante', 'jondo', 'bulerias'],
  },
  {
    id: 'exhibitions',
    domain: 'culture',
    labelKey: 'exhibitions',
    legacyValues: ['exhibitions', 'exhibition', 'exposiciones', 'arte', 'museums'],
    keywords: ['exposicion', 'exposiciones', 'muestra', 'museo', 'galeria', 'pintura', 'fotografia', 'escultura', 'exhibition'],
  },
  {
    id: 'cinema',
    domain: 'culture',
    labelKey: 'cinema',
    legacyValues: ['cinema', 'cine', 'film'],
    keywords: ['cine', 'pelicula', 'proyeccion', 'cortometraje', 'filmoteca', 'cinema', 'film'],
  },
  {
    id: 'family_kids',
    domain: 'culture',
    labelKey: 'familyKids',
    legacyValues: ['kids', 'family', 'infantil', 'familiar'],
    keywords: ['infantil', 'infantiles', 'ninos', 'ninas', 'peques', 'familiar', 'familias', 'cuentacuentos', 'titeres', 'family', 'kids'],
  },
  {
    id: 'festivals',
    domain: 'culture',
    labelKey: 'festivals',
    legacyValues: ['festival', 'festivals', 'festivales'],
    keywords: ['festival', 'festivales', 'feria'],
  },
  {
    id: 'literature',
    domain: 'culture',
    labelKey: 'literature',
    legacyValues: ['literature', 'literatura', 'books'],
    keywords: ['literatura', 'libro', 'libros', 'poesia', 'lectura', 'presentacion'],
  },
  {
    id: 'gastronomy',
    domain: 'culture',
    labelKey: 'gastronomy',
    legacyValues: ['gastronomy', 'gastronomia', 'food', 'markets'],
    keywords: ['gastronomia', 'gastronomico', 'cata', 'vino', 'cerveza', 'tapas', 'mercado', 'degustacion'],
  },
  {
    id: 'workshops',
    domain: 'culture',
    labelKey: 'workshops',
    legacyValues: ['workshops', 'talleres', 'workshop'],
    keywords: ['taller', 'talleres', 'curso', 'formacion', 'workshop', 'masterclass'],
  },
  {
    id: 'outdoor_culture',
    domain: 'culture',
    labelKey: 'outdoorCulture',
    legacyValues: ['outdoor'],
    keywords: ['aire libre', 'parque', 'jardin', 'playa', 'ruta', 'paseo', 'mirador'],
  },

  // ---------------- DEPORTES ----------------
  {
    id: 'basketball',
    domain: 'sports',
    labelKey: 'basketball',
    legacyValues: ['basketball', 'baloncesto'],
    keywords: ['baloncesto', 'basket', 'basketball', 'unicaja', 'acb', 'canasta'],
  },
  {
    id: 'football',
    domain: 'sports',
    labelKey: 'football',
    legacyValues: ['football', 'futbol', 'soccer'],
    keywords: ['futbol', 'football', 'soccer', 'liga', 'malaga cf', 'balompie'],
  },
  {
    id: 'motorcycling',
    domain: 'sports',
    labelKey: 'motorcycling',
    legacyValues: ['motorcycling', 'motociclismo'],
    // Deliberately narrow: motorsport in general must NOT match this interest.
    keywords: ['motociclismo', 'moto', 'motos', 'motogp', 'enduro', 'trial', 'motocross', 'supermotard', 'velocidad motociclista', 'motard'],
  },
  {
    id: 'motorsport',
    domain: 'sports',
    labelKey: 'motorsport',
    legacyValues: ['motor', 'motorsport', 'automovilismo'],
    keywords: ['automovilismo', 'rally', 'karting', 'formula', 'circuito', 'coches'],
  },
  {
    id: 'athletics',
    domain: 'sports',
    labelKey: 'athletics',
    legacyValues: ['athletics', 'atletismo', 'running'],
    keywords: ['atletismo', 'carrera', 'maraton', 'media maraton', 'running', 'trail', 'cross', '10k', '5k'],
  },
  {
    id: 'cycling',
    domain: 'sports',
    labelKey: 'cycling',
    legacyValues: ['cycling', 'ciclismo'],
    keywords: ['ciclismo', 'bici', 'btt', 'mtb', 'ciclista', 'cycling'],
  },
  {
    id: 'swimming',
    domain: 'sports',
    labelKey: 'swimming',
    legacyValues: ['swimming', 'natacion'],
    keywords: ['natacion', 'nadar', 'piscina', 'aguas abiertas', 'travesia'],
  },
  {
    id: 'watersports',
    domain: 'sports',
    labelKey: 'watersports',
    legacyValues: ['watersports', 'vela', 'sailing', 'surf'],
    keywords: ['vela', 'regata', 'surf', 'paddle surf', 'kayak', 'remo', 'piraguismo', 'nautica'],
  },
  {
    id: 'racket_sports',
    domain: 'sports',
    labelKey: 'racketSports',
    legacyValues: ['tennis', 'tenis', 'padel', 'pickleball'],
    keywords: ['tenis', 'padel', 'pickleball', 'raqueta', 'badminton', 'tennis'],
  },
  {
    id: 'handball',
    domain: 'sports',
    labelKey: 'handball',
    legacyValues: ['handball', 'balonmano'],
    keywords: ['balonmano', 'handball'],
  },
  {
    id: 'volleyball',
    domain: 'sports',
    labelKey: 'volleyball',
    legacyValues: ['volleyball', 'voleibol', 'voley'],
    keywords: ['voleibol', 'voley', 'volley', 'volleyball', 'voley playa'],
  },
  {
    id: 'martial_arts',
    domain: 'sports',
    labelKey: 'martialArts',
    legacyValues: ['martial_arts', 'artes_marciales', 'boxing'],
    keywords: ['judo', 'karate', 'taekwondo', 'boxeo', 'kickboxing', 'jiu', 'lucha', 'esgrima'],
  },
  {
    id: 'hiking',
    domain: 'sports',
    labelKey: 'hiking',
    legacyValues: ['hiking', 'senderismo'],
    keywords: ['senderismo', 'sendero', 'montana', 'escalada', 'marcha', 'caminata'],
  },
  {
    id: 'family_sports',
    domain: 'sports',
    labelKey: 'familySports',
    legacyValues: ['popular', 'escolar'],
    keywords: ['popular', 'escolar', 'infantil', 'familiar', 'jornada'],
  },
];

export const INTEREST_IDS: readonly string[] = INTEREST_CATALOG.map((i) => i.id);

const ID_SET = new Set(INTEREST_IDS);

export const isValidInterestId = (value: unknown): value is string =>
  typeof value === 'string' && ID_SET.has(value);

/**
 * Defensive normalization for anything coming from storage, the network or a
 * user-supplied payload: drops unknown/duplicate/non-string values and keeps
 * catalog order so persisted arrays are deterministic.
 */
export const sanitizeInterestIds = (input: unknown): string[] => {
  if (!Array.isArray(input)) return [];
  const found = new Set<string>();
  for (const value of input) {
    if (isValidInterestId(value)) found.add(value);
  }
  return INTEREST_CATALOG.filter((i) => found.has(i.id)).map((i) => i.id);
};

export const getInterest = (id: string): InterestDefinition | undefined =>
  INTEREST_CATALOG.find((i) => i.id === id);

export const interestsByDomain = (domain: InterestDomain): InterestDefinition[] =>
  INTEREST_CATALOG.filter((i) => i.domain === domain);

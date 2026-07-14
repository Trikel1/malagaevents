// Catálogo curado de municipios de Málaga capital y provincia.
// Slugs alineados con `locations.normalized_name` en la base de datos.
// Este catálogo define el orden de aparición, la zona/comarca y los aliases
// para futuras integraciones de scraping municipal. No define eventos.

export type ZoneKey =
  | 'capital'
  | 'costa-occidental'
  | 'axarquia'
  | 'guadalhorce'
  | 'antequera'
  | 'serrania-ronda'
  | 'guadalteba';

export interface LocalityEntry {
  slug: string;          // matches locations.normalized_name
  name: string;          // canonical display name
  zone: ZoneKey;
  aliases?: string[];    // alternate spellings (without/with accents, etc.)
  priority?: number;     // higher = surfaced first within zone
}

export const ZONE_LABELS: Record<ZoneKey, string> = {
  'capital': 'Málaga capital',
  'costa-occidental': 'Costa del Sol Occidental',
  'axarquia': 'Axarquía / Costa Oriental',
  'guadalhorce': 'Valle del Guadalhorce',
  'antequera': 'Antequera y comarca',
  'serrania-ronda': 'Serranía de Ronda',
  'guadalteba': 'Guadalteba e interior',
};

export const ZONE_ORDER: ZoneKey[] = [
  'capital',
  'costa-occidental',
  'axarquia',
  'guadalhorce',
  'antequera',
  'serrania-ronda',
  'guadalteba',
];

export const LOCALITIES_CATALOG: LocalityEntry[] = [
  // Capital
  { slug: 'malaga', name: 'Málaga', zone: 'capital', aliases: ['malaga'], priority: 100 },

  // Costa del Sol Occidental
  { slug: 'torremolinos', name: 'Torremolinos', zone: 'costa-occidental', priority: 90 },
  { slug: 'benalmadena', name: 'Benalmádena', zone: 'costa-occidental', aliases: ['benalmadena'], priority: 90 },
  { slug: 'fuengirola', name: 'Fuengirola', zone: 'costa-occidental', priority: 90 },
  { slug: 'mijas', name: 'Mijas', zone: 'costa-occidental', priority: 90 },
  { slug: 'marbella', name: 'Marbella', zone: 'costa-occidental', priority: 95 },
  { slug: 'estepona', name: 'Estepona', zone: 'costa-occidental', priority: 90 },
  { slug: 'manilva', name: 'Manilva', zone: 'costa-occidental' },
  { slug: 'casares', name: 'Casares', zone: 'costa-occidental' },
  { slug: 'benahavis', name: 'Benahavís', zone: 'costa-occidental', aliases: ['benahavis'] },
  { slug: 'ojen', name: 'Ojén', zone: 'costa-occidental', aliases: ['ojen'] },
  { slug: 'istan', name: 'Istán', zone: 'costa-occidental', aliases: ['istan'] },

  // Axarquía
  { slug: 'velez-malaga', name: 'Vélez-Málaga', zone: 'axarquia', aliases: ['velez-malaga', 'velez malaga'], priority: 90 },
  { slug: 'rincon-de-la-victoria', name: 'Rincón de la Victoria', zone: 'axarquia', aliases: ['rincon-de-la-victoria'] },
  { slug: 'nerja', name: 'Nerja', zone: 'axarquia', priority: 85 },
  { slug: 'torrox', name: 'Torrox', zone: 'axarquia' },
  { slug: 'frigiliana', name: 'Frigiliana', zone: 'axarquia' },
  { slug: 'competa', name: 'Cómpeta', zone: 'axarquia', aliases: ['competa'] },
  { slug: 'algarrobo', name: 'Algarrobo', zone: 'axarquia' },
  { slug: 'sayalonga', name: 'Sayalonga', zone: 'axarquia' },
  { slug: 'periana', name: 'Periana', zone: 'axarquia' },
  { slug: 'alcaucin', name: 'Alcaucín', zone: 'axarquia', aliases: ['alcaucin'] },
  { slug: 'riogordo', name: 'Riogordo', zone: 'axarquia' },
  { slug: 'colmenar', name: 'Colmenar', zone: 'axarquia' },
  { slug: 'benamocarra', name: 'Benamocarra', zone: 'axarquia' },
  { slug: 'almachar', name: 'Almáchar', zone: 'axarquia', aliases: ['almachar'] },
  { slug: 'el-borge', name: 'El Borge', zone: 'axarquia' },
  { slug: 'comares', name: 'Comares', zone: 'axarquia' },
  { slug: 'totalan', name: 'Totalán', zone: 'axarquia', aliases: ['totalan'] },
  { slug: 'moclinejo', name: 'Moclinejo', zone: 'axarquia' },
  { slug: 'macharaviaya', name: 'Macharaviaya', zone: 'axarquia' },
  { slug: 'iznate', name: 'Iznate', zone: 'axarquia' },
  { slug: 'canillas-de-aceituno', name: 'Canillas de Aceituno', zone: 'axarquia' },
  { slug: 'canillas-de-albaida', name: 'Canillas de Albaida', zone: 'axarquia' },
  { slug: 'sedella', name: 'Sedella', zone: 'axarquia' },
  { slug: 'salares', name: 'Salares', zone: 'axarquia' },
  { slug: 'archez', name: 'Árchez', zone: 'axarquia', aliases: ['archez'] },
  { slug: 'alfarnate', name: 'Alfarnate', zone: 'axarquia' },
  { slug: 'alfarnatejo', name: 'Alfarnatejo', zone: 'axarquia' },
  { slug: 'arenas', name: 'Arenas', zone: 'axarquia' },
  { slug: 'benamargosa', name: 'Benamargosa', zone: 'axarquia' },
  { slug: 'cutar', name: 'Cútar', zone: 'axarquia', aliases: ['cutar'] },
  { slug: 'vinuela', name: 'Viñuela', zone: 'axarquia', aliases: ['vinuela'] },

  // Valle del Guadalhorce
  { slug: 'alhaurin-de-la-torre', name: 'Alhaurín de la Torre', zone: 'guadalhorce', aliases: ['alhaurin-de-la-torre'], priority: 85 },
  { slug: 'almogia', name: 'Almogía', zone: 'guadalhorce', aliases: ['almogia'] },
  { slug: 'alhaurin-el-grande', name: 'Alhaurín el Grande', zone: 'guadalhorce', aliases: ['alhaurin-el-grande'] },
  { slug: 'coin', name: 'Coín', zone: 'guadalhorce', aliases: ['coin'], priority: 85 },
  { slug: 'cartama', name: 'Cártama', zone: 'guadalhorce', aliases: ['cartama'] },
  { slug: 'alora', name: 'Álora', zone: 'guadalhorce', aliases: ['alora'] },
  { slug: 'pizarra', name: 'Pizarra', zone: 'guadalhorce' },
  { slug: 'casarabonela', name: 'Casarabonela', zone: 'guadalhorce' },
  { slug: 'monda', name: 'Monda', zone: 'guadalhorce' },
  { slug: 'guaro', name: 'Guaro', zone: 'guadalhorce' },
  { slug: 'tolox', name: 'Tolox', zone: 'guadalhorce' },
  { slug: 'alozaina', name: 'Alozaina', zone: 'guadalhorce' },
  { slug: 'yunquera', name: 'Yunquera', zone: 'guadalhorce' },

  // Antequera y comarca
  { slug: 'antequera', name: 'Antequera', zone: 'antequera', priority: 90 },
  { slug: 'archidona', name: 'Archidona', zone: 'antequera' },
  { slug: 'campillos', name: 'Campillos', zone: 'antequera' },
  { slug: 'teba', name: 'Teba', zone: 'antequera' },
  { slug: 'mollina', name: 'Mollina', zone: 'antequera' },
  { slug: 'alameda', name: 'Alameda', zone: 'antequera' },
  { slug: 'fuente-de-piedra', name: 'Fuente de Piedra', zone: 'antequera' },
  { slug: 'humilladero', name: 'Humilladero', zone: 'antequera' },
  { slug: 'sierra-de-yeguas', name: 'Sierra de Yeguas', zone: 'antequera' },
  { slug: 'villanueva-de-la-concepcion', name: 'Villanueva de la Concepción', zone: 'antequera', aliases: ['villanueva-de-la-concepcion'] },
  { slug: 'villanueva-del-trabuco', name: 'Villanueva del Trabuco', zone: 'antequera' },
  { slug: 'villanueva-del-rosario', name: 'Villanueva del Rosario', zone: 'antequera' },
  { slug: 'villanueva-de-tapia', name: 'Villanueva de Tapia', zone: 'antequera' },
  { slug: 'villanueva-de-algaidas', name: 'Villanueva de Algaidas', zone: 'antequera' },
  { slug: 'casabermeja', name: 'Casabermeja', zone: 'antequera' },
  { slug: 'cuevas-bajas', name: 'Cuevas Bajas', zone: 'antequera' },
  { slug: 'cuevas-de-san-marcos', name: 'Cuevas de San Marcos', zone: 'antequera' },
  { slug: 'valle-de-abdalajis', name: 'Valle de Abdalajís', zone: 'antequera', aliases: ['valle-de-abdalajis'] },

  // Serranía de Ronda
  { slug: 'ronda', name: 'Ronda', zone: 'serrania-ronda', priority: 90 },
  { slug: 'arriate', name: 'Arriate', zone: 'serrania-ronda' },
  { slug: 'benaojan', name: 'Benaoján', zone: 'serrania-ronda', aliases: ['benaojan'] },
  { slug: 'montejaque', name: 'Montejaque', zone: 'serrania-ronda' },
  { slug: 'jimera-de-libar', name: 'Jimera de Líbar', zone: 'serrania-ronda', aliases: ['jimera-de-libar'] },
  { slug: 'atajate', name: 'Atajate', zone: 'serrania-ronda' },
  { slug: 'benadalid', name: 'Benadalid', zone: 'serrania-ronda' },
  { slug: 'benalauria', name: 'Benalauría', zone: 'serrania-ronda', aliases: ['benalauria'] },
  { slug: 'algatocin', name: 'Algatocín', zone: 'serrania-ronda', aliases: ['algatocin'] },
  { slug: 'jubrique', name: 'Jubrique', zone: 'serrania-ronda' },
  { slug: 'genalguacil', name: 'Genalguacil', zone: 'serrania-ronda' },
  { slug: 'alpandeire', name: 'Alpandeire', zone: 'serrania-ronda' },
  { slug: 'farajan', name: 'Faraján', zone: 'serrania-ronda', aliases: ['farajan'] },
  { slug: 'juzcar', name: 'Júzcar', zone: 'serrania-ronda', aliases: ['juzcar'] },
  { slug: 'pujerra', name: 'Pujerra', zone: 'serrania-ronda' },
  { slug: 'parauta', name: 'Parauta', zone: 'serrania-ronda' },
  { slug: 'cartajima', name: 'Cartajima', zone: 'serrania-ronda' },
  { slug: 'igualeja', name: 'Igualeja', zone: 'serrania-ronda' },
  { slug: 'gaucin', name: 'Gaucín', zone: 'serrania-ronda', aliases: ['gaucin'] },
  { slug: 'cortes-de-la-frontera', name: 'Cortes de la Frontera', zone: 'serrania-ronda' },

  // Guadalteba e interior
  { slug: 'ardales', name: 'Ardales', zone: 'guadalteba' },
  { slug: 'el-burgo', name: 'El Burgo', zone: 'guadalteba' },
  { slug: 'canete-la-real', name: 'Cañete la Real', zone: 'guadalteba', aliases: ['canete-la-real'] },
  { slug: 'cuevas-del-becerro', name: 'Cuevas del Becerro', zone: 'guadalteba' },
  { slug: 'carratraca', name: 'Carratraca', zone: 'guadalteba' },
];

// Slug -> entry
export const LOCALITIES_BY_SLUG: Record<string, LocalityEntry> = Object.fromEntries(
  LOCALITIES_CATALOG.map((l) => [l.slug, l])
);

export const MALAGA_CAPITAL_SLUG = 'malaga';

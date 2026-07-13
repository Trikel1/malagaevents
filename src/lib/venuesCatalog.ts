/**
 * Málaga Connect — Static venues catalog (READ-ONLY).
 *
 * Frontend catalog of theaters, halls, auditoriums, museums, festivals and
 * ferial venues across Málaga capital and province. Used to enrich UI
 * (venue filters, discovery listings, institutional demo blocks).
 *
 * Does NOT create events, does NOT modify DB, does NOT activate scraping.
 * Candidates ('candidate' / 'seasonal' / 'historical') are informational.
 */

export type VenueZone =
  | 'malaga-ciudad'
  | 'costa-occidental'
  | 'axarquia'
  | 'interior';

export type VenueKind =
  | 'teatro'
  | 'sala'
  | 'auditorio'
  | 'museo'
  | 'espacio'
  | 'festival'
  | 'ferial'
  | 'exterior';

export type VenueStatus = 'active' | 'candidate' | 'seasonal' | 'historical';

export interface CatalogVenue {
  slug: string;
  name: string;
  city: string;
  zone: VenueZone;
  kind: VenueKind;
  status?: VenueStatus;
  tags?: string[];
  searchAliases?: string[];
}

export const VENUE_ZONES: Array<{ id: VenueZone; label: string }> = [
  { id: 'malaga-ciudad', label: 'Málaga capital' },
  { id: 'costa-occidental', label: 'Costa del Sol occidental' },
  { id: 'axarquia', label: 'Axarquía' },
  { id: 'interior', label: 'Interior y Serranía' },
];

const M = (v: Omit<CatalogVenue, 'city' | 'zone'> & Partial<Pick<CatalogVenue, 'city' | 'zone'>>): CatalogVenue => ({
  city: 'Málaga',
  zone: 'malaga-ciudad',
  status: 'active',
  ...v,
} as CatalogVenue);

export const VENUES_CATALOG: CatalogVenue[] = [
  // ═══════ Málaga capital — Teatros ═══════
  M({ slug: 'teatro-cervantes', name: 'Teatro Cervantes', kind: 'teatro' }),
  M({ slug: 'teatro-echegaray', name: 'Teatro Echegaray', kind: 'teatro' }),
  M({ slug: 'teatro-soho-caixabank', name: 'Teatro del Soho CaixaBank', kind: 'teatro', searchAliases: ['soho'] }),
  M({ slug: 'teatro-canovas', name: 'Teatro Cánovas', kind: 'teatro' }),
  M({ slug: 'teatro-romano', name: 'Teatro Romano', kind: 'espacio', tags: ['exterior'] }),

  // ═══════ Málaga capital — Auditorios ═══════
  M({ slug: 'auditorio-edgar-neville', name: 'Auditorio Edgar Neville', kind: 'auditorio' }),
  M({ slug: 'auditorio-eduardo-ocon', name: 'Auditorio Eduardo Ocón', kind: 'auditorio' }),
  M({ slug: 'auditorio-cortijo-torres', name: 'Auditorio Municipal Cortijo de Torres', kind: 'auditorio' }),

  // ═══════ Málaga capital — Salas de conciertos y espacios ═══════
  M({ slug: 'la-caja-blanca', name: 'La Caja Blanca', kind: 'espacio' }),
  M({ slug: 'la-termica', name: 'La Térmica', kind: 'espacio' }),
  M({ slug: 'ateneo-malaga', name: 'Ateneo de Málaga', kind: 'espacio' }),
  M({ slug: 'centro-cultural-provincial', name: 'Centro Cultural Provincial MVA', kind: 'espacio', searchAliases: ['mva', 'maria victoria atencia'] }),
  M({ slug: 'cine-albeniz', name: 'Cine Albéniz', kind: 'sala' }),
  M({ slug: 'sala-paris-15', name: 'Sala París 15', kind: 'sala', searchAliases: ['paris'] }),
  M({ slug: 'sala-trinchera', name: 'Sala Trinchera', kind: 'sala' }),
  M({ slug: 'la-cochera-cabaret', name: 'La Cochera Cabaret', kind: 'sala' }),
  M({ slug: 'contenedor-cultural-uma', name: 'Contenedor Cultural UMA', kind: 'espacio' }),
  M({ slug: 'sala-gades', name: 'Sala Gades', kind: 'sala', status: 'candidate' }),
  M({ slug: 'sala-falla', name: 'Sala Falla', kind: 'sala', status: 'candidate' }),
  M({ slug: 'velvet-club', name: 'Velvet Club', kind: 'sala', status: 'candidate' }),
  M({ slug: 'sala-marte', name: 'Sala Marte', kind: 'sala', status: 'candidate' }),
  M({ slug: 'sala-vivero', name: 'Sala Vivero', kind: 'sala', status: 'candidate' }),
  M({ slug: 'la-fabrica-de-cerveza', name: 'La Fábrica de Cerveza', kind: 'sala', status: 'candidate' }),
  M({ slug: 'la-garrapata', name: 'La Garrapata', kind: 'sala', status: 'candidate' }),

  // ═══════ Málaga capital — Museos ═══════
  M({ slug: 'museo-picasso-malaga', name: 'Museo Picasso Málaga', kind: 'museo' }),
  M({ slug: 'museo-carmen-thyssen', name: 'Museo Carmen Thyssen', kind: 'museo' }),
  M({ slug: 'centre-pompidou-malaga', name: 'Centre Pompidou Málaga', kind: 'museo' }),
  M({ slug: 'museo-de-malaga', name: 'Museo de Málaga', kind: 'museo' }),
  M({ slug: 'cac-malaga', name: 'CAC Málaga', kind: 'museo', status: 'candidate' }),
  M({ slug: 'coleccion-museo-ruso', name: 'Colección Museo Ruso', kind: 'museo', status: 'historical' }),

  // ═══════ Málaga capital — Exteriores y espacios abiertos ═══════
  M({ slug: 'jardin-la-concepcion', name: 'Jardín Botánico La Concepción', kind: 'exterior' }),
  M({ slug: 'plaza-de-la-constitucion', name: 'Plaza de la Constitución', kind: 'exterior' }),
  M({ slug: 'plaza-de-la-merced', name: 'Plaza de la Merced', kind: 'exterior' }),
  M({ slug: 'muelle-uno', name: 'Muelle Uno', kind: 'exterior' }),
  M({ slug: 'palmeral-sorpresas', name: 'Palmeral de las Sorpresas', kind: 'exterior' }),
  M({ slug: 'dique-de-levante', name: 'Puerto de Málaga — Dique de Levante', kind: 'exterior', tags: ['festivales'] }),
  M({ slug: 'la-malagueta', name: 'Plaza de Toros La Malagueta', kind: 'exterior', status: 'seasonal' }),

  // ═══════ Málaga capital — Feriales y congresos ═══════
  M({ slug: 'fycma', name: 'FYCMA — Palacio de Ferias y Congresos', kind: 'ferial' }),
  M({ slug: 'malaga-forum', name: 'Málaga Forum', kind: 'espacio' }),
  M({ slug: 'recinto-cortijo-torres', name: 'Recinto Ferial Cortijo de Torres', kind: 'ferial' }),

  // ═══════ Málaga capital — Grandes citas ═══════
  M({ slug: 'festival-de-malaga', name: 'Festival de Málaga (Cine)', kind: 'festival', status: 'seasonal' }),
  M({ slug: 'fancine', name: 'Fancine', kind: 'festival', status: 'seasonal' }),
  M({ slug: 'noche-en-blanco', name: 'Noche en Blanco', kind: 'festival', status: 'seasonal' }),
  M({ slug: 'feria-de-malaga', name: 'Feria de Málaga', kind: 'festival', status: 'seasonal' }),
  M({ slug: 'brisa-festival', name: 'Brisa Festival', kind: 'festival', status: 'seasonal' }),
  M({ slug: 'moonlight-malaga', name: 'Moonlight Málaga', kind: 'festival', status: 'seasonal' }),

  // ═══════ Costa del Sol occidental ═══════
  { slug: 'marenostrum-fuengirola', name: 'Marenostrum Fuengirola', city: 'Fuengirola', zone: 'costa-occidental', kind: 'festival', status: 'seasonal' },
  { slug: 'palacio-paz-fuengirola', name: 'Palacio de la Paz', city: 'Fuengirola', zone: 'costa-occidental', kind: 'espacio', status: 'candidate' },
  { slug: 'casa-cultura-fuengirola', name: 'Casa de la Cultura de Fuengirola', city: 'Fuengirola', zone: 'costa-occidental', kind: 'espacio', status: 'candidate' },
  { slug: 'principe-asturias-torremolinos', name: 'Auditorio Príncipe de Asturias', city: 'Torremolinos', zone: 'costa-occidental', kind: 'auditorio', status: 'candidate' },
  { slug: 'canela-party', name: 'Canela Party', city: 'Torremolinos', zone: 'costa-occidental', kind: 'festival', status: 'seasonal' },
  { slug: 'los-alamos-beach', name: 'Los Álamos Beach', city: 'Torremolinos', zone: 'costa-occidental', kind: 'festival', status: 'seasonal' },
  { slug: 'auditorio-benalmadena', name: 'Auditorio Municipal de Benalmádena', city: 'Benalmádena', zone: 'costa-occidental', kind: 'auditorio', status: 'candidate' },
  { slug: 'casa-cultura-benalmadena', name: 'Casa de la Cultura de Benalmádena', city: 'Benalmádena', zone: 'costa-occidental', kind: 'espacio', status: 'candidate' },
  { slug: 'starlite-marbella', name: 'Starlite Marbella', city: 'Marbella', zone: 'costa-occidental', kind: 'festival', status: 'seasonal' },
  { slug: 'palacio-congresos-marbella', name: 'Palacio de Congresos de Marbella', city: 'Marbella', zone: 'costa-occidental', kind: 'ferial', status: 'candidate' },
  { slug: 'teatro-ciudad-marbella', name: 'Teatro Ciudad de Marbella', city: 'Marbella', zone: 'costa-occidental', kind: 'teatro', status: 'candidate' },
  { slug: 'marbella-arena', name: 'Marbella Arena', city: 'Marbella', zone: 'costa-occidental', kind: 'auditorio', status: 'candidate' },
  { slug: 'auditorio-felipe-vi', name: 'Auditorio Felipe VI', city: 'Estepona', zone: 'costa-occidental', kind: 'auditorio', status: 'candidate' },
  { slug: 'palacio-congresos-estepona', name: 'Palacio de Exposiciones y Congresos', city: 'Estepona', zone: 'costa-occidental', kind: 'ferial', status: 'candidate' },
  { slug: 'teatro-las-lagunas', name: 'Teatro Las Lagunas', city: 'Mijas', zone: 'costa-occidental', kind: 'teatro', status: 'candidate' },
  { slug: 'auditorio-mijas', name: 'Auditorio Municipal de Mijas', city: 'Mijas', zone: 'costa-occidental', kind: 'auditorio', status: 'candidate' },

  // ═══════ Axarquía ═══════
  { slug: 'weekend-beach-torre-del-mar', name: 'Weekend Beach Torre del Mar', city: 'Torre del Mar', zone: 'axarquia', kind: 'festival', status: 'seasonal' },
  { slug: 'teatro-del-carmen', name: 'Teatro del Carmen', city: 'Vélez-Málaga', zone: 'axarquia', kind: 'teatro', status: 'candidate' },
  { slug: 'lope-de-vega-velez', name: 'Teatro-Cine Lope de Vega', city: 'Vélez-Málaga', zone: 'axarquia', kind: 'teatro', status: 'candidate' },
  { slug: 'casarte-azul-velez', name: 'Café Teatro Casarte Azul', city: 'Vélez-Málaga', zone: 'axarquia', kind: 'sala', status: 'candidate' },
  { slug: 'centro-cultural-nerja', name: 'Centro Cultural Villa de Nerja', city: 'Nerja', zone: 'axarquia', kind: 'espacio', status: 'candidate' },
  { slug: 'balcon-de-europa', name: 'Balcón de Europa', city: 'Nerja', zone: 'axarquia', kind: 'exterior', status: 'seasonal' },
  { slug: 'teatro-torrox', name: 'Teatro Municipal Torrox', city: 'Torrox', zone: 'axarquia', kind: 'teatro', status: 'candidate' },

  // ═══════ Interior y Serranía ═══════
  { slug: 'teatro-torcal-antequera', name: 'Teatro Municipal Torcal', city: 'Antequera', zone: 'interior', kind: 'teatro', status: 'candidate' },
  { slug: 'plaza-toros-antequera', name: 'Plaza de Toros de Antequera', city: 'Antequera', zone: 'interior', kind: 'exterior', status: 'seasonal' },
  { slug: 'teatro-vicente-espinel', name: 'Teatro Vicente Espinel', city: 'Ronda', zone: 'interior', kind: 'teatro', status: 'candidate' },
  { slug: 'casa-cultura-alhaurin-torre', name: 'Casa de la Cultura', city: 'Alhaurín de la Torre', zone: 'interior', kind: 'espacio', status: 'candidate' },
  { slug: 'casa-cultura-cartama', name: 'Casa de la Cultura', city: 'Cártama', zone: 'interior', kind: 'espacio', status: 'candidate' },
  { slug: 'casa-cultura-coin', name: 'Casa de la Cultura', city: 'Coín', zone: 'interior', kind: 'espacio', status: 'candidate' },
  { slug: 'casa-cultura-pizarra', name: 'Casa de la Cultura', city: 'Pizarra', zone: 'interior', kind: 'espacio', status: 'candidate' },
  { slug: 'casa-cultura-alora', name: 'Casa de la Cultura', city: 'Álora', zone: 'interior', kind: 'espacio', status: 'candidate' },
  { slug: 'casa-cultura-ardales', name: 'Casa de la Cultura', city: 'Ardales', zone: 'interior', kind: 'espacio', status: 'candidate' },
  { slug: 'casa-cultura-archidona', name: 'Casa de la Cultura', city: 'Archidona', zone: 'interior', kind: 'espacio', status: 'candidate' },
];

export const MUNICIPALITIES: Array<{ name: string; zone: VenueZone }> = [
  { name: 'Málaga', zone: 'malaga-ciudad' },
  { name: 'Marbella', zone: 'costa-occidental' },
  { name: 'Fuengirola', zone: 'costa-occidental' },
  { name: 'Torremolinos', zone: 'costa-occidental' },
  { name: 'Benalmádena', zone: 'costa-occidental' },
  { name: 'Estepona', zone: 'costa-occidental' },
  { name: 'Mijas', zone: 'costa-occidental' },
  { name: 'Manilva', zone: 'costa-occidental' },
  { name: 'Casares', zone: 'costa-occidental' },
  { name: 'Ojén', zone: 'costa-occidental' },
  { name: 'Vélez-Málaga', zone: 'axarquia' },
  { name: 'Rincón de la Victoria', zone: 'axarquia' },
  { name: 'Nerja', zone: 'axarquia' },
  { name: 'Frigiliana', zone: 'axarquia' },
  { name: 'Torrox', zone: 'axarquia' },
  { name: 'Antequera', zone: 'interior' },
  { name: 'Ronda', zone: 'interior' },
  { name: 'Archidona', zone: 'interior' },
  { name: 'Álora', zone: 'interior' },
  { name: 'Ardales', zone: 'interior' },
  { name: 'Alhaurín de la Torre', zone: 'interior' },
  { name: 'Cártama', zone: 'interior' },
  { name: 'Coín', zone: 'interior' },
  { name: 'Pizarra', zone: 'interior' },
];

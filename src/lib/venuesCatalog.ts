/**
 * Málaga Connect — Static venues catalog (READ-ONLY, frontend).
 *
 * Catálogo curado de teatros, salas, auditorios, museos, festivales y recintos
 * de Málaga capital y provincia. Se usa solo para enriquecer el frontend
 * (selectores, agrupación por tipo, aliases de búsqueda). No crea eventos,
 * no toca la base de datos y no activa scraping.
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
  /**
   * Secondary kinds this venue also belongs to, for filter buttons.
   * Ex: Teatro Romano is `exterior` but also surfaces under Teatros.
   */
  extraKinds?: VenueKind[];
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

export const VENUE_KIND_LABELS: Record<VenueKind, string> = {
  teatro: 'Teatros',
  sala: 'Salas',
  auditorio: 'Auditorios',
  museo: 'Museos',
  espacio: 'Centros culturales',
  festival: 'Festivales',
  ferial: 'Recintos feriales',
  exterior: 'Exteriores',
};

const M = (v: Omit<CatalogVenue, 'city' | 'zone'> & Partial<Pick<CatalogVenue, 'city' | 'zone'>>): CatalogVenue => ({
  city: 'Málaga',
  zone: 'malaga-ciudad',
  status: 'active',
  ...v,
} as CatalogVenue);

export const VENUES_CATALOG: CatalogVenue[] = [
  // ═══════ Málaga capital — Teatros ═══════
  M({ slug: 'teatro-cervantes', name: 'Teatro Cervantes', kind: 'teatro', searchAliases: ['cervantes'] }),
  M({ slug: 'teatro-echegaray', name: 'Teatro Echegaray', kind: 'teatro', searchAliases: ['echegaray', 'factoria echegaray'] }),
  M({ slug: 'teatro-soho-caixabank', name: 'Teatro del Soho CaixaBank', kind: 'teatro', searchAliases: ['soho', 'antonio banderas'] }),
  M({ slug: 'teatro-canovas', name: 'Teatro Cánovas', kind: 'teatro', searchAliases: ['canovas'] }),
  M({ slug: 'teatro-romano', name: 'Teatro Romano', kind: 'exterior', tags: ['patrimonio'], searchAliases: ['romano'] }),

  // ═══════ Málaga capital — Auditorios ═══════
  M({ slug: 'auditorio-edgar-neville', name: 'Auditorio Edgar Neville', kind: 'auditorio', searchAliases: ['edgar neville', 'neville'] }),
  M({ slug: 'auditorio-eduardo-ocon', name: 'Auditorio Eduardo Ocón', kind: 'auditorio', searchAliases: ['eduardo ocon', 'ocon'] }),
  M({ slug: 'auditorio-cortijo-torres', name: 'Auditorio Municipal Cortijo de Torres', kind: 'auditorio', searchAliases: ['cortijo de torres'] }),

  // ═══════ Málaga capital — Salas de conciertos y cine ═══════
  M({ slug: 'la-caja-blanca', name: 'La Caja Blanca', kind: 'espacio', searchAliases: ['caja blanca'] }),
  M({ slug: 'la-termica', name: 'La Térmica', kind: 'espacio', searchAliases: ['termica', 'la termica'] }),
  M({ slug: 'ateneo-malaga', name: 'Ateneo de Málaga', kind: 'espacio', searchAliases: ['ateneo'] }),
  M({ slug: 'centro-cultural-provincial', name: 'Centro Cultural Provincial MVA', kind: 'espacio', searchAliases: ['mva', 'maria victoria atencia'] }),
  M({ slug: 'cine-albeniz', name: 'Cine Albéniz', kind: 'sala', searchAliases: ['albeniz', 'cine albeniz'] }),
  M({ slug: 'sala-paris-15', name: 'Sala París 15', kind: 'sala', searchAliases: ['paris 15', 'paris15'] }),
  M({ slug: 'sala-trinchera', name: 'Sala Trinchera', kind: 'sala', searchAliases: ['trinchera'] }),
  M({ slug: 'la-cochera-cabaret', name: 'La Cochera Cabaret', kind: 'sala', searchAliases: ['cochera', 'cochera cabaret'] }),
  M({ slug: 'contenedor-cultural-uma', name: 'Contenedor Cultural UMA', kind: 'espacio', searchAliases: ['contenedor', 'uma'] }),
  M({ slug: 'sala-gades', name: 'Sala Gades', kind: 'sala', status: 'candidate', searchAliases: ['gades'] }),
  M({ slug: 'sala-falla', name: 'Sala Falla', kind: 'sala', status: 'candidate', searchAliases: ['falla'] }),
  M({ slug: 'velvet-club', name: 'Velvet Club', kind: 'sala', status: 'candidate', searchAliases: ['velvet'] }),
  M({ slug: 'sala-marte', name: 'Sala Marte', kind: 'sala', status: 'candidate', searchAliases: ['marte'] }),
  M({ slug: 'sala-vivero', name: 'Sala Vivero', kind: 'sala', status: 'candidate', searchAliases: ['vivero'] }),
  M({ slug: 'la-fabrica-de-cerveza', name: 'La Fábrica de Cerveza', kind: 'sala', status: 'candidate', searchAliases: ['fabrica de cerveza'] }),
  M({ slug: 'la-garrapata', name: 'La Garrapata', kind: 'sala', status: 'candidate', searchAliases: ['garrapata'] }),
  M({ slug: 'zz-pub', name: 'ZZ Pub', kind: 'sala', status: 'candidate', searchAliases: ['zz'] }),
  M({ slug: 'the-hall-malaga', name: 'The Hall Málaga', kind: 'sala', status: 'candidate', searchAliases: ['the hall'] }),
  M({ slug: 'clarence-jazz-club', name: 'Clarence Jazz Club', kind: 'sala', status: 'candidate', searchAliases: ['clarence', 'jazz'] }),
  M({ slug: 'kelipe-flamenco', name: 'Kelipe Centro de Arte Flamenco', kind: 'sala', status: 'candidate', searchAliases: ['kelipe', 'flamenco'] }),
  M({ slug: 'fundacion-unicaja-maria-cristina', name: 'Fundación Unicaja María Cristina', kind: 'espacio', status: 'candidate', searchAliases: ['maria cristina', 'unicaja'] }),

  // ═══════ Málaga capital — Museos ═══════
  M({ slug: 'museo-picasso-malaga', name: 'Museo Picasso Málaga', kind: 'museo', searchAliases: ['picasso'] }),
  M({ slug: 'museo-carmen-thyssen', name: 'Museo Carmen Thyssen', kind: 'museo', searchAliases: ['thyssen', 'carmen thyssen'] }),
  M({ slug: 'centre-pompidou-malaga', name: 'Centre Pompidou Málaga', kind: 'museo', searchAliases: ['pompidou'] }),
  M({ slug: 'museo-de-malaga', name: 'Museo de Málaga', kind: 'museo' }),
  M({ slug: 'cac-malaga', name: 'CAC Málaga', kind: 'museo', searchAliases: ['cac', 'centro arte contemporaneo'] }),
  M({ slug: 'museo-revello-de-toro', name: 'Museo Revello de Toro', kind: 'museo', status: 'candidate', searchAliases: ['revello'] }),
  M({ slug: 'museo-patrimonio-municipal', name: 'Museo del Patrimonio Municipal', kind: 'museo', status: 'candidate', searchAliases: ['mupam', 'patrimonio'] }),
  M({ slug: 'casa-natal-picasso', name: 'Casa Natal Picasso', kind: 'museo', status: 'candidate', searchAliases: ['casa natal'] }),
  M({ slug: 'coleccion-museo-ruso', name: 'Colección Museo Ruso', kind: 'museo', status: 'historical' }),

  // ═══════ Málaga capital — Exteriores y espacios abiertos ═══════
  M({ slug: 'jardin-la-concepcion', name: 'Jardín Botánico-Histórico La Concepción', kind: 'exterior', searchAliases: ['concepcion', 'jardin botanico'] }),
  M({ slug: 'plaza-de-la-constitucion', name: 'Plaza de la Constitución', kind: 'exterior', searchAliases: ['constitucion'] }),
  M({ slug: 'plaza-de-la-merced', name: 'Plaza de la Merced', kind: 'exterior', searchAliases: ['merced'] }),
  M({ slug: 'muelle-uno', name: 'Muelle Uno', kind: 'exterior', searchAliases: ['muelle'] }),
  M({ slug: 'palmeral-sorpresas', name: 'Palmeral de las Sorpresas', kind: 'exterior', searchAliases: ['palmeral'] }),
  M({ slug: 'dique-de-levante', name: 'Puerto de Málaga — Dique de Levante', kind: 'exterior', tags: ['festivales'], searchAliases: ['dique', 'levante'] }),
  M({ slug: 'la-malagueta', name: 'Plaza de Toros La Malagueta', kind: 'exterior', status: 'seasonal', searchAliases: ['malagueta'] }),
  M({ slug: 'playa-malagueta', name: 'Playa de La Malagueta', kind: 'exterior', status: 'seasonal' }),
  M({ slug: 'parque-de-malaga', name: 'Parque de Málaga', kind: 'exterior', status: 'candidate', searchAliases: ['parque'] }),

  // ═══════ Málaga capital — Feriales y congresos ═══════
  M({ slug: 'fycma', name: 'FYCMA — Palacio de Ferias y Congresos', kind: 'ferial', searchAliases: ['fycma', 'palacio ferias'] }),
  M({ slug: 'malaga-forum', name: 'Málaga Forum', kind: 'espacio', searchAliases: ['forum'] }),
  M({ slug: 'recinto-cortijo-torres', name: 'Recinto Ferial Cortijo de Torres', kind: 'ferial', searchAliases: ['cortijo', 'recinto ferial'] }),

  // ═══════ Málaga capital — Grandes citas ═══════
  M({ slug: 'festival-de-malaga', name: 'Festival de Málaga (Cine)', kind: 'festival', status: 'seasonal', searchAliases: ['festival cine malaga'] }),
  M({ slug: 'fancine', name: 'Fancine', kind: 'festival', status: 'seasonal' }),
  M({ slug: 'noche-en-blanco', name: 'Noche en Blanco', kind: 'festival', status: 'seasonal' }),
  M({ slug: 'feria-de-malaga', name: 'Feria de Málaga', kind: 'festival', status: 'seasonal', searchAliases: ['feria'] }),
  M({ slug: 'brisa-festival', name: 'Brisa Festival', kind: 'festival', status: 'seasonal', searchAliases: ['brisa'] }),
  M({ slug: 'moonlight-malaga', name: 'Moonlight Málaga', kind: 'festival', status: 'seasonal', searchAliases: ['moonlight'] }),

  // ═══════ Costa del Sol occidental ═══════
  { slug: 'marenostrum-fuengirola', name: 'Marenostrum Fuengirola', city: 'Fuengirola', zone: 'costa-occidental', kind: 'festival', status: 'seasonal', searchAliases: ['marenostrum', 'fuengirola'] },
  { slug: 'palacio-paz-fuengirola', name: 'Palacio de la Paz', city: 'Fuengirola', zone: 'costa-occidental', kind: 'espacio', status: 'candidate', searchAliases: ['palacio paz', 'fuengirola'] },
  { slug: 'casa-cultura-fuengirola', name: 'Casa de la Cultura de Fuengirola', city: 'Fuengirola', zone: 'costa-occidental', kind: 'espacio', status: 'candidate', searchAliases: ['fuengirola'] },
  { slug: 'principe-asturias-torremolinos', name: 'Auditorio Municipal Príncipe de Asturias', city: 'Torremolinos', zone: 'costa-occidental', kind: 'auditorio', status: 'candidate', searchAliases: ['principe asturias', 'torremolinos'] },
  { slug: 'canela-party', name: 'Canela Party', city: 'Torremolinos', zone: 'costa-occidental', kind: 'festival', status: 'seasonal' },
  { slug: 'los-alamos-beach', name: 'Los Álamos Beach', city: 'Torremolinos', zone: 'costa-occidental', kind: 'festival', status: 'seasonal', searchAliases: ['alamos'] },
  { slug: 'auditorio-benalmadena', name: 'Auditorio Municipal de Benalmádena', city: 'Benalmádena', zone: 'costa-occidental', kind: 'auditorio', status: 'candidate', searchAliases: ['benalmadena'] },
  { slug: 'casa-cultura-benalmadena', name: 'Casa de la Cultura de Benalmádena', city: 'Benalmádena', zone: 'costa-occidental', kind: 'espacio', status: 'candidate', searchAliases: ['benalmadena'] },
  { slug: 'starlite-marbella', name: 'Starlite Marbella', city: 'Marbella', zone: 'costa-occidental', kind: 'festival', status: 'seasonal', searchAliases: ['starlite', 'marbella'] },
  { slug: 'palacio-congresos-marbella', name: 'Palacio de Congresos de Marbella', city: 'Marbella', zone: 'costa-occidental', kind: 'ferial', status: 'candidate' },
  { slug: 'teatro-ciudad-marbella', name: 'Teatro Ciudad de Marbella', city: 'Marbella', zone: 'costa-occidental', kind: 'teatro', status: 'candidate', searchAliases: ['ciudad marbella'] },
  { slug: 'marbella-arena', name: 'Marbella Arena', city: 'Marbella', zone: 'costa-occidental', kind: 'auditorio', status: 'candidate', searchAliases: ['arena marbella'] },
  { slug: 'auditorio-felipe-vi', name: 'Auditorio Felipe VI', city: 'Estepona', zone: 'costa-occidental', kind: 'auditorio', status: 'candidate', searchAliases: ['felipe vi', 'estepona'] },
  { slug: 'centro-cultural-padre-manuel', name: 'Centro Cultural Padre Manuel', city: 'Estepona', zone: 'costa-occidental', kind: 'espacio', status: 'candidate', searchAliases: ['padre manuel', 'estepona'] },
  { slug: 'palacio-congresos-estepona', name: 'Palacio de Exposiciones y Congresos', city: 'Estepona', zone: 'costa-occidental', kind: 'ferial', status: 'candidate', searchAliases: ['estepona'] },
  { slug: 'teatro-las-lagunas', name: 'Teatro Las Lagunas', city: 'Mijas', zone: 'costa-occidental', kind: 'teatro', status: 'candidate', searchAliases: ['las lagunas', 'mijas'] },
  { slug: 'casa-cultura-lagunas', name: 'Casa de la Cultura Las Lagunas', city: 'Mijas', zone: 'costa-occidental', kind: 'espacio', status: 'candidate', searchAliases: ['lagunas'] },
  { slug: 'auditorio-mijas', name: 'Auditorio Municipal de Mijas', city: 'Mijas', zone: 'costa-occidental', kind: 'auditorio', status: 'candidate', searchAliases: ['mijas'] },

  // ═══════ Axarquía ═══════
  { slug: 'weekend-beach-torre-del-mar', name: 'Weekend Beach Torre del Mar', city: 'Torre del Mar', zone: 'axarquia', kind: 'festival', status: 'seasonal', searchAliases: ['weekend beach', 'torre del mar'] },
  { slug: 'teatro-del-carmen', name: 'Teatro del Carmen', city: 'Vélez-Málaga', zone: 'axarquia', kind: 'teatro', status: 'candidate', searchAliases: ['carmen', 'velez'] },
  { slug: 'lope-de-vega-velez', name: 'Teatro-Cine Lope de Vega', city: 'Vélez-Málaga', zone: 'axarquia', kind: 'teatro', status: 'candidate', searchAliases: ['lope de vega', 'velez'] },
  { slug: 'casarte-azul-velez', name: 'Café Teatro Casarte Azul', city: 'Vélez-Málaga', zone: 'axarquia', kind: 'sala', status: 'candidate' },
  { slug: 'centro-cultural-nerja', name: 'Centro Cultural Villa de Nerja', city: 'Nerja', zone: 'axarquia', kind: 'espacio', status: 'candidate', searchAliases: ['nerja'] },
  { slug: 'cueva-de-nerja', name: 'Cueva de Nerja', city: 'Nerja', zone: 'axarquia', kind: 'festival', status: 'seasonal', searchAliases: ['cueva', 'festival cueva nerja'] },
  { slug: 'balcon-de-europa', name: 'Balcón de Europa', city: 'Nerja', zone: 'axarquia', kind: 'exterior', status: 'seasonal', searchAliases: ['balcon europa'] },
  { slug: 'auditorio-rincon-victoria', name: 'Auditorio Municipal de Rincón de la Victoria', city: 'Rincón de la Victoria', zone: 'axarquia', kind: 'auditorio', status: 'candidate', searchAliases: ['rincon', 'rincon victoria'] },
  { slug: 'casa-apero-frigiliana', name: 'Casa del Apero', city: 'Frigiliana', zone: 'axarquia', kind: 'espacio', status: 'candidate', searchAliases: ['frigiliana'] },
  { slug: 'casa-cultura-torrox', name: 'Casa de la Cultura de Torrox', city: 'Torrox', zone: 'axarquia', kind: 'espacio', status: 'candidate', searchAliases: ['torrox'] },
  { slug: 'teatro-torrox', name: 'Teatro Municipal Torrox', city: 'Torrox', zone: 'axarquia', kind: 'teatro', status: 'candidate' },

  // ═══════ Interior y Serranía ═══════
  { slug: 'teatro-torcal-antequera', name: 'Teatro Municipal Torcal', city: 'Antequera', zone: 'interior', kind: 'teatro', status: 'candidate', searchAliases: ['torcal', 'antequera'] },
  { slug: 'plaza-toros-antequera', name: 'Plaza de Toros de Antequera', city: 'Antequera', zone: 'interior', kind: 'exterior', status: 'seasonal' },
  { slug: 'teatro-vicente-espinel', name: 'Teatro Vicente Espinel', city: 'Ronda', zone: 'interior', kind: 'teatro', status: 'candidate', searchAliases: ['vicente espinel', 'ronda'] },
  { slug: 'palacio-congresos-ronda', name: 'Palacio de Congresos de Ronda', city: 'Ronda', zone: 'interior', kind: 'ferial', status: 'candidate', searchAliases: ['ronda'] },
  { slug: 'casa-cultura-alhaurin-torre', name: 'Casa de la Cultura', city: 'Alhaurín de la Torre', zone: 'interior', kind: 'espacio', status: 'candidate', searchAliases: ['alhaurin torre'] },
  { slug: 'auditorio-alhaurin-torre', name: 'Auditorio Municipal', city: 'Alhaurín de la Torre', zone: 'interior', kind: 'auditorio', status: 'candidate' },
  { slug: 'teatro-antonio-gala', name: 'Teatro Antonio Gala', city: 'Alhaurín el Grande', zone: 'interior', kind: 'teatro', status: 'candidate', searchAliases: ['antonio gala', 'alhaurin grande'] },
  { slug: 'teatro-carthima', name: 'Teatro Municipal Carthima', city: 'Cártama', zone: 'interior', kind: 'teatro', status: 'candidate', searchAliases: ['carthima', 'cartama'] },
  { slug: 'teatro-alameda-coin', name: 'Teatro Alameda', city: 'Coín', zone: 'interior', kind: 'teatro', status: 'candidate', searchAliases: ['alameda', 'coin'] },
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
  { name: 'Alhaurín el Grande', zone: 'interior' },
  { name: 'Cártama', zone: 'interior' },
  { name: 'Coín', zone: 'interior' },
  { name: 'Pizarra', zone: 'interior' },
];

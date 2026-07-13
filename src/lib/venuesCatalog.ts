/**
 * Málaga Connect — Static venues catalog.
 *
 * READ-ONLY constants used to enrich UI (venue filters, discovery listings,
 * institutional demo blocks). Does NOT create events, does NOT modify DB.
 *
 * Grouped by zona for the province-wide filter dropdown.
 */

export type VenueZone =
  | 'malaga-ciudad'
  | 'costa-occidental'
  | 'axarquia'
  | 'interior';

export interface CatalogVenue {
  slug: string;
  name: string;
  city: string;
  zone: VenueZone;
  kind: 'teatro' | 'sala' | 'auditorio' | 'museo' | 'espacio' | 'festival' | 'ferial';
}

export const VENUE_ZONES: Array<{ id: VenueZone; label: string }> = [
  { id: 'malaga-ciudad', label: 'Málaga ciudad' },
  { id: 'costa-occidental', label: 'Costa del Sol occidental' },
  { id: 'axarquia', label: 'Axarquía' },
  { id: 'interior', label: 'Interior y Serranía' },
];

export const VENUES_CATALOG: CatalogVenue[] = [
  // Málaga ciudad — teatros y salas
  { slug: 'teatro-cervantes', name: 'Teatro Cervantes', city: 'Málaga', zone: 'malaga-ciudad', kind: 'teatro' },
  { slug: 'teatro-echegaray', name: 'Teatro Echegaray', city: 'Málaga', zone: 'malaga-ciudad', kind: 'teatro' },
  { slug: 'teatro-soho-caixabank', name: 'Teatro del Soho CaixaBank', city: 'Málaga', zone: 'malaga-ciudad', kind: 'teatro' },
  { slug: 'teatro-canovas', name: 'Teatro Cánovas', city: 'Málaga', zone: 'malaga-ciudad', kind: 'teatro' },
  { slug: 'la-termica', name: 'La Térmica', city: 'Málaga', zone: 'malaga-ciudad', kind: 'espacio' },
  { slug: 'mva', name: 'MVA (Museo Vivo de las Artes)', city: 'Málaga', zone: 'malaga-ciudad', kind: 'espacio' },
  { slug: 'auditorio-edgar-neville', name: 'Auditorio Edgar Neville', city: 'Málaga', zone: 'malaga-ciudad', kind: 'auditorio' },
  { slug: 'la-caja-blanca', name: 'La Caja Blanca', city: 'Málaga', zone: 'malaga-ciudad', kind: 'espacio' },
  { slug: 'centro-cultural-provincial', name: 'Centro Cultural Provincial', city: 'Málaga', zone: 'malaga-ciudad', kind: 'espacio' },
  { slug: 'ateneo-malaga', name: 'Ateneo de Málaga', city: 'Málaga', zone: 'malaga-ciudad', kind: 'espacio' },
  { slug: 'cine-albeniz', name: 'Cine Albéniz', city: 'Málaga', zone: 'malaga-ciudad', kind: 'sala' },
  { slug: 'teatro-romano', name: 'Teatro Romano', city: 'Málaga', zone: 'malaga-ciudad', kind: 'espacio' },
  { slug: 'auditorio-cortijo-torres', name: 'Auditorio Municipal Cortijo de Torres', city: 'Málaga', zone: 'malaga-ciudad', kind: 'auditorio' },
  { slug: 'auditorio-eduardo-ocon', name: 'Auditorio Eduardo Ocón', city: 'Málaga', zone: 'malaga-ciudad', kind: 'auditorio' },
  { slug: 'sala-paris-15', name: 'Sala París 15', city: 'Málaga', zone: 'malaga-ciudad', kind: 'sala' },
  { slug: 'sala-trinchera', name: 'Sala Trinchera', city: 'Málaga', zone: 'malaga-ciudad', kind: 'sala' },
  { slug: 'la-cochera-cabaret', name: 'La Cochera Cabaret', city: 'Málaga', zone: 'malaga-ciudad', kind: 'sala' },
  { slug: 'contenedor-cultural-uma', name: 'Contenedor Cultural UMA', city: 'Málaga', zone: 'malaga-ciudad', kind: 'espacio' },
  // Málaga ciudad — museos
  { slug: 'museo-picasso-malaga', name: 'Museo Picasso Málaga', city: 'Málaga', zone: 'malaga-ciudad', kind: 'museo' },
  { slug: 'museo-carmen-thyssen', name: 'Museo Carmen Thyssen', city: 'Málaga', zone: 'malaga-ciudad', kind: 'museo' },
  { slug: 'centre-pompidou-malaga', name: 'Centre Pompidou Málaga', city: 'Málaga', zone: 'malaga-ciudad', kind: 'museo' },
  { slug: 'museo-de-malaga', name: 'Museo de Málaga', city: 'Málaga', zone: 'malaga-ciudad', kind: 'museo' },
  { slug: 'jardin-la-concepcion', name: 'Jardín Botánico-Histórico La Concepción', city: 'Málaga', zone: 'malaga-ciudad', kind: 'espacio' },
  { slug: 'fycma', name: 'FYCMA — Palacio de Ferias', city: 'Málaga', zone: 'malaga-ciudad', kind: 'ferial' },
  { slug: 'malaga-forum', name: 'Málaga Forum', city: 'Málaga', zone: 'malaga-ciudad', kind: 'espacio' },

  // Costa del Sol occidental
  { slug: 'marenostrum-fuengirola', name: 'Marenostrum Fuengirola', city: 'Fuengirola', zone: 'costa-occidental', kind: 'festival' },
  { slug: 'starlite-marbella', name: 'Starlite Marbella', city: 'Marbella', zone: 'costa-occidental', kind: 'festival' },
  { slug: 'brisa-festival', name: 'Brisa Festival', city: 'Málaga', zone: 'costa-occidental', kind: 'festival' },
  { slug: 'canela-party', name: 'Canela Party', city: 'Torremolinos', zone: 'costa-occidental', kind: 'festival' },
  { slug: 'los-alamos-beach', name: 'Los Álamos Beach', city: 'Torremolinos', zone: 'costa-occidental', kind: 'festival' },

  // Axarquía
  { slug: 'weekend-beach-torre-del-mar', name: 'Weekend Beach Torre del Mar', city: 'Torre del Mar', zone: 'axarquia', kind: 'festival' },

  // Grandes citas de ciudad (asignadas a Málaga ciudad como referencia)
  { slug: 'festival-de-malaga', name: 'Festival de Málaga (Cine)', city: 'Málaga', zone: 'malaga-ciudad', kind: 'festival' },
  { slug: 'fancine', name: 'Fancine', city: 'Málaga', zone: 'malaga-ciudad', kind: 'festival' },
  { slug: 'noche-en-blanco', name: 'Noche en Blanco', city: 'Málaga', zone: 'malaga-ciudad', kind: 'festival' },
  { slug: 'feria-de-malaga', name: 'Feria de Málaga', city: 'Málaga', zone: 'malaga-ciudad', kind: 'festival' },
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

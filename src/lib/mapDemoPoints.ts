import type { MapMarker } from '@/modules/maps/types';

/**
 * Curated demo points so the Map view never appears empty.
 * Real names of public landmarks in Málaga — these are NOT translated.
 */
export const DEMO_MAP_POINTS: MapMarker[] = [
  { id: 'demo-cervantes', kind: 'venue', title: 'Teatro Cervantes', subtitle: 'Calle Ramos Marín, s/n', address: 'Calle Ramos Marín, s/n', lat: 36.7245, lng: -4.4170 },
  { id: 'demo-soho', kind: 'venue', title: 'Teatro del Soho CaixaBank', subtitle: 'Calle Córdoba, 13', address: 'Calle Córdoba, 13', lat: 36.7193, lng: -4.4254 },
  { id: 'demo-paris15', kind: 'venue', title: 'Sala París 15', subtitle: 'Calle París, 15', address: 'Calle París, 15', lat: 36.7178, lng: -4.4195 },
  { id: 'demo-trinchera', kind: 'venue', title: 'La Trinchera', subtitle: 'Calle Carretería, 88', address: 'Calle Carretería, 88', lat: 36.7196, lng: -4.4302 },
  { id: 'demo-cochera', kind: 'venue', title: 'La Cochera Cabaret', subtitle: 'Avenida de los Guindos, 19', address: 'Avenida de los Guindos, 19', lat: 36.7008, lng: -4.4438 },
  { id: 'demo-muelleuno', kind: 'venue', title: 'Muelle Uno', subtitle: 'Puerto de Málaga', address: 'Puerto de Málaga', lat: 36.7155, lng: -4.4150 },
  { id: 'demo-rosaleda', kind: 'sport', title: 'Estadio La Rosaleda', subtitle: 'Paseo de Martiricos, s/n', address: 'Paseo de Martiricos, s/n', lat: 36.7411, lng: -4.4262 },
  { id: 'demo-carpena', kind: 'sport', title: 'Palacio de Deportes Martín Carpena', subtitle: 'Calle Marie Curie, 1', address: 'Calle Marie Curie, 1', lat: 36.6912, lng: -4.4828 },
  { id: 'demo-picasso', kind: 'venue', title: 'Museo Picasso Málaga', subtitle: 'Palacio de Buenavista, San Agustín, 8', address: 'San Agustín, 8', lat: 36.7223, lng: -4.4178 },
  { id: 'demo-pompidou', kind: 'venue', title: 'Centre Pompidou Málaga', subtitle: 'Pasaje Doctor Carrillo Casaux', address: 'Pasaje Doctor Carrillo Casaux', lat: 36.7173, lng: -4.4136 },
];

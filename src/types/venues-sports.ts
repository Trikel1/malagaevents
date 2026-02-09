import type { SportCategory } from './sports';

export interface SportVenue {
  id: string;
  name: string;
  sports: SportCategory[];
  city: string;
  address?: string;
  lat?: number;
  lng?: number;
}

export const MOCK_SPORT_VENUES: SportVenue[] = [
  { id: 'v1', name: 'Estadio La Rosaleda', sports: ['futbol'], city: 'Málaga', address: 'Paseo de Martiricos, s/n', lat: 36.7304, lng: -4.4312 },
  { id: 'v2', name: 'Palacio de Deportes Martín Carpena', sports: ['baloncesto', 'balonmano'], city: 'Málaga', address: 'Avda. José Ortega y Gasset, 143', lat: 36.6945, lng: -4.4614 },
  { id: 'v3', name: 'Pabellón Universitario', sports: ['futsal', 'baloncesto'], city: 'Málaga', address: 'Campus de Teatinos', lat: 36.7155, lng: -4.4730 },
  { id: 'v4', name: 'Centro Deportivo Ciudad de Málaga', sports: ['balonmano'], city: 'Málaga', address: 'C/ Héroe de Sostoa, s/n' },
  { id: 'v5', name: 'Estadio El Maulí', sports: ['futbol'], city: 'Antequera', address: 'Avda. de la Legión, s/n' },
  { id: 'v6', name: 'Club de Tenis Puente Romano', sports: ['tenis'], city: 'Marbella', address: 'Bulevar Príncipe Alfonso von Hohenlohe' },
  { id: 'v7', name: 'Circuito de Málaga', sports: ['motor'], city: 'Campanillas', address: 'Parque Tecnológico de Andalucía' },
  { id: 'v8', name: 'Estadio de Atletismo Ciudad de Málaga', sports: ['atletismo'], city: 'Málaga', address: 'Avda. Plutarco, s/n', lat: 36.7130, lng: -4.4750 },
  { id: 'v9', name: 'Polideportivo Municipal de Torremolinos', sports: ['futsal', 'baloncesto', 'balonmano'], city: 'Torremolinos' },
  { id: 'v10', name: 'Estadio Municipal de Marbella', sports: ['futbol'], city: 'Marbella', address: 'Avda. Nabeul, s/n' },
];

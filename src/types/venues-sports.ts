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


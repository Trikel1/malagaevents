/**
 * Normalized sports data model for Málaga capital.
 * Backed by `public.sports_entities` in the database.
 *
 * A single tagged type (`entity_type`) covers facilities, clubs, matches,
 * tournaments, activities and official sources. This keeps ingestion simple
 * and lets the UI filter by type without joining multiple tables.
 */

export type SportsEntityType =
  | 'facility'
  | 'club'
  | 'match'
  | 'tournament'
  | 'activity'
  | 'source';

export type SportsEntityStatus = 'verified' | 'needs_review' | 'inactive';

export interface SportsEntity {
  id: string;
  entity_type: SportsEntityType;
  name: string;
  sport: string | null;
  discipline: string | null;
  city: string | null;
  district: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  date_start: string | null; // YYYY-MM-DD
  date_end: string | null;
  time_start: string | null; // HH:mm:ss
  time_end: string | null;
  organizer: string | null;
  official_url: string | null;
  registration_url: string | null;
  contact: string | null;
  price: string | null;
  age_group: string | null;
  accessibility: string | null;
  source_name: string | null;
  source_url: string | null;
  source_last_checked: string | null; // ISO
  status: SportsEntityStatus;
  notes: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

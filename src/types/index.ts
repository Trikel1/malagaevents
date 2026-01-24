export interface Event {
  id: string;
  title: string;
  description: string;
  category: string;
  start_at: string;
  end_at?: string;
  venue_name: string;
  address: string;
  lat?: number;
  lng?: number;
  price_info?: string;
  is_free: boolean;
  ticket_url?: string;
  image_url?: string;
  age_restriction?: string;
  accessibility_info?: string;
  capacity_info?: string;
  tags?: string[];
  source_type: 'official_feed' | 'organizer_submission';
  source_ref?: string;
  organizer_user_id?: string;
  status: string;
  created_at: string;
  // Extended fields
  source?: string;
  external_id?: string;
  url?: string;
  buy_url?: string;
  venue_name_raw?: string;
  venue_normalized?: string;
  venue_id?: string;
  location_name_raw?: string;
  location_normalized?: string;
  location_id?: string;
  province?: string;
  country?: string;
  dedupe_key?: string;
  updated_at?: string;
  last_synced_at?: string;
  description_short?: string;
  description_full?: string;
  title_normalized?: string;
  venue_name_normalized?: string;
  // Joined data
  venue?: Venue;
  location?: Location;
}

export interface EventOccurrence {
  id: string;
  event_id: string;
  start_datetime: string;
  end_datetime?: string;
  buy_url?: string;
  sold_out?: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
  event?: Event;
}

export interface Venue {
  id: string;
  name: string;
  normalized_name: string;
  city?: string;
  address?: string;
  website?: string;
  lat?: number;
  lng?: number;
  created_at: string;
}

export interface Location {
  id: string;
  name: string;
  normalized_name: string;
  province: string;
  country: string;
  is_in_province_malaga: boolean;
  is_enabled: boolean;
  needs_review?: boolean;
  created_at: string;
}

export interface SyncRun {
  id: string;
  source: string;
  started_at: string;
  finished_at?: string;
  status: string;
  inserted: number;
  updated: number;
  skipped: number;
  errors: number;
  occurrences_created?: number;
  events_archived?: number;
  error_details?: any;
  created_at: string;
}

export interface AppConfig {
  id: string;
  key: string;
  value: any;
  description?: string;
  updated_at: string;
  updated_by?: string;
}

export interface Pharmacy {
  id: string;
  name: string;
  address: string;
  phone?: string;
  date_from: string;
  date_to: string;
  lat?: number;
  lng?: number;
  source_ref?: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  display_name?: string;
  locale: string;
  created_at: string;
}

export interface Favorite {
  id: string;
  user_id: string;
  event_id: string;
  created_at: string;
}

export interface Ticket {
  id: string;
  user_id: string;
  event_id?: string;
  title: string;
  note?: string;
  file_path?: string;
  qr_text?: string;
  event_date?: string;
  created_at: string;
}

export interface NotificationPrefs {
  id: string;
  user_id: string;
  enable_favorites: boolean;
  enable_categories: boolean;
  categories?: string[];
  enable_nearby: boolean;
  radius_km: number;
  enable_daily_digest: boolean;
  quiet_hours_start?: string;
  quiet_hours_end?: string;
}

export const EVENT_CATEGORIES = [
  'music',
  'theater',
  'exhibitions',
  'kids',
  'sports',
  'festivals',
  'workshops',
  'conferences',
  'nightlife',
  'other',
] as const;

export type EventCategory = typeof EVENT_CATEGORIES[number];

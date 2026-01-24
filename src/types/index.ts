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
  'other',
] as const;

export type EventCategory = typeof EVENT_CATEGORIES[number];

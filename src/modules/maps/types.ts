export type MarkerKind = 'event' | 'venue' | 'sport' | 'pharmacy' | 'demo';

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  title: string;
  subtitle?: string;
  approximate?: boolean;
  kind?: MarkerKind;
  // optional metadata for the sheet
  address?: string;
  phone?: string;
  startAt?: string | null;
  eventId?: string | null;
  onDuty?: boolean;
  onClick?: () => void;
}

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      app_config: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      event_occurrences: {
        Row: {
          buy_url: string | null
          created_at: string
          end_datetime: string | null
          event_id: string
          id: string
          notes: string | null
          sold_out: boolean | null
          start_datetime: string
          updated_at: string
        }
        Insert: {
          buy_url?: string | null
          created_at?: string
          end_datetime?: string | null
          event_id: string
          id?: string
          notes?: string | null
          sold_out?: boolean | null
          start_datetime: string
          updated_at?: string
        }
        Update: {
          buy_url?: string | null
          created_at?: string
          end_datetime?: string | null
          event_id?: string
          id?: string
          notes?: string | null
          sold_out?: boolean | null
          start_datetime?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_occurrences_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_submissions: {
        Row: {
          captcha_passed: boolean
          created_at: string
          email_verified: boolean
          event_id: string | null
          id: string
          submitter_email: string
          submitter_user_id: string | null
          verification_token: string | null
        }
        Insert: {
          captcha_passed?: boolean
          created_at?: string
          email_verified?: boolean
          event_id?: string | null
          id?: string
          submitter_email: string
          submitter_user_id?: string | null
          verification_token?: string | null
        }
        Update: {
          captcha_passed?: boolean
          created_at?: string
          email_verified?: boolean
          event_id?: string | null
          id?: string
          submitter_email?: string
          submitter_user_id?: string | null
          verification_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_submissions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_submissions_submitter_user_id_fkey"
            columns: ["submitter_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          accessibility_info: string | null
          address: string
          age_restriction: string | null
          buy_url: string | null
          capacity_info: string | null
          category: string
          country: string | null
          created_at: string
          dedupe_key: string | null
          description: string
          description_full: string | null
          description_short: string | null
          end_at: string | null
          event_type: string | null
          external_id: string | null
          id: string
          image_status: string | null
          image_url: string | null
          is_free: boolean
          last_synced_at: string | null
          lat: number | null
          lng: number | null
          location_id: string | null
          location_name_raw: string | null
          location_normalized: string | null
          organizer_user_id: string | null
          price_info: string | null
          province: string | null
          source: string | null
          source_ref: string | null
          source_type: string
          start_at: string
          status: string
          tags: string[] | null
          ticket_url: string | null
          title: string
          title_normalized: string | null
          updated_at: string | null
          url: string | null
          venue_id: string | null
          venue_name: string
          venue_name_normalized: string | null
          venue_name_raw: string | null
          venue_normalized: string | null
        }
        Insert: {
          accessibility_info?: string | null
          address: string
          age_restriction?: string | null
          buy_url?: string | null
          capacity_info?: string | null
          category: string
          country?: string | null
          created_at?: string
          dedupe_key?: string | null
          description: string
          description_full?: string | null
          description_short?: string | null
          end_at?: string | null
          event_type?: string | null
          external_id?: string | null
          id?: string
          image_status?: string | null
          image_url?: string | null
          is_free?: boolean
          last_synced_at?: string | null
          lat?: number | null
          lng?: number | null
          location_id?: string | null
          location_name_raw?: string | null
          location_normalized?: string | null
          organizer_user_id?: string | null
          price_info?: string | null
          province?: string | null
          source?: string | null
          source_ref?: string | null
          source_type?: string
          start_at: string
          status?: string
          tags?: string[] | null
          ticket_url?: string | null
          title: string
          title_normalized?: string | null
          updated_at?: string | null
          url?: string | null
          venue_id?: string | null
          venue_name: string
          venue_name_normalized?: string | null
          venue_name_raw?: string | null
          venue_normalized?: string | null
        }
        Update: {
          accessibility_info?: string | null
          address?: string
          age_restriction?: string | null
          buy_url?: string | null
          capacity_info?: string | null
          category?: string
          country?: string | null
          created_at?: string
          dedupe_key?: string | null
          description?: string
          description_full?: string | null
          description_short?: string | null
          end_at?: string | null
          event_type?: string | null
          external_id?: string | null
          id?: string
          image_status?: string | null
          image_url?: string | null
          is_free?: boolean
          last_synced_at?: string | null
          lat?: number | null
          lng?: number | null
          location_id?: string | null
          location_name_raw?: string | null
          location_normalized?: string | null
          organizer_user_id?: string | null
          price_info?: string | null
          province?: string | null
          source?: string | null
          source_ref?: string | null
          source_type?: string
          start_at?: string
          status?: string
          tags?: string[] | null
          ticket_url?: string | null
          title?: string
          title_normalized?: string | null
          updated_at?: string | null
          url?: string | null
          venue_id?: string | null
          venue_name?: string
          venue_name_normalized?: string | null
          venue_name_raw?: string | null
          venue_normalized?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_organizer_user_id_fkey"
            columns: ["organizer_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string
          event_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          country: string
          created_at: string
          id: string
          is_enabled: boolean
          is_in_province_malaga: boolean
          name: string
          needs_review: boolean
          normalized_name: string
          province: string
        }
        Insert: {
          country?: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          is_in_province_malaga?: boolean
          name: string
          needs_review?: boolean
          normalized_name: string
          province?: string
        }
        Update: {
          country?: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          is_in_province_malaga?: boolean
          name?: string
          needs_review?: boolean
          normalized_name?: string
          province?: string
        }
        Relationships: []
      }
      notification_prefs: {
        Row: {
          categories: string[] | null
          enable_categories: boolean
          enable_daily_digest: boolean
          enable_favorites: boolean
          enable_nearby: boolean
          id: string
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          radius_km: number
          user_id: string
        }
        Insert: {
          categories?: string[] | null
          enable_categories?: boolean
          enable_daily_digest?: boolean
          enable_favorites?: boolean
          enable_nearby?: boolean
          id?: string
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          radius_km?: number
          user_id: string
        }
        Update: {
          categories?: string[] | null
          enable_categories?: boolean
          enable_daily_digest?: boolean
          enable_favorites?: boolean
          enable_nearby?: boolean
          id?: string
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          radius_km?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_prefs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      pharmacies_guard: {
        Row: {
          address: string
          date_from: string
          date_to: string
          id: string
          lat: number | null
          lng: number | null
          name: string
          phone: string | null
          source_ref: string | null
          updated_at: string
        }
        Insert: {
          address: string
          date_from: string
          date_to: string
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          phone?: string | null
          source_ref?: string | null
          updated_at?: string
        }
        Update: {
          address?: string
          date_from?: string
          date_to?: string
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          phone?: string | null
          source_ref?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      scraping_sources: {
        Row: {
          category: string
          created_at: string
          events_found: number | null
          id: string
          is_active: boolean
          last_scraped_at: string | null
          name: string
          updated_at: string
          url: string
        }
        Insert: {
          category: string
          created_at?: string
          events_found?: number | null
          id?: string
          is_active?: boolean
          last_scraped_at?: string | null
          name: string
          updated_at?: string
          url: string
        }
        Update: {
          category?: string
          created_at?: string
          events_found?: number | null
          id?: string
          is_active?: boolean
          last_scraped_at?: string | null
          name?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      sources_config: {
        Row: {
          category: string | null
          chosen_entrypoint: string | null
          created_at: string | null
          default_location: string | null
          default_venue: string | null
          discovery_confidence: number | null
          domain: string
          entrypoints_detected: string[] | null
          event_type: string | null
          fallback_entrypoint: string | null
          id: string
          is_active: boolean | null
          last_discovery_at: string | null
          last_sync_at: string | null
          name: string
          notes: string | null
          slug: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          chosen_entrypoint?: string | null
          created_at?: string | null
          default_location?: string | null
          default_venue?: string | null
          discovery_confidence?: number | null
          domain: string
          entrypoints_detected?: string[] | null
          event_type?: string | null
          fallback_entrypoint?: string | null
          id?: string
          is_active?: boolean | null
          last_discovery_at?: string | null
          last_sync_at?: string | null
          name: string
          notes?: string | null
          slug: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          chosen_entrypoint?: string | null
          created_at?: string | null
          default_location?: string | null
          default_venue?: string | null
          discovery_confidence?: number | null
          domain?: string
          entrypoints_detected?: string[] | null
          event_type?: string | null
          fallback_entrypoint?: string | null
          id?: string
          is_active?: boolean | null
          last_discovery_at?: string | null
          last_sync_at?: string | null
          name?: string
          notes?: string | null
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      sports_events: {
        Row: {
          address: string | null
          city: string
          competition: string | null
          created_at: string
          dedupe_key: string
          end_datetime: string | null
          external_id: string | null
          id: string
          image_url: string | null
          is_in_malaga_province: boolean
          normalized_title: string | null
          normalized_venue: string | null
          price_info: string | null
          source_id: string | null
          source_url: string | null
          sport_category: string
          start_date: string
          start_datetime: string
          status: string
          teams: string | null
          tickets_url: string | null
          title: string
          updated_at: string
          venue_name: string
        }
        Insert: {
          address?: string | null
          city?: string
          competition?: string | null
          created_at?: string
          dedupe_key: string
          end_datetime?: string | null
          external_id?: string | null
          id?: string
          image_url?: string | null
          is_in_malaga_province?: boolean
          normalized_title?: string | null
          normalized_venue?: string | null
          price_info?: string | null
          source_id?: string | null
          source_url?: string | null
          sport_category: string
          start_date: string
          start_datetime: string
          status?: string
          teams?: string | null
          tickets_url?: string | null
          title: string
          updated_at?: string
          venue_name?: string
        }
        Update: {
          address?: string | null
          city?: string
          competition?: string | null
          created_at?: string
          dedupe_key?: string
          end_datetime?: string | null
          external_id?: string | null
          id?: string
          image_url?: string | null
          is_in_malaga_province?: boolean
          normalized_title?: string | null
          normalized_venue?: string | null
          price_info?: string | null
          source_id?: string | null
          source_url?: string | null
          sport_category?: string
          start_date?: string
          start_datetime?: string
          status?: string
          teams?: string | null
          tickets_url?: string | null
          title?: string
          updated_at?: string
          venue_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "sports_events_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sports_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      sports_sources: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          items_fetched: number
          items_upserted: number
          last_error: string | null
          last_sync_at: string | null
          name: string
          slug: string
          sport_category: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          items_fetched?: number
          items_upserted?: number
          last_error?: string | null
          last_sync_at?: string | null
          name: string
          slug: string
          sport_category?: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          items_fetched?: number
          items_upserted?: number
          last_error?: string | null
          last_sync_at?: string | null
          name?: string
          slug?: string
          sport_category?: string
          url?: string
        }
        Relationships: []
      }
      sports_sync_runs: {
        Row: {
          error_sample: string | null
          finished_at: string | null
          id: string
          items_failed: number
          items_fetched: number
          items_parsed: number
          items_upserted: number
          source_slug: string
          started_at: string
          status: string
        }
        Insert: {
          error_sample?: string | null
          finished_at?: string | null
          id?: string
          items_failed?: number
          items_fetched?: number
          items_parsed?: number
          items_upserted?: number
          source_slug: string
          started_at?: string
          status?: string
        }
        Update: {
          error_sample?: string | null
          finished_at?: string | null
          id?: string
          items_failed?: number
          items_fetched?: number
          items_parsed?: number
          items_upserted?: number
          source_slug?: string
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      sports_venues: {
        Row: {
          address: string | null
          city: string
          created_at: string
          id: string
          lat: number | null
          lng: number | null
          name: string
          normalized_name: string | null
          sports: string[]
        }
        Insert: {
          address?: string | null
          city?: string
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          normalized_name?: string | null
          sports?: string[]
        }
        Update: {
          address?: string | null
          city?: string
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          normalized_name?: string | null
          sports?: string[]
        }
        Relationships: []
      }
      sync_runs: {
        Row: {
          created_at: string
          error_details: Json | null
          errors: number | null
          events_archived: number | null
          finished_at: string | null
          id: string
          inserted: number | null
          occurrences_created: number | null
          skipped: number | null
          source: string
          started_at: string
          status: string
          updated: number | null
        }
        Insert: {
          created_at?: string
          error_details?: Json | null
          errors?: number | null
          events_archived?: number | null
          finished_at?: string | null
          id?: string
          inserted?: number | null
          occurrences_created?: number | null
          skipped?: number | null
          source: string
          started_at?: string
          status?: string
          updated?: number | null
        }
        Update: {
          created_at?: string
          error_details?: Json | null
          errors?: number | null
          events_archived?: number | null
          finished_at?: string | null
          id?: string
          inserted?: number | null
          occurrences_created?: number | null
          skipped?: number | null
          source?: string
          started_at?: string
          status?: string
          updated?: number | null
        }
        Relationships: []
      }
      tickets: {
        Row: {
          created_at: string
          event_date: string | null
          event_id: string | null
          file_path: string | null
          id: string
          note: string | null
          qr_text: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_date?: string | null
          event_id?: string | null
          file_path?: string | null
          id?: string
          note?: string | null
          qr_text?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_date?: string | null
          event_id?: string | null
          file_path?: string | null
          id?: string
          note?: string | null
          qr_text?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          locale: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          locale?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          locale?: string | null
        }
        Relationships: []
      }
      venues: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          id: string
          is_featured: boolean | null
          lat: number | null
          lng: number | null
          name: string
          normalized_name: string
          venue_type: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          id?: string
          is_featured?: boolean | null
          lat?: number | null
          lng?: number | null
          name: string
          normalized_name: string
          venue_type?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          id?: string
          is_featured?: boolean | null
          lat?: number | null
          lng?: number | null
          name?: string
          normalized_name?: string
          venue_type?: string | null
          website?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      normalize_text: { Args: { text_input: string }; Returns: string }
      sports_is_admin: { Args: never; Returns: boolean }
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const

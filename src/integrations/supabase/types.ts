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
          capacity_info: string | null
          category: string
          created_at: string
          description: string
          end_at: string | null
          id: string
          image_url: string | null
          is_free: boolean
          lat: number | null
          lng: number | null
          organizer_user_id: string | null
          price_info: string | null
          source_ref: string | null
          source_type: string
          start_at: string
          status: string
          tags: string[] | null
          ticket_url: string | null
          title: string
          venue_name: string
        }
        Insert: {
          accessibility_info?: string | null
          address: string
          age_restriction?: string | null
          capacity_info?: string | null
          category: string
          created_at?: string
          description: string
          end_at?: string | null
          id?: string
          image_url?: string | null
          is_free?: boolean
          lat?: number | null
          lng?: number | null
          organizer_user_id?: string | null
          price_info?: string | null
          source_ref?: string | null
          source_type?: string
          start_at: string
          status?: string
          tags?: string[] | null
          ticket_url?: string | null
          title: string
          venue_name: string
        }
        Update: {
          accessibility_info?: string | null
          address?: string
          age_restriction?: string | null
          capacity_info?: string | null
          category?: string
          created_at?: string
          description?: string
          end_at?: string | null
          id?: string
          image_url?: string | null
          is_free?: boolean
          lat?: number | null
          lng?: number | null
          organizer_user_id?: string | null
          price_info?: string | null
          source_ref?: string | null
          source_type?: string
          start_at?: string
          status?: string
          tags?: string[] | null
          ticket_url?: string | null
          title?: string
          venue_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_organizer_user_id_fkey"
            columns: ["organizer_user_id"]
            isOneToOne: false
            referencedRelation: "users"
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

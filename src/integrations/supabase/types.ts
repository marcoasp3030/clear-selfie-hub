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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      camera_diagnostics_reports: {
        Row: {
          browser: string | null
          created_at: string
          device_id: string | null
          id: string
          in_app_browser: boolean
          in_iframe: boolean
          is_secure_context: boolean
          likely_cause: string | null
          platform: string | null
          results: Json
          user_agent: string | null
        }
        Insert: {
          browser?: string | null
          created_at?: string
          device_id?: string | null
          id?: string
          in_app_browser?: boolean
          in_iframe?: boolean
          is_secure_context?: boolean
          likely_cause?: string | null
          platform?: string | null
          results: Json
          user_agent?: string | null
        }
        Update: {
          browser?: string | null
          created_at?: string
          device_id?: string | null
          id?: string
          in_app_browser?: boolean
          in_iframe?: boolean
          is_secure_context?: boolean
          likely_cause?: string | null
          platform?: string | null
          results?: Json
          user_agent?: string | null
        }
        Relationships: []
      }
      devices: {
        Row: {
          api_base_url: string
          api_login: string | null
          api_password: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          api_base_url: string
          api_login?: string | null
          api_password?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          api_base_url?: string
          api_login?: string | null
          api_password?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      registrations: {
        Row: {
          cpf: string | null
          created_at: string
          device_browser: string | null
          device_fingerprint: string | null
          device_id: string | null
          device_language: string | null
          device_model: string | null
          device_os: string | null
          device_platform: string | null
          device_sync_attempted_at: string | null
          device_sync_error: string | null
          device_sync_status: string
          device_sync_user_id: number | null
          device_timezone: string | null
          first_name: string
          geo_city: string | null
          geo_country: string | null
          geo_region: string | null
          id: string
          ip_address: string | null
          last_name: string
          phone: string
          photo_path: string
          screen_resolution: string | null
          user_agent: string | null
        }
        Insert: {
          cpf?: string | null
          created_at?: string
          device_browser?: string | null
          device_fingerprint?: string | null
          device_id?: string | null
          device_language?: string | null
          device_model?: string | null
          device_os?: string | null
          device_platform?: string | null
          device_sync_attempted_at?: string | null
          device_sync_error?: string | null
          device_sync_status?: string
          device_sync_user_id?: number | null
          device_timezone?: string | null
          first_name: string
          geo_city?: string | null
          geo_country?: string | null
          geo_region?: string | null
          id?: string
          ip_address?: string | null
          last_name: string
          phone: string
          photo_path: string
          screen_resolution?: string | null
          user_agent?: string | null
        }
        Update: {
          cpf?: string | null
          created_at?: string
          device_browser?: string | null
          device_fingerprint?: string | null
          device_id?: string | null
          device_language?: string | null
          device_model?: string | null
          device_os?: string | null
          device_platform?: string | null
          device_sync_attempted_at?: string | null
          device_sync_error?: string | null
          device_sync_status?: string
          device_sync_user_id?: number | null
          device_timezone?: string | null
          first_name?: string
          geo_city?: string | null
          geo_country?: string | null
          geo_region?: string | null
          id?: string
          ip_address?: string | null
          last_name?: string
          phone?: string
          photo_path?: string
          screen_resolution?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "registrations_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      uazapi_instances: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          instance_id: string | null
          instance_token: string | null
          last_qr_at: string | null
          last_status_at: string | null
          name: string
          owner_jid: string | null
          phone_connected: string | null
          profile_name: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          instance_id?: string | null
          instance_token?: string | null
          last_qr_at?: string | null
          last_status_at?: string | null
          name: string
          owner_jid?: string | null
          phone_connected?: string | null
          profile_name?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          instance_id?: string | null
          instance_token?: string | null
          last_qr_at?: string | null
          last_status_at?: string | null
          name?: string
          owner_jid?: string | null
          phone_connected?: string | null
          profile_name?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
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
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const

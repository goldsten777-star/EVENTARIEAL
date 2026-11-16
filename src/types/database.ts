// Generated from the Supabase schema. Do not edit by hand.
// Regenerate after every migration (Supabase MCP generate_typescript_types or
// `npx supabase gen types typescript --project-id <ref>`).

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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          event_id: string
          guest_id: string | null
          id: number
          payload: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          event_id: string
          guest_id?: string | null
          id?: never
          payload?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          event_id?: string
          guest_id?: string | null
          id?: never
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
        ]
      }
      event_member_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          event_id: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["member_role"]
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          event_id: string
          id?: string
          invited_by?: string | null
          role: Database["public"]["Enums"]["member_role"]
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          event_id?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["member_role"]
        }
        Relationships: [
          {
            foreignKeyName: "event_member_invites_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_member_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_members: {
        Row: {
          created_at: string
          event_id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          invited_by?: string | null
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_members_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          budget_total: number
          cover_image_path: string | null
          created_at: string
          event_date: string | null
          event_type: Database["public"]["Enums"]["event_type"]
          host_names: string | null
          id: string
          invitation_message: string | null
          name: string
          owner_id: string
          rsvp_deadline: string | null
          status: Database["public"]["Enums"]["event_status"]
          updated_at: string
          venue_address: string | null
          venue_name: string | null
        }
        Insert: {
          budget_total?: number
          cover_image_path?: string | null
          created_at?: string
          event_date?: string | null
          event_type?: Database["public"]["Enums"]["event_type"]
          host_names?: string | null
          id?: string
          invitation_message?: string | null
          name: string
          owner_id?: string
          rsvp_deadline?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          updated_at?: string
          venue_address?: string | null
          venue_name?: string | null
        }
        Update: {
          budget_total?: number
          cover_image_path?: string | null
          created_at?: string
          event_date?: string | null
          event_type?: Database["public"]["Enums"]["event_type"]
          host_names?: string | null
          id?: string
          invitation_message?: string | null
          name?: string
          owner_id?: string
          rsvp_deadline?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          updated_at?: string
          venue_address?: string | null
          venue_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          actual_amount: number
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          description: string | null
          due_date: string | null
          event_id: string
          id: string
          notes: string | null
          paid_amount: number
          planned_amount: number
          updated_at: string
          vendor_name: string | null
        }
        Insert: {
          actual_amount?: number
          category: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          description?: string | null
          due_date?: string | null
          event_id: string
          id?: string
          notes?: string | null
          paid_amount?: number
          planned_amount?: number
          updated_at?: string
          vendor_name?: string | null
        }
        Update: {
          actual_amount?: number
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          description?: string | null
          due_date?: string | null
          event_id?: string
          id?: string
          notes?: string | null
          paid_amount?: number
          planned_amount?: number
          updated_at?: string
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      gifts: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          event_id: string
          guest_id: string | null
          id: string
          notes: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          received_at: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          created_by?: string | null
          event_id: string
          guest_id?: string | null
          id?: string
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          received_at?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          event_id?: string
          guest_id?: string | null
          id?: string
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          received_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gifts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gifts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gifts_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_groups: {
        Row: {
          color: string
          created_at: string
          event_id: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          color?: string
          created_at?: string
          event_id: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          color?: string
          created_at?: string
          event_id?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "guest_groups_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      guests: {
        Row: {
          arrived_count: number | null
          checked_in_at: string | null
          checked_in_by: string | null
          confirmed_adults: number
          confirmed_children: number
          created_at: string
          created_by: string | null
          dietary_notes: string | null
          dietary_tags: string[]
          email: string | null
          event_id: string
          first_name: string
          group_id: string | null
          id: string
          invitation_sent_at: string | null
          invitation_status: Database["public"]["Enums"]["invitation_status"]
          invite_token: string
          invited_adults: number
          invited_children: number
          inviter_name: string | null
          last_name: string
          notes: string | null
          phone: string | null
          reserved_seats: number
          rsvp_note: string | null
          rsvp_responded_at: string | null
          rsvp_status: Database["public"]["Enums"]["rsvp_status"]
          seats_needed: number | null
          table_id: string | null
          updated_at: string
        }
        Insert: {
          arrived_count?: number | null
          checked_in_at?: string | null
          checked_in_by?: string | null
          confirmed_adults?: number
          confirmed_children?: number
          created_at?: string
          created_by?: string | null
          dietary_notes?: string | null
          dietary_tags?: string[]
          email?: string | null
          event_id: string
          first_name: string
          group_id?: string | null
          id?: string
          invitation_sent_at?: string | null
          invitation_status?: Database["public"]["Enums"]["invitation_status"]
          invite_token?: string
          invited_adults?: number
          invited_children?: number
          inviter_name?: string | null
          last_name?: string
          notes?: string | null
          phone?: string | null
          reserved_seats?: number
          rsvp_note?: string | null
          rsvp_responded_at?: string | null
          rsvp_status?: Database["public"]["Enums"]["rsvp_status"]
          seats_needed?: number | null
          table_id?: string | null
          updated_at?: string
        }
        Update: {
          arrived_count?: number | null
          checked_in_at?: string | null
          checked_in_by?: string | null
          confirmed_adults?: number
          confirmed_children?: number
          created_at?: string
          created_by?: string | null
          dietary_notes?: string | null
          dietary_tags?: string[]
          email?: string | null
          event_id?: string
          first_name?: string
          group_id?: string | null
          id?: string
          invitation_sent_at?: string | null
          invitation_status?: Database["public"]["Enums"]["invitation_status"]
          invite_token?: string
          invited_adults?: number
          invited_children?: number
          inviter_name?: string | null
          last_name?: string
          notes?: string | null
          phone?: string | null
          reserved_seats?: number
          rsvp_note?: string | null
          rsvp_responded_at?: string | null
          rsvp_status?: Database["public"]["Enums"]["rsvp_status"]
          seats_needed?: number | null
          table_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guests_checked_in_by_fkey"
            columns: ["checked_in_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guests_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guests_group_id_event_id_fkey"
            columns: ["group_id", "event_id"]
            isOneToOne: false
            referencedRelation: "guest_groups"
            referencedColumns: ["id", "event_id"]
          },
          {
            foreignKeyName: "guests_table_id_event_id_fkey"
            columns: ["table_id", "event_id"]
            isOneToOne: false
            referencedRelation: "seating_tables"
            referencedColumns: ["id", "event_id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          is_platform_admin: boolean
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string
          id: string
          is_platform_admin?: boolean
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_platform_admin?: boolean
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      seating_tables: {
        Row: {
          capacity: number
          created_at: string
          event_id: string
          id: string
          name: string | null
          notes: string | null
          number: number
          pos_x: number
          pos_y: number
          shape: Database["public"]["Enums"]["table_shape"]
          updated_at: string
        }
        Insert: {
          capacity: number
          created_at?: string
          event_id: string
          id?: string
          name?: string | null
          notes?: string | null
          number: number
          pos_x?: number
          pos_y?: number
          shape?: Database["public"]["Enums"]["table_shape"]
          updated_at?: string
        }
        Update: {
          capacity?: number
          created_at?: string
          event_id?: string
          id?: string
          name?: string | null
          notes?: string | null
          number?: number
          pos_x?: number
          pos_y?: number
          shape?: Database["public"]["Enums"]["table_shape"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seating_tables_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_overview: { Args: never; Returns: Json }
      check_in_guest: {
        Args: {
          p_arrived_count: number
          p_event_id: string
          p_guest_id: string
        }
        Returns: Json
      }
      checkin_find_by_token: {
        Args: { p_event_id: string; p_token: string }
        Returns: string
      }
      checkin_get_guest: {
        Args: { p_event_id: string; p_guest_id: string }
        Returns: {
          arrived_count: number
          checked_in_at: string
          dietary_tags: string[]
          expected: number
          first_name: string
          group_name: string
          id: string
          last_name: string
          phone: string
          rsvp_status: Database["public"]["Enums"]["rsvp_status"]
          table_name: string
          table_number: number
        }[]
      }
      checkin_search: {
        Args: { p_event_id: string; p_query?: string }
        Returns: {
          arrived_count: number
          checked_in_at: string
          dietary_tags: string[]
          expected: number
          first_name: string
          group_name: string
          id: string
          last_name: string
          phone: string
          rsvp_status: Database["public"]["Enums"]["rsvp_status"]
          table_name: string
          table_number: number
        }[]
      }
      checkin_stats: { Args: { p_event_id: string }; Returns: Json }
      event_stats: { Args: { p_event_id: string }; Returns: Json }
      get_rsvp: { Args: { p_token: string }; Returns: Json }
      guest_seats: {
        Args: {
          p_confirmed_adults: number
          p_confirmed_children: number
          p_reserved: number
          p_status: Database["public"]["Enums"]["rsvp_status"]
        }
        Returns: number
      }
      invite_member: {
        Args: {
          p_email: string
          p_event_id: string
          p_role: Database["public"]["Enums"]["member_role"]
        }
        Returns: Json
      }
      regenerate_invite_token: {
        Args: { p_event_id: string; p_guest_id: string }
        Returns: string
      }
      set_platform_admin: {
        Args: { p_is_admin: boolean; p_user_id: string }
        Returns: undefined
      }
      submit_rsvp: {
        Args: {
          p_adults?: number
          p_children?: number
          p_note?: string
          p_status: Database["public"]["Enums"]["rsvp_status"]
          p_token: string
        }
        Returns: Json
      }
      undo_check_in: {
        Args: { p_event_id: string; p_guest_id: string }
        Returns: undefined
      }
    }
    Enums: {
      event_status: "draft" | "active" | "completed" | "archived"
      event_type:
        | "wedding"
        | "bar_mitzvah"
        | "bat_mitzvah"
        | "brit"
        | "birthday"
        | "corporate"
        | "other"
      expense_category:
        | "venue"
        | "catering"
        | "photography"
        | "music"
        | "design"
        | "attractions"
        | "other"
      invitation_status: "not_sent" | "sent" | "viewed"
      member_role: "event_manager" | "viewer" | "checkin"
      payment_method:
        | "cash"
        | "check"
        | "bit"
        | "paybox"
        | "bank_transfer"
        | "credit_card"
        | "gift_item"
        | "other"
      rsvp_status: "pending" | "attending" | "declined" | "maybe"
      table_shape: "round" | "rectangle" | "knight"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      event_status: ["draft", "active", "completed", "archived"],
      event_type: [
        "wedding",
        "bar_mitzvah",
        "bat_mitzvah",
        "brit",
        "birthday",
        "corporate",
        "other",
      ],
      expense_category: [
        "venue",
        "catering",
        "photography",
        "music",
        "design",
        "attractions",
        "other",
      ],
      invitation_status: ["not_sent", "sent", "viewed"],
      member_role: ["event_manager", "viewer", "checkin"],
      payment_method: [
        "cash",
        "check",
        "bit",
        "paybox",
        "bank_transfer",
        "credit_card",
        "gift_item",
        "other",
      ],
      rsvp_status: ["pending", "attending", "declined", "maybe"],
      table_shape: ["round", "rectangle", "knight"],
    },
  },
} as const

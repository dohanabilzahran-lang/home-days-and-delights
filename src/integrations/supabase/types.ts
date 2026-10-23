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
      app_config: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      budget_plans: {
        Row: {
          category: string
          created_at: string
          id: string
          month: string
          planned: number
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          month: string
          planned?: number
          user_id?: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          month?: string
          planned?: number
          user_id?: string
        }
        Relationships: []
      }
      children: {
        Row: {
          created_at: string
          id: string
          name: string
          position: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          position?: number
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          position?: number
          user_id?: string
        }
        Relationships: []
      }
      cleaning_tasks: {
        Row: {
          checklist: string[]
          created_at: string
          every_days: number
          id: string
          last_done: string | null
          room: string | null
          room_id: string | null
          show_in_calendar: boolean
          snoozed_until: string | null
          title: string
          user_id: string
        }
        Insert: {
          checklist?: string[]
          created_at?: string
          every_days?: number
          id?: string
          last_done?: string | null
          room?: string | null
          room_id?: string | null
          show_in_calendar?: boolean
          snoozed_until?: string | null
          title: string
          user_id?: string
        }
        Update: {
          checklist?: string[]
          created_at?: string
          every_days?: number
          id?: string
          last_done?: string | null
          room?: string | null
          room_id?: string | null
          show_in_calendar?: boolean
          snoozed_until?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cleaning_tasks_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      completions: {
        Row: {
          created_at: string
          id: string
          on_date: string
          source_id: string
          source_type: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          on_date: string
          source_id: string
          source_type: string
          status?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          on_date?: string
          source_id?: string
          source_type?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      debt_payments: {
        Row: {
          amount: number
          created_at: string
          debt_id: string
          id: string
          paid_on: string
          transaction_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          debt_id: string
          id?: string
          paid_on?: string
          transaction_id?: string | null
          user_id?: string
        }
        Update: {
          amount?: number
          created_at?: string
          debt_id?: string
          id?: string
          paid_on?: string
          transaction_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "debt_payments_debt_id_fkey"
            columns: ["debt_id"]
            isOneToOne: false
            referencedRelation: "debts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debt_payments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      debts: {
        Row: {
          archived: boolean
          created_at: string
          due_day: number | null
          id: string
          monthly_payment: number | null
          name: string
          start_date: string
          total: number
          user_id: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          due_day?: number | null
          id?: string
          monthly_payment?: number | null
          name: string
          start_date?: string
          total: number
          user_id?: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          due_day?: number | null
          id?: string
          monthly_payment?: number | null
          name?: string
          start_date?: string
          total?: number
          user_id?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          created_at: string
          deleted_at: string | null
          end_time: string | null
          google_etag: string | null
          google_event_id: string | null
          google_updated_at: string | null
          id: string
          notes: string
          remind_minutes: number | null
          start_time: string | null
          starts_on: string
          sync_error: string | null
          sync_state: string
          sync_to_google: boolean
          title: string
          updated_at: string
          user_id: string
          work_item_id: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          end_time?: string | null
          google_etag?: string | null
          google_event_id?: string | null
          google_updated_at?: string | null
          id?: string
          notes?: string
          remind_minutes?: number | null
          start_time?: string | null
          starts_on: string
          sync_error?: string | null
          sync_state?: string
          sync_to_google?: boolean
          title: string
          updated_at?: string
          user_id?: string
          work_item_id?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          end_time?: string | null
          google_etag?: string | null
          google_event_id?: string | null
          google_updated_at?: string | null
          id?: string
          notes?: string
          remind_minutes?: number | null
          start_time?: string | null
          starts_on?: string
          sync_error?: string | null
          sync_state?: string
          sync_to_google?: boolean
          title?: string
          updated_at?: string
          user_id?: string
          work_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: true
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      google_connections: {
        Row: {
          access_expires_at: string | null
          access_token: string | null
          calendar_id: string | null
          created_at: string
          last_error: string | null
          last_sync_at: string | null
          refresh_token: string | null
          status: string
          sync_token: string | null
          user_id: string
        }
        Insert: {
          access_expires_at?: string | null
          access_token?: string | null
          calendar_id?: string | null
          created_at?: string
          last_error?: string | null
          last_sync_at?: string | null
          refresh_token?: string | null
          status?: string
          sync_token?: string | null
          user_id: string
        }
        Update: {
          access_expires_at?: string | null
          access_token?: string | null
          calendar_id?: string | null
          created_at?: string
          last_error?: string | null
          last_sync_at?: string | null
          refresh_token?: string | null
          status?: string
          sync_token?: string | null
          user_id?: string
        }
        Relationships: []
      }
      item_prices: {
        Row: {
          last_price: number
          name_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          last_price: number
          name_key: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          last_price?: number
          name_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      kids_tasks: {
        Row: {
          at_time: string | null
          child_id: string | null
          child_name: string | null
          created_at: string
          days_of_week: number[] | null
          id: string
          last_done: string | null
          remind: boolean
          show_in_calendar: boolean
          snoozed_until: string | null
          title: string
          user_id: string
        }
        Insert: {
          at_time?: string | null
          child_id?: string | null
          child_name?: string | null
          created_at?: string
          days_of_week?: number[] | null
          id?: string
          last_done?: string | null
          remind?: boolean
          show_in_calendar?: boolean
          snoozed_until?: string | null
          title: string
          user_id?: string
        }
        Update: {
          at_time?: string | null
          child_id?: string | null
          child_name?: string | null
          created_at?: string
          days_of_week?: number[] | null
          id?: string
          last_done?: string | null
          remind?: boolean
          show_in_calendar?: boolean
          snoozed_until?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_tasks_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_plan_entries: {
        Row: {
          child_id: string | null
          created_at: string
          id: string
          on_date: string
          position: number
          recipe_id: string | null
          slot: string
          title: string | null
          user_id: string
        }
        Insert: {
          child_id?: string | null
          created_at?: string
          id?: string
          on_date: string
          position?: number
          recipe_id?: string | null
          slot: string
          title?: string | null
          user_id?: string
        }
        Update: {
          child_id?: string | null
          created_at?: string
          id?: string
          on_date?: string
          position?: number
          recipe_id?: string | null
          slot?: string
          title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_plan_entries_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plan_entries_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          dedupe_key: string
          id: string
          pushed_at: string | null
          read_at: string | null
          title: string
          url: string | null
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          dedupe_key: string
          id?: string
          pushed_at?: string | null
          read_at?: string | null
          title: string
          url?: string | null
          user_id?: string
        }
        Update: {
          body?: string
          created_at?: string
          dedupe_key?: string
          id?: string
          pushed_at?: string | null
          read_at?: string | null
          title?: string
          url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          monthly_income: number
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          monthly_income?: number
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          monthly_income?: number
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          device_label: string | null
          endpoint: string
          id: string
          last_ok_at: string | null
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          device_label?: string | null
          endpoint: string
          id?: string
          last_ok_at?: string | null
          p256dh: string
          user_id?: string
        }
        Update: {
          auth?: string
          created_at?: string
          device_label?: string | null
          endpoint?: string
          id?: string
          last_ok_at?: string | null
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      recipe_ingredients: {
        Row: {
          id: string
          name: string
          position: number
          quantity: number | null
          recipe_id: string
          unit: string | null
          user_id: string
        }
        Insert: {
          id?: string
          name: string
          position?: number
          quantity?: number | null
          recipe_id: string
          unit?: string | null
          user_id?: string
        }
        Update: {
          id?: string
          name?: string
          position?: number
          quantity?: number | null
          recipe_id?: string
          unit?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_ingredients_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          created_at: string
          id: string
          ingredients: string
          kind: string
          minutes: number | null
          servings: number | null
          steps: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ingredients?: string
          kind?: string
          minutes?: number | null
          servings?: number | null
          steps?: string
          title: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          ingredients?: string
          kind?: string
          minutes?: number | null
          servings?: number | null
          steps?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      rooms: {
        Row: {
          created_at: string
          id: string
          name: string
          position: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          position?: number
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          position?: number
          user_id?: string
        }
        Relationships: []
      }
      savings_goals: {
        Row: {
          created_at: string
          id: string
          name: string
          saved: number
          target: number
          target_date: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          saved?: number
          target: number
          target_date?: string | null
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          saved?: number
          target?: number
          target_date?: string | null
          user_id?: string
        }
        Relationships: []
      }
      shopping_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          position: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          position?: number
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          position?: number
          user_id?: string
        }
        Relationships: []
      }
      shopping_items: {
        Row: {
          actual_price: number | null
          bought_on: string | null
          category: string
          created_at: string
          estimated_price: number | null
          id: string
          name: string
          origin: string
          quantity: number | null
          status: string
          transaction_id: string | null
          unit: string | null
          user_id: string
        }
        Insert: {
          actual_price?: number | null
          bought_on?: string | null
          category?: string
          created_at?: string
          estimated_price?: number | null
          id?: string
          name: string
          origin?: string
          quantity?: number | null
          status?: string
          transaction_id?: string | null
          unit?: string | null
          user_id?: string
        }
        Update: {
          actual_price?: number | null
          bought_on?: string | null
          category?: string
          created_at?: string
          estimated_price?: number | null
          id?: string
          name?: string
          origin?: string
          quantity?: number | null
          status?: string
          transaction_id?: string | null
          unit?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopping_items_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      skincare_steps: {
        Row: {
          created_at: string
          days_of_week: number[] | null
          id: string
          last_done: string | null
          period: string
          position: number
          product: string | null
          remind_time: string | null
          show_in_calendar: boolean
          snoozed_until: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          days_of_week?: number[] | null
          id?: string
          last_done?: string | null
          period?: string
          position?: number
          product?: string | null
          remind_time?: string | null
          show_in_calendar?: boolean
          snoozed_until?: string | null
          title: string
          user_id?: string
        }
        Update: {
          created_at?: string
          days_of_week?: number[] | null
          id?: string
          last_done?: string | null
          period?: string
          position?: number
          product?: string | null
          remind_time?: string | null
          show_in_calendar?: boolean
          snoozed_until?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          category: string
          created_at: string
          id: string
          kind: string
          occurred_on: string
          source: string
          title: string
          user_id: string
        }
        Insert: {
          amount: number
          category?: string
          created_at?: string
          id?: string
          kind?: string
          occurred_on?: string
          source?: string
          title: string
          user_id?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          id?: string
          kind?: string
          occurred_on?: string
          source?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      work_items: {
        Row: {
          body: string
          created_at: string
          due_date: string | null
          due_time: string | null
          id: string
          kind: string
          priority: string
          project_id: string | null
          remind: boolean
          show_in_calendar: boolean
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          due_date?: string | null
          due_time?: string | null
          id?: string
          kind?: string
          priority?: string
          project_id?: string | null
          remind?: boolean
          show_in_calendar?: boolean
          status?: string
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          body?: string
          created_at?: string
          due_date?: string | null
          due_time?: string | null
          id?: string
          kind?: string
          priority?: string
          project_id?: string | null
          remind?: boolean
          show_in_calendar?: boolean
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "work_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      work_projects: {
        Row: {
          archived: boolean
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          id?: string
          name: string
          user_id?: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      google_status: {
        Args: never
        Returns: {
          calendar_id: string
          last_error: string
          last_sync_at: string
          status: string
        }[]
      }
      record_purchase: {
        Args: { p_item_id: string; p_on: string; p_price: number }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const

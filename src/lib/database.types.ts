export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      care_presets: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          interval_months: number;
          name: string;
          sort_order: number;
          species: string;
          type: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          interval_months: number;
          name: string;
          sort_order?: number;
          species: string;
          type: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          interval_months?: number;
          name?: string;
          sort_order?: number;
          species?: string;
          type?: string;
        };
        Relationships: [];
      };
      documents: {
        Row: {
          created_at: string;
          created_by: string | null;
          document_date: string | null;
          id: string;
          kind: string;
          mime_type: string | null;
          pet_id: string;
          storage_path: string;
          title: string;
          updated_at: string;
          vet_visit_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          document_date?: string | null;
          id?: string;
          kind: string;
          mime_type?: string | null;
          pet_id: string;
          storage_path: string;
          title: string;
          updated_at?: string;
          vet_visit_id?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          document_date?: string | null;
          id?: string;
          kind?: string;
          mime_type?: string | null;
          pet_id?: string;
          storage_path?: string;
          title?: string;
          updated_at?: string;
          vet_visit_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "documents_pet_id_fkey";
            columns: ["pet_id"];
            isOneToOne: false;
            referencedRelation: "pets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "documents_vet_visit_id_pet_id_fkey";
            columns: ["vet_visit_id", "pet_id"];
            isOneToOne: false;
            referencedRelation: "vet_visits";
            referencedColumns: ["id", "pet_id"];
          },
        ];
      };
      expense_splits: {
        Row: {
          amount_cents: number;
          created_at: string;
          created_by: string | null;
          expense_id: string;
          pet_id: string;
        };
        ComputedFields: never;
        Insert: {
          amount_cents: number;
          created_at?: string;
          created_by?: string | null;
          expense_id: string;
          pet_id: string;
        };
        Update: {
          amount_cents?: number;
          created_at?: string;
          created_by?: string | null;
          expense_id?: string;
          pet_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "expense_splits_expense_id_fkey";
            columns: ["expense_id"];
            isOneToOne: false;
            referencedRelation: "expenses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "expense_splits_pet_id_fkey";
            columns: ["pet_id"];
            isOneToOne: false;
            referencedRelation: "pets";
            referencedColumns: ["id"];
          },
        ];
      };
      expenses: {
        Row: {
          amount_cents: number;
          category: string;
          created_at: string;
          created_by: string | null;
          description: string | null;
          document_id: string | null;
          id: string;
          paid_by: string | null;
          spent_on: string;
          updated_at: string;
          vet_visit_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          amount_cents: number;
          category: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          document_id?: string | null;
          id?: string;
          paid_by?: string | null;
          spent_on?: string;
          updated_at?: string;
          vet_visit_id?: string | null;
        };
        Update: {
          amount_cents?: number;
          category?: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          document_id?: string | null;
          id?: string;
          paid_by?: string | null;
          spent_on?: string;
          updated_at?: string;
          vet_visit_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "expenses_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "expenses_paid_by_fkey";
            columns: ["paid_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "expenses_vet_visit_id_fkey";
            columns: ["vet_visit_id"];
            isOneToOne: false;
            referencedRelation: "vet_visits";
            referencedColumns: ["id"];
          },
        ];
      };
      health_events: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          next_due_on: string | null;
          notes: string | null;
          occurred_on: string;
          pet_id: string;
          preset_id: string | null;
          product: string | null;
          remind: boolean;
          title: string;
          type: string;
          updated_at: string;
          vet_visit_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          next_due_on?: string | null;
          notes?: string | null;
          occurred_on?: string;
          pet_id: string;
          preset_id?: string | null;
          product?: string | null;
          remind?: boolean;
          title: string;
          type: string;
          updated_at?: string;
          vet_visit_id?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          next_due_on?: string | null;
          notes?: string | null;
          occurred_on?: string;
          pet_id?: string;
          preset_id?: string | null;
          product?: string | null;
          remind?: boolean;
          title?: string;
          type?: string;
          updated_at?: string;
          vet_visit_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "health_events_pet_id_fkey";
            columns: ["pet_id"];
            isOneToOne: false;
            referencedRelation: "pets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "health_events_preset_id_fkey";
            columns: ["preset_id"];
            isOneToOne: false;
            referencedRelation: "care_presets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "health_events_vet_visit_id_pet_id_fkey";
            columns: ["vet_visit_id", "pet_id"];
            isOneToOne: false;
            referencedRelation: "vet_visits";
            referencedColumns: ["id", "pet_id"];
          },
        ];
      };
      medications: {
        Row: {
          created_at: string;
          created_by: string | null;
          dose: string | null;
          ends_on: string | null;
          id: string;
          name: string;
          notes: string | null;
          pet_id: string;
          remind: boolean;
          schedule_rrule: string | null;
          starts_on: string;
          updated_at: string;
          vet_visit_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          dose?: string | null;
          ends_on?: string | null;
          id?: string;
          name: string;
          notes?: string | null;
          pet_id: string;
          remind?: boolean;
          schedule_rrule?: string | null;
          starts_on?: string;
          updated_at?: string;
          vet_visit_id?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          dose?: string | null;
          ends_on?: string | null;
          id?: string;
          name?: string;
          notes?: string | null;
          pet_id?: string;
          remind?: boolean;
          schedule_rrule?: string | null;
          starts_on?: string;
          updated_at?: string;
          vet_visit_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "medications_pet_id_fkey";
            columns: ["pet_id"];
            isOneToOne: false;
            referencedRelation: "pets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "medications_vet_visit_id_pet_id_fkey";
            columns: ["vet_visit_id", "pet_id"];
            isOneToOne: false;
            referencedRelation: "vet_visits";
            referencedColumns: ["id", "pet_id"];
          },
        ];
      };
      pet_members: {
        Row: {
          created_at: string;
          notify: boolean;
          pet_id: string;
          role: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          notify?: boolean;
          pet_id: string;
          role: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          notify?: boolean;
          pet_id?: string;
          role?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pet_members_pet_id_fkey";
            columns: ["pet_id"];
            isOneToOne: false;
            referencedRelation: "pets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pet_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      pets: {
        Row: {
          archived_at: string | null;
          birth_date: string | null;
          birth_date_is_estimate: boolean;
          breed: string | null;
          color: string;
          created_at: string;
          created_by: string | null;
          id: string;
          microchip: string | null;
          name: string;
          neutered: boolean | null;
          notes: string | null;
          photo_path: string | null;
          sex: string | null;
          species: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          birth_date?: string | null;
          birth_date_is_estimate?: boolean;
          breed?: string | null;
          color?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          microchip?: string | null;
          name: string;
          neutered?: boolean | null;
          notes?: string | null;
          photo_path?: string | null;
          sex?: string | null;
          species: string;
          updated_at?: string;
        };
        Update: {
          archived_at?: string | null;
          birth_date?: string | null;
          birth_date_is_estimate?: boolean;
          breed?: string | null;
          color?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          microchip?: string | null;
          name?: string;
          neutered?: boolean | null;
          notes?: string | null;
          photo_path?: string | null;
          sex?: string | null;
          species?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string;
          id: string;
          name: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          email: string;
          id: string;
          name?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      vet_visits: {
        Row: {
          clinic: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          notes: string | null;
          pet_id: string;
          reason: string | null;
          updated_at: string;
          vet_name: string | null;
          visited_on: string;
        };
        ComputedFields: never;
        Insert: {
          clinic?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          notes?: string | null;
          pet_id: string;
          reason?: string | null;
          updated_at?: string;
          vet_name?: string | null;
          visited_on?: string;
        };
        Update: {
          clinic?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          notes?: string | null;
          pet_id?: string;
          reason?: string | null;
          updated_at?: string;
          vet_name?: string | null;
          visited_on?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vet_visits_pet_id_fkey";
            columns: ["pet_id"];
            isOneToOne: false;
            referencedRelation: "pets";
            referencedColumns: ["id"];
          },
        ];
      };
      weights: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          measured_on: string;
          pet_id: string;
          updated_at: string;
          vet_visit_id: string | null;
          weight_kg: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          measured_on?: string;
          pet_id: string;
          updated_at?: string;
          vet_visit_id?: string | null;
          weight_kg: number;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          measured_on?: string;
          pet_id?: string;
          updated_at?: string;
          vet_visit_id?: string | null;
          weight_kg?: number;
        };
        Relationships: [
          {
            foreignKeyName: "weights_pet_id_fkey";
            columns: ["pet_id"];
            isOneToOne: false;
            referencedRelation: "pets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "weights_vet_visit_id_pet_id_fkey";
            columns: ["vet_visit_id", "pet_id"];
            isOneToOne: false;
            referencedRelation: "vet_visits";
            referencedColumns: ["id", "pet_id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      can_be_payer: { Args: { p_user_id: string }; Returns: boolean };
      can_edit_expense: { Args: { p_expense_id: string }; Returns: boolean };
      can_edit_pet_record: {
        Args: { p_created_by: string; p_pet_id: string };
        Returns: boolean;
      };
      can_see_expense: { Args: { p_expense_id: string }; Returns: boolean };
      expense_has_splits: { Args: { p_expense_id: string }; Returns: boolean };
      insert_health_event: {
        Args: {
          p_default_date: string;
          p_item: Json;
          p_pet_id: string;
          p_vet_visit_id: string;
        };
        Returns: string;
      };
      is_pet_member: { Args: { p_pet_id: string }; Returns: boolean };
      is_pet_owner: { Args: { p_pet_id: string }; Returns: boolean };
      record_home_treatment: { Args: { payload: Json }; Returns: string };
      record_pet_expense: {
        Args: {
          p_amount_cents: number;
          p_category: string;
          p_description: string;
          p_document_id: string;
          p_paid_by: string;
          p_pet_id: string;
          p_spent_on: string;
          p_vet_visit_id: string;
        };
        Returns: string;
      };
      record_vet_visit: { Args: { payload: Json }; Returns: string };
      record_weight: { Args: { payload: Json }; Returns: string };
      shares_pet_with: { Args: { p_user_id: string }; Returns: boolean };
      storage_pet_id: { Args: { p_name: string }; Returns: string };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;

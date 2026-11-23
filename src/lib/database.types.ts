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
      calendar_feeds: {
        Row: {
          created_at: string;
          last_fetched_at: string | null;
          token: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          last_fetched_at?: string | null;
          token: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          last_fetched_at?: string | null;
          token?: string;
          user_id?: string;
        };
        Relationships: [];
      };
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
      clinics: {
        Row: {
          address: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          name: string;
          phone: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          address?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name: string;
          phone?: string | null;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name?: string;
          phone?: string | null;
          updated_at?: string;
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
      pet_invites: {
        Row: {
          accepted_at: string | null;
          cancelled_at: string | null;
          created_at: string;
          email: string;
          expires_at: string;
          id: string;
          invited_by: string | null;
          pet_id: string;
          role: string;
        };
        ComputedFields: never;
        Insert: {
          accepted_at?: string | null;
          cancelled_at?: string | null;
          created_at?: string;
          email: string;
          expires_at?: string;
          id?: string;
          invited_by?: string | null;
          pet_id: string;
          role?: string;
        };
        Update: {
          accepted_at?: string | null;
          cancelled_at?: string | null;
          created_at?: string;
          email?: string;
          expires_at?: string;
          id?: string;
          invited_by?: string | null;
          pet_id?: string;
          role?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pet_invites_invited_by_fkey";
            columns: ["invited_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pet_invites_pet_id_fkey";
            columns: ["pet_id"];
            isOneToOne: false;
            referencedRelation: "pets";
            referencedColumns: ["id"];
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
          clinic_id: string | null;
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
          clinic_id?: string | null;
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
          clinic_id?: string | null;
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
        Relationships: [
          {
            foreignKeyName: "pets_clinic_id_fkey";
            columns: ["clinic_id"];
            isOneToOne: false;
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string;
          id: string;
          name: string;
          reminder_emails: boolean;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          email: string;
          id: string;
          name?: string;
          reminder_emails?: boolean;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          name?: string;
          reminder_emails?: boolean;
        };
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          auth: string;
          created_at: string;
          endpoint: string;
          id: string;
          last_used_at: string | null;
          p256dh: string;
          user_agent: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          auth: string;
          created_at?: string;
          endpoint: string;
          id?: string;
          last_used_at?: string | null;
          p256dh: string;
          user_agent?: string | null;
          user_id?: string;
        };
        Update: {
          auth?: string;
          created_at?: string;
          endpoint?: string;
          id?: string;
          last_used_at?: string | null;
          p256dh?: string;
          user_agent?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      rate_limit_events: {
        Row: {
          action: string;
          created_at: string;
          id: number;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          created_at?: string;
          id?: never;
          user_id: string;
        };
        Update: {
          action?: string;
          created_at?: string;
          id?: never;
          user_id?: string;
        };
        Relationships: [];
      };
      reminder_occurrences: {
        Row: {
          created_at: string;
          done_at: string | null;
          done_by: string | null;
          email_sent_at: string | null;
          id: string;
          pet_id: string;
          push_sent_at: string | null;
          reminder_id: string;
          scheduled_for: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          done_at?: string | null;
          done_by?: string | null;
          email_sent_at?: string | null;
          id?: string;
          pet_id: string;
          push_sent_at?: string | null;
          reminder_id: string;
          scheduled_for: string;
        };
        Update: {
          created_at?: string;
          done_at?: string | null;
          done_by?: string | null;
          email_sent_at?: string | null;
          id?: string;
          pet_id?: string;
          push_sent_at?: string | null;
          reminder_id?: string;
          scheduled_for?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reminder_occurrences_pet_id_fkey";
            columns: ["pet_id"];
            isOneToOne: false;
            referencedRelation: "pets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reminder_occurrences_reminder_id_fkey";
            columns: ["reminder_id"];
            isOneToOne: false;
            referencedRelation: "reminders";
            referencedColumns: ["id"];
          },
        ];
      };
      reminders: {
        Row: {
          active: boolean;
          channels: string[];
          created_at: string;
          created_by: string | null;
          due_at: string;
          ended_at: string | null;
          ends_on: string | null;
          id: string;
          pet_id: string;
          rrule: string | null;
          source_id: string | null;
          source_type: string | null;
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          channels?: string[];
          created_at?: string;
          created_by?: string | null;
          due_at: string;
          ended_at?: string | null;
          ends_on?: string | null;
          id?: string;
          pet_id: string;
          rrule?: string | null;
          source_id?: string | null;
          source_type?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          channels?: string[];
          created_at?: string;
          created_by?: string | null;
          due_at?: string;
          ended_at?: string | null;
          ends_on?: string | null;
          id?: string;
          pet_id?: string;
          rrule?: string | null;
          source_id?: string | null;
          source_type?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reminders_pet_id_fkey";
            columns: ["pet_id"];
            isOneToOne: false;
            referencedRelation: "pets";
            referencedColumns: ["id"];
          },
        ];
      };
      vet_visits: {
        Row: {
          clinic: string | null;
          clinic_id: string | null;
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
          clinic_id?: string | null;
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
          clinic_id?: string | null;
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
            foreignKeyName: "vet_visits_clinic_id_fkey";
            columns: ["clinic_id"];
            isOneToOne: false;
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          },
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
      accept_pet_invites: {
        Args: Record<PropertyKey, never>;
        Returns: string[];
      };
      calendar_feed: { Args: { p_token: string }; Returns: Json };
      can_be_payer: { Args: { p_user_id: string }; Returns: boolean };
      can_edit_clinic: { Args: { p_clinic_id: string }; Returns: boolean };
      can_edit_expense: { Args: { p_expense_id: string }; Returns: boolean };
      can_edit_pet_record: {
        Args: { p_created_by: string; p_pet_id: string };
        Returns: boolean;
      };
      can_see_clinic: { Args: { p_clinic_id: string }; Returns: boolean };
      can_see_expense: { Args: { p_expense_id: string }; Returns: boolean };
      claim_due_reminders: { Args: { p_limit?: number }; Returns: Json };
      complete_occurrence: {
        Args: { p_occurrence_id: string; p_treatment?: Json };
        Returns: string;
      };
      consume_export: { Args: Record<PropertyKey, never>; Returns: undefined };
      consume_test_push: { Args: { p_user: string }; Returns: undefined };
      delete_account: { Args: { p_pet_ids?: string[] }; Returns: undefined };
      expand_rrule: {
        Args: {
          p_from: string;
          p_rrule: string;
          p_start: string;
          p_to: string;
          p_until?: string;
        };
        Returns: string[];
      };
      expense_has_splits: { Args: { p_expense_id: string }; Returns: boolean };
      expense_hidden_cents: { Args: { p_expense_id: string }; Returns: number };
      expense_overview: {
        Args: {
          p_category?: string;
          p_from: string;
          p_paid_by?: string;
          p_pet_id?: string;
          p_to: string;
        };
        Returns: Json;
      };
      find_or_create_clinic: { Args: { p_name: string }; Returns: string };
      generate_reminder_occurrences: {
        Args: { p_from?: string; p_reminder_id?: string; p_to?: string };
        Returns: number;
      };
      get_calendar_token: { Args: Record<PropertyKey, never>; Returns: string };
      health_ping: { Args: Record<PropertyKey, never>; Returns: boolean };
      insert_health_event: {
        Args: {
          p_default_date: string;
          p_item: Json;
          p_pet_id: string;
          p_vet_visit_id: string;
        };
        Returns: string;
      };
      invite_to_pet: {
        Args: { p_email: string; p_pet_id: string; p_role?: string };
        Returns: string;
      };
      is_pet_member: { Args: { p_pet_id: string }; Returns: boolean };
      is_pet_owner: { Args: { p_pet_id: string }; Returns: boolean };
      new_calendar_token: { Args: Record<PropertyKey, never>; Returns: string };
      push_subscriptions_for: {
        Args: { p_user_ids: string[] };
        Returns: {
          auth: string;
          endpoint: string;
          id: string;
          p256dh: string;
          user_id: string;
        }[];
      };
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
      refresh_my_occurrences: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      regenerate_calendar_token: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      release_reminder_claim: {
        Args: { p_channel: string; p_occurrence_id: string };
        Returns: undefined;
      };
      resync_health_event_reminder: {
        Args: { p_event_id: string };
        Returns: undefined;
      };
      run_reminder_cycle: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      save_expense: { Args: { payload: Json }; Returns: string };
      save_push_subscription: {
        Args: {
          p_auth: string;
          p_endpoint: string;
          p_p256dh: string;
          p_user_agent?: string;
        };
        Returns: string;
      };
      save_reminder: { Args: { payload: Json }; Returns: string };
      shares_pet_with: { Args: { p_user_id: string }; Returns: boolean };
      storage_pet_id: { Args: { p_name: string }; Returns: string };
      take_rate_limit: {
        Args: {
          p_action: string;
          p_maxes: number[];
          p_user: string;
          p_windows: string[];
        };
        Returns: undefined;
      };
      uncomplete_occurrence: {
        Args: { p_occurrence_id: string };
        Returns: undefined;
      };
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

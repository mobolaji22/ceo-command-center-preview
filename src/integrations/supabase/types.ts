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
      approvals: {
        Row: {
          consequences: string | null
          constraints: string | null
          created_at: string
          evidence_request: string | null
          id: string
          project_id: string
          reason: string
          recommendation: string | null
          requires_client: boolean
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          reversibility: number
          risk: number
          status: Database["public"]["Enums"]["approval_status"]
          target_type: string
          title: string
        }
        Insert: {
          consequences?: string | null
          constraints?: string | null
          created_at?: string
          evidence_request?: string | null
          id?: string
          project_id: string
          reason: string
          recommendation?: string | null
          requires_client?: boolean
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          reversibility?: number
          risk?: number
          status?: Database["public"]["Enums"]["approval_status"]
          target_type?: string
          title: string
        }
        Update: {
          consequences?: string | null
          constraints?: string | null
          created_at?: string
          evidence_request?: string | null
          id?: string
          project_id?: string
          reason?: string
          recommendation?: string | null
          requires_client?: boolean
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          reversibility?: number
          risk?: number
          status?: Database["public"]["Enums"]["approval_status"]
          target_type?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "approvals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      artifacts: {
        Row: {
          client_visible: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          project_id: string
          status: Database["public"]["Enums"]["artifact_status"]
          storage_path: string | null
          type: string
        }
        Insert: {
          client_visible?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          project_id: string
          status?: Database["public"]["Enums"]["artifact_status"]
          storage_path?: string | null
          type?: string
        }
        Update: {
          client_visible?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          project_id?: string
          status?: Database["public"]["Enums"]["artifact_status"]
          storage_path?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "artifacts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          project_id: string
          target_id: string | null
          target_type: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          project_id: string
          target_id?: string | null
          target_type?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          project_id?: string
          target_id?: string | null
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      context_requirements: {
        Row: {
          assigned_to_client: boolean
          category: string
          created_at: string
          deadline: string | null
          description: string
          id: string
          name: string
          project_id: string
          reason: string
          required: boolean
          resolved_at: string | null
          response: string | null
          response_file_path: string | null
          status: Database["public"]["Enums"]["context_status"]
        }
        Insert: {
          assigned_to_client?: boolean
          category?: string
          created_at?: string
          deadline?: string | null
          description?: string
          id?: string
          name: string
          project_id: string
          reason?: string
          required?: boolean
          resolved_at?: string | null
          response?: string | null
          response_file_path?: string | null
          status?: Database["public"]["Enums"]["context_status"]
        }
        Update: {
          assigned_to_client?: boolean
          category?: string
          created_at?: string
          deadline?: string | null
          description?: string
          id?: string
          name?: string
          project_id?: string
          reason?: string
          required?: boolean
          resolved_at?: string | null
          response?: string | null
          response_file_path?: string | null
          status?: Database["public"]["Enums"]["context_status"]
        }
        Relationships: [
          {
            foreignKeyName: "context_requirements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      decisions: {
        Row: {
          confidence: number | null
          created_at: string
          id: string
          options: Json
          project_id: string
          question: string
          rationale: string | null
          recommendation: string | null
          resolved_at: string | null
          reversibility: number | null
          risk: number | null
          selected_option: string | null
          status: Database["public"]["Enums"]["decision_status"]
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          id?: string
          options?: Json
          project_id: string
          question: string
          rationale?: string | null
          recommendation?: string | null
          resolved_at?: string | null
          reversibility?: number | null
          risk?: number | null
          selected_option?: string | null
          status?: Database["public"]["Enums"]["decision_status"]
        }
        Update: {
          confidence?: number | null
          created_at?: string
          id?: string
          options?: Json
          project_id?: string
          question?: string
          rationale?: string | null
          recommendation?: string | null
          resolved_at?: string | null
          reversibility?: number | null
          risk?: number | null
          selected_option?: string | null
          status?: Database["public"]["Enums"]["decision_status"]
        }
        Relationships: [
          {
            foreignKeyName: "decisions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      directives: {
        Row: {
          client_id: string | null
          content: string
          created_at: string
          created_by: string
          id: string
          organization_id: string | null
          project_id: string | null
        }
        Insert: {
          client_id?: string | null
          content: string
          created_at?: string
          created_by: string
          id?: string
          organization_id?: string | null
          project_id?: string | null
        }
        Update: {
          client_id?: string | null
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          organization_id?: string | null
          project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "directives_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "directives_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          actor_id: string | null
          client_visible: boolean
          created_at: string
          id: string
          project_id: string | null
          summary: string
          type: string
        }
        Insert: {
          actor_id?: string | null
          client_visible?: boolean
          created_at?: string
          id?: string
          project_id?: string | null
          summary: string
          type: string
        }
        Update: {
          actor_id?: string | null
          client_visible?: boolean
          created_at?: string
          id?: string
          project_id?: string | null
          summary?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence: {
        Row: {
          approval_id: string | null
          claim: string
          confidence: number
          created_at: string
          id: string
          project_id: string
          source: string
          source_type: string
        }
        Insert: {
          approval_id?: string | null
          claim: string
          confidence?: number
          created_at?: string
          id?: string
          project_id: string
          source: string
          source_type?: string
        }
        Update: {
          approval_id?: string | null
          claim?: string
          confidence?: number
          created_at?: string
          id?: string
          project_id?: string
          source?: string
          source_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          mission: string | null
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          mission?: string | null
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          mission?: string | null
          name?: string
        }
        Relationships: []
      }
      outcomes: {
        Row: {
          actual_value: string
          created_at: string
          expected_value: string
          id: string
          interpretation: string | null
          metric: string
          project_id: string
        }
        Insert: {
          actual_value: string
          created_at?: string
          expected_value: string
          id?: string
          interpretation?: string | null
          metric: string
          project_id: string
        }
        Update: {
          actual_value?: string
          created_at?: string
          expected_value?: string
          id?: string
          interpretation?: string | null
          metric?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outcomes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_state: {
        Row: {
          last_seen_at: string
          previous_seen_at: string | null
          user_id: string
        }
        Insert: {
          last_seen_at?: string
          previous_seen_at?: string | null
          user_id: string
        }
        Update: {
          last_seen_at?: string
          previous_seen_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
        }
        Relationships: []
      }
      project_clients: {
        Row: {
          created_at: string
          project_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          project_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_clients_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          completed_at: string | null
          created_at: string
          description: string | null
          domains: string[]
          id: string
          name: string
          objective: string | null
          organization_id: string | null
          priority: number
          started_at: string | null
          status: Database["public"]["Enums"]["project_status"]
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          domains?: string[]
          id?: string
          name: string
          objective?: string | null
          organization_id?: string | null
          priority?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["project_status"]
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          domains?: string[]
          id?: string
          name?: string
          objective?: string | null
          organization_id?: string | null
          priority?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["project_status"]
        }
        Relationships: [
          {
            foreignKeyName: "projects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          approval_required: boolean
          completed_at: string | null
          created_at: string
          description: string | null
          domain: string
          id: string
          project_id: string
          reversibility: number
          risk: number
          started_at: string | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
        }
        Insert: {
          approval_required?: boolean
          completed_at?: string | null
          created_at?: string
          description?: string | null
          domain?: string
          id?: string
          project_id: string
          reversibility?: number
          risk?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
        }
        Update: {
          approval_required?: boolean
          completed_at?: string | null
          created_at?: string
          description?: string | null
          domain?: string
          id?: string
          project_id?: string
          reversibility?: number
          risk?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      client_resolve_approval: {
        Args: { _approval_id: string; _approved: boolean; _note: string }
        Returns: undefined
      }
      client_respond_requirement: {
        Args: { _file_path: string; _req_id: string; _response: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_owner: { Args: never; Returns: boolean }
      is_project_client: { Args: { _project_id: string }; Returns: boolean }
      touch_owner_seen: { Args: never; Returns: string }
    }
    Enums: {
      app_role: "owner" | "client"
      approval_status: "REQUESTED" | "GRANTED" | "REJECTED" | "EXPIRED"
      artifact_status:
        | "DRAFT"
        | "PROPOSED"
        | "APPROVED"
        | "REJECTED"
        | "SUPERSEDED"
        | "FINAL"
      context_status:
        | "MISSING"
        | "REQUESTED"
        | "PARTIALLY_RECEIVED"
        | "RECEIVED"
        | "ASSUMED"
        | "VALIDATED"
        | "REJECTED"
        | "EXPIRED"
      decision_status:
        | "PROPOSED"
        | "WAITING_FOR_HUMAN"
        | "ACCEPTED"
        | "REJECTED"
        | "DEFERRED"
        | "SUPERSEDED"
      project_status:
        | "DORMANT"
        | "INTENT"
        | "DISCOVERY"
        | "DEFINED"
        | "PLANNED"
        | "IN_PROGRESS"
        | "REVIEW"
        | "WAITING_FOR_HUMAN"
        | "BLOCKED"
        | "APPROVAL"
        | "EXECUTION"
        | "VALIDATION"
        | "COMPLETED"
        | "MONITORING"
        | "PAUSED"
        | "CANCELLED"
        | "SUPERSEDED"
        | "ARCHIVED"
      task_status:
        | "PENDING"
        | "READY"
        | "RUNNING"
        | "WAITING"
        | "WAITING_FOR_HUMAN"
        | "BLOCKED"
        | "FAILED"
        | "COMPLETED"
        | "CANCELLED"
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
      app_role: ["owner", "client"],
      approval_status: ["REQUESTED", "GRANTED", "REJECTED", "EXPIRED"],
      artifact_status: [
        "DRAFT",
        "PROPOSED",
        "APPROVED",
        "REJECTED",
        "SUPERSEDED",
        "FINAL",
      ],
      context_status: [
        "MISSING",
        "REQUESTED",
        "PARTIALLY_RECEIVED",
        "RECEIVED",
        "ASSUMED",
        "VALIDATED",
        "REJECTED",
        "EXPIRED",
      ],
      decision_status: [
        "PROPOSED",
        "WAITING_FOR_HUMAN",
        "ACCEPTED",
        "REJECTED",
        "DEFERRED",
        "SUPERSEDED",
      ],
      project_status: [
        "DORMANT",
        "INTENT",
        "DISCOVERY",
        "DEFINED",
        "PLANNED",
        "IN_PROGRESS",
        "REVIEW",
        "WAITING_FOR_HUMAN",
        "BLOCKED",
        "APPROVAL",
        "EXECUTION",
        "VALIDATION",
        "COMPLETED",
        "MONITORING",
        "PAUSED",
        "CANCELLED",
        "SUPERSEDED",
        "ARCHIVED",
      ],
      task_status: [
        "PENDING",
        "READY",
        "RUNNING",
        "WAITING",
        "WAITING_FOR_HUMAN",
        "BLOCKED",
        "FAILED",
        "COMPLETED",
        "CANCELLED",
      ],
    },
  },
} as const

/**
 * Database types for the Permit Workflow application
 * Adapted to use the existing PIC schema
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// Task status stored in case_event.status
export type TaskStatus = 'pending' | 'in progress' | 'completed';

// Process status stored in process_instance.status
export type ProcessStatus = 'planned' | 'underway' | 'paused' | 'completed';

export interface Database {
  public: {
    Tables: {
      project: {
        Row: {
          id: number;
          created_at: string;
          title: string | null;
          description: string | null;
          sector: string | null;
          lead_agency: string | null;
          participating_agencies: string | null;
          location_lat: number | null;
          location_lon: number | null;
          location_object: Json | null;
          type: string | null;
          funding: string | null;
          start_date: string | null;
          current_status: string | null;
          sponsor: string | null;
          sponsor_contact: Json | null;
          parent_project_id: number | null;
          location_text: string | null;
          other: Json | null;
          data_record_version: string | null;
          data_source_agency: string | null;
          data_source_system: string | null;
          last_updated: string | null;
          record_owner_agency: string | null;
          retrieved_timestamp: string | null;
        };
        Insert: {
          id?: number;
          created_at?: string;
          title?: string | null;
          description?: string | null;
          sector?: string | null;
          lead_agency?: string | null;
          participating_agencies?: string | null;
          location_lat?: number | null;
          location_lon?: number | null;
          location_object?: Json | null;
          type?: string | null;
          funding?: string | null;
          start_date?: string | null;
          current_status?: string | null;
          sponsor?: string | null;
          sponsor_contact?: Json | null;
          parent_project_id?: number | null;
          location_text?: string | null;
          other?: Json | null;
          data_record_version?: string | null;
          data_source_agency?: string | null;
          data_source_system?: string | null;
          last_updated?: string | null;
          record_owner_agency?: string | null;
          retrieved_timestamp?: string | null;
        };
        Update: Partial<Database['public']['Tables']['project']['Insert']>;
      };
      process_instance: {
        Row: {
          id: number;
          parent_project_id: number | null;
          created_at: string;
          parent_process_id: number | null;
          agency_id: string | null;
          federal_id: string | null;
          type: string | null;
          status: string | null;
          stage: string | null;
          start_date: string | null;
          complete_date: string | null;
          outcome: string | null;
          comment_start: string | null;
          comment_end: string | null;
          lead_agency: string | null;
          joint_lead_agency: string | null;
          cooperating_agencies: string | null;
          participating_agencies: string | null;
          notes: string | null;
          process_model: number | null;
          other: Json | null;
          purpose_need: string | null;
          description: string | null;
          process_code: string | null;
        };
        Insert: {
          id?: number;
          parent_project_id?: number | null;
          created_at?: string;
          parent_process_id?: number | null;
          agency_id?: string | null;
          federal_id?: string | null;
          type?: string | null;
          status?: string | null;
          stage?: string | null;
          start_date?: string | null;
          complete_date?: string | null;
          outcome?: string | null;
          comment_start?: string | null;
          comment_end?: string | null;
          lead_agency?: string | null;
          joint_lead_agency?: string | null;
          cooperating_agencies?: string | null;
          participating_agencies?: string | null;
          notes?: string | null;
          process_model?: number | null;
          other?: Json | null;
          purpose_need?: string | null;
          description?: string | null;
          process_code?: string | null;
        };
        Update: Partial<Database['public']['Tables']['process_instance']['Insert']>;
      };
      process_model: {
        Row: {
          id: number;
          created_at: string;
          title: string | null;
          description: string | null;
          notes: string | null;
          bpmn_model: Json | null;
          legal_structure_id: number | null;
          legal_structure_text: string | null;
          screening_description: string | null;
          screening_desc_json: Json | null;
          agency: string | null;
          parent_model: number | null;
          DMN_model: Json | null;
          other: Json | null;
        };
        Insert: {
          id?: number;
          created_at?: string;
          title?: string | null;
          description?: string | null;
          notes?: string | null;
          bpmn_model?: Json | null;
          legal_structure_id?: number | null;
          legal_structure_text?: string | null;
          screening_description?: string | null;
          screening_desc_json?: Json | null;
          agency?: string | null;
          parent_model?: number | null;
          DMN_model?: Json | null;
          other?: Json | null;
        };
        Update: Partial<Database['public']['Tables']['process_model']['Insert']>;
      };
      decision_element: {
        Row: {
          id: number;
          created_at: string;
          process_model: number | null;
          legal_structure_id: number | null;
          title: string | null;
          description: string | null;
          measure: string | null;
          threshold: number | null;
          spatial: boolean | null;
          intersect: boolean | null;
          spatial_reference: Json | null;
          form_text: string | null;
          form_response_desc: string | null;
          form_data: Json | null;
          evaluation_method: string | null;
          evaluation_dmn: Json | null;
          category: string | null;
          process_model_internal_reference_id: string | null;
          parent_decision_element_id: number | null;
          other: Json | null;
          expected_evaluation_data: Json | null;
          response_data: Json | null;
          responsible_role: number | null;
        };
        Insert: {
          id?: number;
          created_at?: string;
          process_model?: number | null;
          legal_structure_id?: number | null;
          title?: string | null;
          description?: string | null;
          measure?: string | null;
          threshold?: number | null;
          spatial?: boolean | null;
          intersect?: boolean | null;
          spatial_reference?: Json | null;
          form_text?: string | null;
          form_response_desc?: string | null;
          form_data?: Json | null;
          evaluation_method?: string | null;
          evaluation_dmn?: Json | null;
          category?: string | null;
          process_model_internal_reference_id?: string | null;
          parent_decision_element_id?: number | null;
          other?: Json | null;
          expected_evaluation_data?: Json | null;
          response_data?: Json | null;
          responsible_role?: number | null;
        };
        Update: Partial<Database['public']['Tables']['decision_element']['Insert']>;
      };
      process_decision_payload: {
        Row: {
          id: number;
          created_at: string;
          process_decision_element: number | null;
          process: number | null;
          project: number | null;
          data_description: string | null;
          evaluation_data: Json | null;
          response: string | null;
          result: string | null;
          result_bool: boolean | null;
          result_notes: string | null;
          result_data: Json | null;
          result_source: string | null;
          parent_payload: number | null;
          other: Json | null;
          data_annotation: string | null;
          evaluation_data_annotation: Json | null;
        };
        Insert: {
          id?: number;
          created_at?: string;
          process_decision_element?: number | null;
          process?: number | null;
          project?: number | null;
          data_description?: string | null;
          evaluation_data?: Json | null;
          response?: string | null;
          result?: string | null;
          result_bool?: boolean | null;
          result_notes?: string | null;
          result_data?: Json | null;
          result_source?: string | null;
          parent_payload?: number | null;
          other?: Json | null;
          data_annotation?: string | null;
          evaluation_data_annotation?: Json | null;
        };
        Update: Partial<Database['public']['Tables']['process_decision_payload']['Insert']>;
      };
      case_event: {
        Row: {
          id: number;
          created_at: string;
          parent_process_id: number | null;
          parent_event_id: number | null;
          related_document_id: number | null;
          name: string | null;
          description: string | null;
          source: string | null;
          type: string | null;
          public_access: boolean | null;
          tier: number | null;
          status: string | null;
          outcome: string | null;
          assigned_entity: string | null;
          datetime: string | null;
          following_segment_name: string | null;
          related_engagement_id: number | null;
          other: Json | null;
        };
        Insert: {
          id?: number;
          created_at?: string;
          parent_process_id?: number | null;
          parent_event_id?: number | null;
          related_document_id?: number | null;
          name?: string | null;
          description?: string | null;
          source?: string | null;
          type?: string | null;
          public_access?: boolean | null;
          tier?: number | null;
          status?: string | null;
          outcome?: string | null;
          assigned_entity?: string | null;
          datetime?: string | null;
          following_segment_name?: string | null;
          related_engagement_id?: number | null;
          other?: Json | null;
        };
        Update: Partial<Database['public']['Tables']['case_event']['Insert']>;
      };
      document: {
        Row: {
          id: number;
          created_at: string;
          parent_process_id: number | null;
          related_document_id: number | null;
          title: string | null;
          volume_title: string | null;
          document_revision: string | null;
          revision_no: number | null;
          supplement_no: number | null;
          publish_date: string | null;
          prepared_by: string | null;
          status: string | null;
          public_access: boolean | null;
          url: string | null;
          notes: string | null;
          document_summary: Json | null;
          document_toc: Json | null;
          document_type: string | null;
          other: Json | null;
          document_files: Json | null;
        };
        Insert: {
          id?: number;
          created_at?: string;
          parent_process_id?: number | null;
          related_document_id?: number | null;
          title?: string | null;
          volume_title?: string | null;
          document_revision?: string | null;
          revision_no?: number | null;
          supplement_no?: number | null;
          publish_date?: string | null;
          prepared_by?: string | null;
          status?: string | null;
          public_access?: boolean | null;
          url?: string | null;
          notes?: string | null;
          document_summary?: Json | null;
          document_toc?: Json | null;
          document_type?: string | null;
          other?: Json | null;
          document_files?: Json | null;
        };
        Update: Partial<Database['public']['Tables']['document']['Insert']>;
      };
      user_role: {
        Row: {
          id: number;
          created_at: string;
          name: string | null;
          description: string | null;
          access_policy: Json | null;
          permission_descriptions: string | null;
          public: boolean | null;
          other: Json | null;
        };
        Insert: {
          id?: number;
          created_at?: string;
          name?: string | null;
          description?: string | null;
          access_policy?: Json | null;
          permission_descriptions?: string | null;
          public?: boolean | null;
          other?: Json | null;
        };
        Update: Partial<Database['public']['Tables']['user_role']['Insert']>;
      };
      user_assignments: {
        Row: {
          id: number;
          created_at: string;
          user_id: string | null;
          user_role: number | null;
        };
        Insert: {
          id?: number;
          created_at?: string;
          user_id?: string | null;
          user_role?: number | null;
        };
        Update: Partial<Database['public']['Tables']['user_assignments']['Insert']>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

// Convenience type aliases
export type Project = Database['public']['Tables']['project']['Row'];
export type ProcessInstance = Database['public']['Tables']['process_instance']['Row'];
export type ProcessModel = Database['public']['Tables']['process_model']['Row'];
export type DecisionElement = Database['public']['Tables']['decision_element']['Row'];
export type ProcessDecisionPayload = Database['public']['Tables']['process_decision_payload']['Row'];
export type CaseEvent = Database['public']['Tables']['case_event']['Row'];
export type Document = Database['public']['Tables']['document']['Row'];
export type UserRole = Database['public']['Tables']['user_role']['Row'];
export type UserAssignment = Database['public']['Tables']['user_assignments']['Row'];

// Workflow-specific metadata stored in `other` jsonb fields
export interface ProjectWorkflowMeta {
  applicant_user_id?: string;
  analyst_user_id?: string;
  approver_user_id?: string;
}

export interface ProcessInstanceWorkflowMeta {
  current_step?: number;
  workflow_status?: 'draft' | 'in_progress' | 'pending_approval' | 'approved' | 'rejected';
}

export interface CaseEventWorkflowMeta {
  step_number?: number;
  decision_element_id?: number;
  assigned_user_id?: string;
  assigned_role_id?: number;
  task_type?: 'form' | 'document' | 'approval';
  completed_by?: string;
  completed_at?: string;
  revision_requested?: boolean;
  revision_comments?: string;
  revision_requested_by?: string;
  approval_decision?: string;
  approval_comments?: string;
}

export interface DocumentWorkflowMeta {
  hedgedoc_note_id?: string;
  hedgedoc_url?: string;
  markdown_content?: string;
  document_role?: 'draft' | 'analysis';
  created_by_user_id?: string;
  last_edited_by_user_id?: string;
}

// Extended types with relations
export interface TaskWithRelations extends CaseEvent {
  project?: Project;
  process_instance?: ProcessInstance;
  decision_element?: DecisionElement;
  assigned_role?: UserRole;
  workflow_meta?: CaseEventWorkflowMeta;
}

export interface CaseWithRelations extends ProcessInstance {
  project?: Project;
  process_model_data?: ProcessModel;
  tasks?: CaseEvent[];
  documents?: Document[];
  workflow_meta?: ProcessInstanceWorkflowMeta;
}

// Step configuration mapping decision_element.id to step numbers
export const STEP_CONFIG = {
  1: { step: 1, title: 'Authentication', type: 'auth' as const },
  2: { step: 2, title: 'Project Information', type: 'form' as const },
  3: { step: 3, title: 'Analysis Document', type: 'document' as const },
  4: { step: 4, title: 'Environmental Review', type: 'document' as const },
  5: { step: 5, title: 'Approval', type: 'approval' as const },
} as const;

// Role IDs from the database
export const ROLES = {
  APPLICANT: 1,
  ANALYST: 2,
  APPROVER: 3,
} as const;

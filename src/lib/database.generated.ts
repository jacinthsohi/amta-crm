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
      ai_conversations: {
        Row: {
          auth_user_id: string
          created_at: string
          deleted_at: string | null
          id: string
          last_message_at: string
          last_role: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          auth_user_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          last_message_at?: string
          last_role?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          auth_user_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          last_message_at?: string
          last_role?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ai_messages: {
        Row: {
          content: Json
          conversation_id: string
          created_at: string
          display_text: string | null
          id: string
          referenced_contact_ids: string[]
          role: string
          tool_calls: Json
        }
        Insert: {
          content: Json
          conversation_id: string
          created_at?: string
          display_text?: string | null
          id?: string
          referenced_contact_ids?: string[]
          role: string
          tool_calls?: Json
        }
        Update: {
          content?: Json
          conversation_id?: string
          created_at?: string
          display_text?: string | null
          id?: string
          referenced_contact_ids?: string[]
          role?: string
          tool_calls?: Json
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "active_ai_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      alumni_claims: {
        Row: {
          contact_id: string | null
          created_at: string
          email: string
          first_name: string
          graduation_year: number
          id: string
          last_name: string
          notes: string | null
          phone: string | null
          program_id: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          email: string
          first_name: string
          graduation_year: number
          id?: string
          last_name: string
          notes?: string | null
          phone?: string | null
          program_id: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          email?: string
          first_name?: string
          graduation_year?: number
          id?: string
          last_name?: string
          notes?: string | null
          phone?: string | null
          program_id?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alumni_claims_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "active_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alumni_claims_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alumni_claims_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "active_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alumni_claims_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alumni_claims_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "active_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alumni_claims_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      board_terms: {
        Row: {
          contact_id: string
          created_at: string
          deleted_at: string | null
          election_year: number
          end_date: string | null
          id: string
          notes: string | null
          start_date: string | null
          term_type: string
          updated_at: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          deleted_at?: string | null
          election_year: number
          end_date?: string | null
          id?: string
          notes?: string | null
          start_date?: string | null
          term_type: string
          updated_at?: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          deleted_at?: string | null
          election_year?: number
          end_date?: string | null
          id?: string
          notes?: string | null
          start_date?: string | null
          term_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_terms_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "active_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_terms_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      committee_assignments: {
        Row: {
          committee_id: string
          contact_id: string
          created_at: string
          deleted_at: string | null
          end_date: string | null
          id: string
          notes: string | null
          position: string
          start_date: string | null
          updated_at: string
        }
        Insert: {
          committee_id: string
          contact_id: string
          created_at?: string
          deleted_at?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          position: string
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          committee_id?: string
          contact_id?: string
          created_at?: string
          deleted_at?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          position?: string
          start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "committee_assignments_committee_id_fkey"
            columns: ["committee_id"]
            isOneToOne: false
            referencedRelation: "active_committees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committee_assignments_committee_id_fkey"
            columns: ["committee_id"]
            isOneToOne: false
            referencedRelation: "committees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committee_assignments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "active_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committee_assignments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      committees: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          is_executive: boolean
          name: string
          parent_committee_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_executive?: boolean
          name: string
          parent_committee_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_executive?: boolean
          name?: string
          parent_committee_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "committees_parent_committee_id_fkey"
            columns: ["parent_committee_id"]
            isOneToOne: false
            referencedRelation: "active_committees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committees_parent_committee_id_fkey"
            columns: ["parent_committee_id"]
            isOneToOne: false
            referencedRelation: "committees"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_categories: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      contact_category_assignments: {
        Row: {
          category_id: string
          contact_id: string
          created_at: string
          deleted_at: string | null
          id: string
          updated_at: string
        }
        Insert: {
          category_id: string
          contact_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          contact_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_category_assignments_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "active_contact_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_category_assignments_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "contact_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_category_assignments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "active_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_category_assignments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          ai_summary: string | null
          ai_summary_generated_at: string | null
          auth_user_id: string | null
          created_at: string
          deleted_at: string | null
          email: string | null
          first_name: string
          has_board_history: boolean
          id: string
          is_admin: boolean
          last_name: string
          notes: string | null
          phone: string | null
          profile_photo_url: string | null
          pronouns: string | null
          standing: string | null
          updated_at: string
        }
        Insert: {
          ai_summary?: string | null
          ai_summary_generated_at?: string | null
          auth_user_id?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          first_name: string
          has_board_history?: boolean
          id?: string
          is_admin?: boolean
          last_name: string
          notes?: string | null
          phone?: string | null
          profile_photo_url?: string | null
          pronouns?: string | null
          standing?: string | null
          updated_at?: string
        }
        Update: {
          ai_summary?: string | null
          ai_summary_generated_at?: string | null
          auth_user_id?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          first_name?: string
          has_board_history?: boolean
          id?: string
          is_admin?: boolean
          last_name?: string
          notes?: string | null
          phone?: string | null
          profile_photo_url?: string | null
          pronouns?: string | null
          standing?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      event_documents: {
        Row: {
          created_at: string
          deleted_at: string | null
          document_type: string
          event_id: string
          id: string
          title: string
          updated_at: string
          uploaded_at: string
          uploaded_by: string | null
          url: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          document_type: string
          event_id: string
          id?: string
          title: string
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string | null
          url: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          document_type?: string
          event_id?: string
          id?: string
          title?: string
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_documents_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "active_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_documents_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "active_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      event_hosts: {
        Row: {
          created_at: string
          deleted_at: string | null
          event_id: string
          host_role: string
          id: string
          program_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          event_id: string
          host_role: string
          id?: string
          program_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          event_id?: string
          host_role?: string
          id?: string
          program_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_hosts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "active_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_hosts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_hosts_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "active_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_hosts_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      event_staff: {
        Row: {
          contact_id: string
          created_at: string
          deleted_at: string | null
          event_id: string
          id: string
          notes: string | null
          position: string
          updated_at: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          deleted_at?: string | null
          event_id: string
          id?: string
          notes?: string | null
          position: string
          updated_at?: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          deleted_at?: string | null
          event_id?: string
          id?: string
          notes?: string | null
          position?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_staff_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "active_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_staff_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_staff_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "active_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_staff_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          end_date: string | null
          event_type: string
          id: string
          location_city: string | null
          location_state: string | null
          name: string
          notes: string | null
          photo_banner_gradient: string | null
          primary_host_contact_id: string | null
          start_date: string
          status: string
          tournament_type: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          end_date?: string | null
          event_type: string
          id?: string
          location_city?: string | null
          location_state?: string | null
          name: string
          notes?: string | null
          photo_banner_gradient?: string | null
          primary_host_contact_id?: string | null
          start_date: string
          status?: string
          tournament_type?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          end_date?: string | null
          event_type?: string
          id?: string
          location_city?: string | null
          location_state?: string | null
          name?: string
          notes?: string | null
          photo_banner_gradient?: string | null
          primary_host_contact_id?: string | null
          start_date?: string
          status?: string
          tournament_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_primary_host_contact_id_fkey"
            columns: ["primary_host_contact_id"]
            isOneToOne: false
            referencedRelation: "active_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_primary_host_contact_id_fkey"
            columns: ["primary_host_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      interaction_links: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          interaction_id: string
          linked_committee_id: string | null
          linked_event_id: string | null
          linked_program_id: string | null
          linked_project_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          interaction_id: string
          linked_committee_id?: string | null
          linked_event_id?: string | null
          linked_program_id?: string | null
          linked_project_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          interaction_id?: string
          linked_committee_id?: string | null
          linked_event_id?: string | null
          linked_program_id?: string | null
          linked_project_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "interaction_links_interaction_id_fkey"
            columns: ["interaction_id"]
            isOneToOne: false
            referencedRelation: "active_interactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interaction_links_interaction_id_fkey"
            columns: ["interaction_id"]
            isOneToOne: false
            referencedRelation: "interactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interaction_links_linked_committee_id_fkey"
            columns: ["linked_committee_id"]
            isOneToOne: false
            referencedRelation: "active_committees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interaction_links_linked_committee_id_fkey"
            columns: ["linked_committee_id"]
            isOneToOne: false
            referencedRelation: "committees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interaction_links_linked_event_id_fkey"
            columns: ["linked_event_id"]
            isOneToOne: false
            referencedRelation: "active_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interaction_links_linked_event_id_fkey"
            columns: ["linked_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interaction_links_linked_program_id_fkey"
            columns: ["linked_program_id"]
            isOneToOne: false
            referencedRelation: "active_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interaction_links_linked_program_id_fkey"
            columns: ["linked_program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interaction_links_linked_project_id_fkey"
            columns: ["linked_project_id"]
            isOneToOne: false
            referencedRelation: "active_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interaction_links_linked_project_id_fkey"
            columns: ["linked_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      interaction_participants: {
        Row: {
          contact_id: string
          created_at: string
          deleted_at: string | null
          id: string
          interaction_id: string
          participant_role: string
          updated_at: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          interaction_id: string
          participant_role: string
          updated_at?: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          interaction_id?: string
          participant_role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "interaction_participants_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "active_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interaction_participants_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interaction_participants_interaction_id_fkey"
            columns: ["interaction_id"]
            isOneToOne: false
            referencedRelation: "active_interactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interaction_participants_interaction_id_fkey"
            columns: ["interaction_id"]
            isOneToOne: false
            referencedRelation: "interactions"
            referencedColumns: ["id"]
          },
        ]
      }
      interactions: {
        Row: {
          content: string | null
          created_at: string
          deleted_at: string | null
          direction: string | null
          id: string
          logged_by: string | null
          occurred_at: string
          subject: string
          type: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          deleted_at?: string | null
          direction?: string | null
          id?: string
          logged_by?: string | null
          occurred_at: string
          subject: string
          type: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          deleted_at?: string | null
          direction?: string | null
          id?: string
          logged_by?: string | null
          occurred_at?: string
          subject?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "interactions_logged_by_fkey"
            columns: ["logged_by"]
            isOneToOne: false
            referencedRelation: "active_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_logged_by_fkey"
            columns: ["logged_by"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          contact_id: string
          created_at: string
          deleted_at: string | null
          email: string
          expires_at: string | null
          id: string
          invited_by: string | null
          revoked_at: string | null
          sent_at: string
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          contact_id: string
          created_at?: string
          deleted_at?: string | null
          email: string
          expires_at?: string | null
          id?: string
          invited_by?: string | null
          revoked_at?: string | null
          sent_at?: string
          token: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          contact_id?: string
          created_at?: string
          deleted_at?: string | null
          email?: string
          expires_at?: string | null
          id?: string
          invited_by?: string | null
          revoked_at?: string | null
          sent_at?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "active_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "active_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      officer_terms: {
        Row: {
          contact_id: string
          created_at: string
          deleted_at: string | null
          end_date: string | null
          id: string
          notes: string | null
          officer_type: string
          start_date: string
          updated_at: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          deleted_at?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          officer_type: string
          start_date: string
          updated_at?: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          deleted_at?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          officer_type?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "officer_terms_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "active_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "officer_terms_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      program_affiliations: {
        Row: {
          affiliation_type: string
          contact_id: string
          created_at: string
          deleted_at: string | null
          end_year: number | null
          id: string
          notes: string | null
          program_id: string
          start_year: number
          updated_at: string
        }
        Insert: {
          affiliation_type: string
          contact_id: string
          created_at?: string
          deleted_at?: string | null
          end_year?: number | null
          id?: string
          notes?: string | null
          program_id: string
          start_year: number
          updated_at?: string
        }
        Update: {
          affiliation_type?: string
          contact_id?: string
          created_at?: string
          deleted_at?: string | null
          end_year?: number | null
          id?: string
          notes?: string | null
          program_id?: string
          start_year?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_affiliations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "active_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_affiliations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_affiliations_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "active_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_affiliations_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          city: string | null
          created_at: string
          deleted_at: string | null
          id: string
          joined_year: number | null
          name: string
          notes: string | null
          short_name: string
          state: string | null
          status: string
          updated_at: string
          website: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          joined_year?: number | null
          name: string
          notes?: string | null
          short_name: string
          state?: string | null
          status?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          joined_year?: number | null
          name?: string
          notes?: string | null
          short_name?: string
          state?: string | null
          status?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      project_assignments: {
        Row: {
          contact_id: string
          created_at: string
          deleted_at: string | null
          id: string
          project_id: string
          role_on_project: string
          updated_at: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          project_id: string
          role_on_project: string
          updated_at?: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          project_id?: string
          role_on_project?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_assignments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "active_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assignments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "active_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          committee_id: string | null
          completed_at: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          event_id: string | null
          id: string
          name: string
          notes: string | null
          owner_id: string | null
          priority: string
          start_date: string | null
          status: string
          target_completion_date: string | null
          updated_at: string
        }
        Insert: {
          committee_id?: string | null
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          event_id?: string | null
          id?: string
          name: string
          notes?: string | null
          owner_id?: string | null
          priority?: string
          start_date?: string | null
          status?: string
          target_completion_date?: string | null
          updated_at?: string
        }
        Update: {
          committee_id?: string | null
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          event_id?: string | null
          id?: string
          name?: string
          notes?: string | null
          owner_id?: string | null
          priority?: string
          start_date?: string | null
          status?: string
          target_completion_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_committee_id_fkey"
            columns: ["committee_id"]
            isOneToOne: false
            referencedRelation: "active_committees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_committee_id_fkey"
            columns: ["committee_id"]
            isOneToOne: false
            referencedRelation: "committees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "active_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "active_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          due_date: string | null
          id: string
          priority: string
          project_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          project_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          project_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "active_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "active_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      active_ai_conversations: {
        Row: {
          auth_user_id: string | null
          created_at: string | null
          deleted_at: string | null
          id: string | null
          last_message_at: string | null
          last_role: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string | null
          last_message_at?: string | null
          last_role?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string | null
          last_message_at?: string | null
          last_role?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      active_ai_messages: {
        Row: {
          content: Json | null
          conversation_id: string | null
          created_at: string | null
          display_text: string | null
          id: string | null
          referenced_contact_ids: string[] | null
          role: string | null
          tool_calls: Json | null
        }
        Insert: {
          content?: Json | null
          conversation_id?: string | null
          created_at?: string | null
          display_text?: string | null
          id?: string | null
          referenced_contact_ids?: string[] | null
          role?: string | null
          tool_calls?: Json | null
        }
        Update: {
          content?: Json | null
          conversation_id?: string | null
          created_at?: string | null
          display_text?: string | null
          id?: string | null
          referenced_contact_ids?: string[] | null
          role?: string | null
          tool_calls?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "active_ai_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      active_board_terms: {
        Row: {
          contact_id: string | null
          created_at: string | null
          deleted_at: string | null
          election_year: number | null
          end_date: string | null
          id: string | null
          notes: string | null
          start_date: string | null
          term_type: string | null
          updated_at: string | null
        }
        Insert: {
          contact_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          election_year?: number | null
          end_date?: string | null
          id?: string | null
          notes?: string | null
          start_date?: string | null
          term_type?: string | null
          updated_at?: string | null
        }
        Update: {
          contact_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          election_year?: number | null
          end_date?: string | null
          id?: string | null
          notes?: string | null
          start_date?: string | null
          term_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "board_terms_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "active_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_terms_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      active_committee_assignments: {
        Row: {
          committee_id: string | null
          contact_id: string | null
          created_at: string | null
          deleted_at: string | null
          end_date: string | null
          id: string | null
          notes: string | null
          position: string | null
          start_date: string | null
          updated_at: string | null
        }
        Insert: {
          committee_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          end_date?: string | null
          id?: string | null
          notes?: string | null
          position?: string | null
          start_date?: string | null
          updated_at?: string | null
        }
        Update: {
          committee_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          end_date?: string | null
          id?: string | null
          notes?: string | null
          position?: string | null
          start_date?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "committee_assignments_committee_id_fkey"
            columns: ["committee_id"]
            isOneToOne: false
            referencedRelation: "active_committees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committee_assignments_committee_id_fkey"
            columns: ["committee_id"]
            isOneToOne: false
            referencedRelation: "committees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committee_assignments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "active_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committee_assignments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      active_committees: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          description: string | null
          id: string | null
          is_executive: boolean | null
          name: string | null
          parent_committee_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string | null
          is_executive?: boolean | null
          name?: string | null
          parent_committee_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string | null
          is_executive?: boolean | null
          name?: string | null
          parent_committee_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "committees_parent_committee_id_fkey"
            columns: ["parent_committee_id"]
            isOneToOne: false
            referencedRelation: "active_committees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committees_parent_committee_id_fkey"
            columns: ["parent_committee_id"]
            isOneToOne: false
            referencedRelation: "committees"
            referencedColumns: ["id"]
          },
        ]
      }
      active_contact_categories: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          id: string | null
          name: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string | null
          name?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string | null
          name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      active_contact_category_assignments: {
        Row: {
          category_id: string | null
          contact_id: string | null
          created_at: string | null
          deleted_at: string | null
          id: string | null
          updated_at: string | null
        }
        Insert: {
          category_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string | null
          updated_at?: string | null
        }
        Update: {
          category_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_category_assignments_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "active_contact_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_category_assignments_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "contact_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_category_assignments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "active_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_category_assignments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      active_contacts: {
        Row: {
          ai_summary: string | null
          ai_summary_generated_at: string | null
          auth_user_id: string | null
          created_at: string | null
          deleted_at: string | null
          email: string | null
          first_name: string | null
          has_board_history: boolean | null
          id: string | null
          is_admin: boolean | null
          last_name: string | null
          notes: string | null
          phone: string | null
          profile_photo_url: string | null
          pronouns: string | null
          standing: string | null
          updated_at: string | null
        }
        Insert: {
          ai_summary?: string | null
          ai_summary_generated_at?: string | null
          auth_user_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          first_name?: string | null
          has_board_history?: boolean | null
          id?: string | null
          is_admin?: boolean | null
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          profile_photo_url?: string | null
          pronouns?: string | null
          standing?: string | null
          updated_at?: string | null
        }
        Update: {
          ai_summary?: string | null
          ai_summary_generated_at?: string | null
          auth_user_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          first_name?: string | null
          has_board_history?: boolean | null
          id?: string | null
          is_admin?: boolean | null
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          profile_photo_url?: string | null
          pronouns?: string | null
          standing?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      active_event_documents: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          document_type: string | null
          event_id: string | null
          id: string | null
          title: string | null
          updated_at: string | null
          uploaded_at: string | null
          uploaded_by: string | null
          url: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          document_type?: string | null
          event_id?: string | null
          id?: string | null
          title?: string | null
          updated_at?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
          url?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          document_type?: string | null
          event_id?: string | null
          id?: string | null
          title?: string | null
          updated_at?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_documents_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "active_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_documents_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "active_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      active_event_hosts: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          event_id: string | null
          host_role: string | null
          id: string | null
          program_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          event_id?: string | null
          host_role?: string | null
          id?: string | null
          program_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          event_id?: string | null
          host_role?: string | null
          id?: string | null
          program_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_hosts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "active_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_hosts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_hosts_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "active_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_hosts_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      active_event_staff: {
        Row: {
          contact_id: string | null
          created_at: string | null
          deleted_at: string | null
          event_id: string | null
          id: string | null
          notes: string | null
          position: string | null
          updated_at: string | null
        }
        Insert: {
          contact_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          event_id?: string | null
          id?: string | null
          notes?: string | null
          position?: string | null
          updated_at?: string | null
        }
        Update: {
          contact_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          event_id?: string | null
          id?: string | null
          notes?: string | null
          position?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_staff_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "active_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_staff_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_staff_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "active_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_staff_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      active_events: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          description: string | null
          end_date: string | null
          event_type: string | null
          id: string | null
          location_city: string | null
          location_state: string | null
          name: string | null
          notes: string | null
          photo_banner_gradient: string | null
          primary_host_contact_id: string | null
          start_date: string | null
          status: string | null
          tournament_type: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          end_date?: string | null
          event_type?: string | null
          id?: string | null
          location_city?: string | null
          location_state?: string | null
          name?: string | null
          notes?: string | null
          photo_banner_gradient?: string | null
          primary_host_contact_id?: string | null
          start_date?: string | null
          status?: string | null
          tournament_type?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          end_date?: string | null
          event_type?: string | null
          id?: string | null
          location_city?: string | null
          location_state?: string | null
          name?: string | null
          notes?: string | null
          photo_banner_gradient?: string | null
          primary_host_contact_id?: string | null
          start_date?: string | null
          status?: string | null
          tournament_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_primary_host_contact_id_fkey"
            columns: ["primary_host_contact_id"]
            isOneToOne: false
            referencedRelation: "active_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_primary_host_contact_id_fkey"
            columns: ["primary_host_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      active_interaction_links: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          id: string | null
          interaction_id: string | null
          linked_committee_id: string | null
          linked_event_id: string | null
          linked_program_id: string | null
          linked_project_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string | null
          interaction_id?: string | null
          linked_committee_id?: string | null
          linked_event_id?: string | null
          linked_program_id?: string | null
          linked_project_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string | null
          interaction_id?: string | null
          linked_committee_id?: string | null
          linked_event_id?: string | null
          linked_program_id?: string | null
          linked_project_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interaction_links_interaction_id_fkey"
            columns: ["interaction_id"]
            isOneToOne: false
            referencedRelation: "active_interactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interaction_links_interaction_id_fkey"
            columns: ["interaction_id"]
            isOneToOne: false
            referencedRelation: "interactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interaction_links_linked_committee_id_fkey"
            columns: ["linked_committee_id"]
            isOneToOne: false
            referencedRelation: "active_committees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interaction_links_linked_committee_id_fkey"
            columns: ["linked_committee_id"]
            isOneToOne: false
            referencedRelation: "committees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interaction_links_linked_event_id_fkey"
            columns: ["linked_event_id"]
            isOneToOne: false
            referencedRelation: "active_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interaction_links_linked_event_id_fkey"
            columns: ["linked_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interaction_links_linked_program_id_fkey"
            columns: ["linked_program_id"]
            isOneToOne: false
            referencedRelation: "active_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interaction_links_linked_program_id_fkey"
            columns: ["linked_program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interaction_links_linked_project_id_fkey"
            columns: ["linked_project_id"]
            isOneToOne: false
            referencedRelation: "active_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interaction_links_linked_project_id_fkey"
            columns: ["linked_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      active_interaction_participants: {
        Row: {
          contact_id: string | null
          created_at: string | null
          deleted_at: string | null
          id: string | null
          interaction_id: string | null
          participant_role: string | null
          updated_at: string | null
        }
        Insert: {
          contact_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string | null
          interaction_id?: string | null
          participant_role?: string | null
          updated_at?: string | null
        }
        Update: {
          contact_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string | null
          interaction_id?: string | null
          participant_role?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interaction_participants_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "active_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interaction_participants_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interaction_participants_interaction_id_fkey"
            columns: ["interaction_id"]
            isOneToOne: false
            referencedRelation: "active_interactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interaction_participants_interaction_id_fkey"
            columns: ["interaction_id"]
            isOneToOne: false
            referencedRelation: "interactions"
            referencedColumns: ["id"]
          },
        ]
      }
      active_interactions: {
        Row: {
          content: string | null
          created_at: string | null
          deleted_at: string | null
          direction: string | null
          id: string | null
          logged_by: string | null
          occurred_at: string | null
          subject: string | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          deleted_at?: string | null
          direction?: string | null
          id?: string | null
          logged_by?: string | null
          occurred_at?: string | null
          subject?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          deleted_at?: string | null
          direction?: string | null
          id?: string | null
          logged_by?: string | null
          occurred_at?: string | null
          subject?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interactions_logged_by_fkey"
            columns: ["logged_by"]
            isOneToOne: false
            referencedRelation: "active_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_logged_by_fkey"
            columns: ["logged_by"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      active_invitations: {
        Row: {
          accepted_at: string | null
          contact_id: string | null
          created_at: string | null
          deleted_at: string | null
          email: string | null
          expires_at: string | null
          id: string | null
          invited_by: string | null
          sent_at: string | null
          token: string | null
          updated_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          contact_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          expires_at?: string | null
          id?: string | null
          invited_by?: string | null
          sent_at?: string | null
          token?: string | null
          updated_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          contact_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          expires_at?: string | null
          id?: string | null
          invited_by?: string | null
          sent_at?: string | null
          token?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invitations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "active_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "active_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      active_invitations_view: {
        Row: {
          accepted_at: string | null
          computed_status: string | null
          contact_id: string | null
          created_at: string | null
          deleted_at: string | null
          email: string | null
          expires_at: string | null
          id: string | null
          invited_by: string | null
          revoked_at: string | null
          sent_at: string | null
          token: string | null
          updated_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          computed_status?: never
          contact_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          expires_at?: string | null
          id?: string | null
          invited_by?: string | null
          revoked_at?: string | null
          sent_at?: string | null
          token?: string | null
          updated_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          computed_status?: never
          contact_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          expires_at?: string | null
          id?: string | null
          invited_by?: string | null
          revoked_at?: string | null
          sent_at?: string | null
          token?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invitations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "active_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "active_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      active_officer_terms: {
        Row: {
          contact_id: string | null
          created_at: string | null
          deleted_at: string | null
          end_date: string | null
          id: string | null
          notes: string | null
          officer_type: string | null
          start_date: string | null
          updated_at: string | null
        }
        Insert: {
          contact_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          end_date?: string | null
          id?: string | null
          notes?: string | null
          officer_type?: string | null
          start_date?: string | null
          updated_at?: string | null
        }
        Update: {
          contact_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          end_date?: string | null
          id?: string | null
          notes?: string | null
          officer_type?: string | null
          start_date?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "officer_terms_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "active_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "officer_terms_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      active_program_affiliations: {
        Row: {
          affiliation_type: string | null
          contact_id: string | null
          created_at: string | null
          deleted_at: string | null
          end_year: number | null
          id: string | null
          notes: string | null
          program_id: string | null
          start_year: number | null
          updated_at: string | null
        }
        Insert: {
          affiliation_type?: string | null
          contact_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          end_year?: number | null
          id?: string | null
          notes?: string | null
          program_id?: string | null
          start_year?: number | null
          updated_at?: string | null
        }
        Update: {
          affiliation_type?: string | null
          contact_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          end_year?: number | null
          id?: string | null
          notes?: string | null
          program_id?: string | null
          start_year?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "program_affiliations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "active_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_affiliations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_affiliations_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "active_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_affiliations_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      active_programs: {
        Row: {
          city: string | null
          created_at: string | null
          deleted_at: string | null
          id: string | null
          joined_year: number | null
          name: string | null
          notes: string | null
          short_name: string | null
          state: string | null
          status: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string | null
          joined_year?: number | null
          name?: string | null
          notes?: string | null
          short_name?: string | null
          state?: string | null
          status?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string | null
          joined_year?: number | null
          name?: string | null
          notes?: string | null
          short_name?: string | null
          state?: string | null
          status?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      active_project_assignments: {
        Row: {
          contact_id: string | null
          created_at: string | null
          deleted_at: string | null
          id: string | null
          project_id: string | null
          role_on_project: string | null
          updated_at: string | null
        }
        Insert: {
          contact_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string | null
          project_id?: string | null
          role_on_project?: string | null
          updated_at?: string | null
        }
        Update: {
          contact_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string | null
          project_id?: string | null
          role_on_project?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_assignments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "active_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assignments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "active_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      active_projects: {
        Row: {
          committee_id: string | null
          completed_at: string | null
          created_at: string | null
          deleted_at: string | null
          description: string | null
          event_id: string | null
          id: string | null
          name: string | null
          notes: string | null
          owner_id: string | null
          priority: string | null
          start_date: string | null
          status: string | null
          target_completion_date: string | null
          updated_at: string | null
        }
        Insert: {
          committee_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          event_id?: string | null
          id?: string | null
          name?: string | null
          notes?: string | null
          owner_id?: string | null
          priority?: string | null
          start_date?: string | null
          status?: string | null
          target_completion_date?: string | null
          updated_at?: string | null
        }
        Update: {
          committee_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          event_id?: string | null
          id?: string | null
          name?: string | null
          notes?: string | null
          owner_id?: string | null
          priority?: string | null
          start_date?: string | null
          status?: string | null
          target_completion_date?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_committee_id_fkey"
            columns: ["committee_id"]
            isOneToOne: false
            referencedRelation: "active_committees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_committee_id_fkey"
            columns: ["committee_id"]
            isOneToOne: false
            referencedRelation: "committees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "active_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "active_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      active_tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string | null
          deleted_at: string | null
          description: string | null
          due_date: string | null
          id: string | null
          priority: string | null
          project_id: string | null
          status: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string | null
          priority?: string | null
          project_id?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string | null
          priority?: string | null
          project_id?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "active_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "active_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      is_authenticated: { Args: never; Returns: boolean }
      is_current_user_admin: { Args: never; Returns: boolean }
      restore: { Args: { row_id: string; table_name: string }; Returns: string }
      soft_delete: {
        Args: { row_id: string; table_name: string }
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
    Enums: {},
  },
} as const

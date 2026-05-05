/**
 * Supabase auto-generates these types from your database schema.
 *
 * For now we have a hand-written version that matches Phase 1's migrations.
 * Once you install the Supabase CLI you can replace this file by running:
 *
 *     npx supabase gen types typescript --project-id <your-project-ref> --schema public > src/lib/database.types.ts
 *
 * But hand-writing it for now is fine and lets us move forward without
 * yet another tool to install. The two should match.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// Common columns every soft-deletable table has
type Timestamps = {
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

// =============================================================================
// Row types — what a SELECT returns
// =============================================================================

export type Contact = Timestamps & {
  id: string;
  auth_user_id: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  profile_photo_url: string | null;
  notes: string | null;
  standing: "active" | "inactive" | null;
  has_board_history: boolean;
  ai_summary: string | null;
  ai_summary_generated_at: string | null;
};

export type ContactCategory = Timestamps & {
  id: string;
  name: string;
};

export type ContactCategoryAssignment = Timestamps & {
  id: string;
  contact_id: string;
  category_id: string;
};

export type Program = Timestamps & {
  id: string;
  name: string;
  short_name: string;
  city: string | null;
  state: string | null;
  website: string | null;
  status: "active" | "inactive";
  joined_year: number | null;
  notes: string | null;
};

export type Committee = Timestamps & {
  id: string;
  name: string;
  description: string | null;
  parent_committee_id: string | null;
  status: "active" | "inactive";
  is_executive: boolean;
};

export type BoardTerm = Timestamps & {
  id: string;
  contact_id: string;
  term_type: "first_year_candidate" | "second_year_candidate" | "voting_director";
  election_year: number;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
};

export type OfficerTerm = Timestamps & {
  id: string;
  contact_id: string;
  officer_type:
    | "president"
    | "president_elect"
    | "past_president"
    | "secretary"
    | "treasurer";
  start_date: string;
  end_date: string | null;
  notes: string | null;
};

export type CommitteeAssignment = Timestamps & {
  id: string;
  contact_id: string;
  committee_id: string;
  position: string;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
};

export type ProgramAffiliation = Timestamps & {
  id: string;
  contact_id: string;
  program_id: string;
  affiliation_type: "student_alumni" | "coach" | "advisor";
  start_year: number;
  end_year: number | null;
  notes: string | null;
};

export type Event = Timestamps & {
  id: string;
  name: string;
  event_type: "tournament" | "board_meeting";
  tournament_type: "invitational" | "regional" | "orcs" | "nct" | null;
  start_date: string;
  end_date: string | null;
  location_city: string | null;
  location_state: string | null;
  photo_banner_gradient: string | null;
  status: "upcoming" | "in_progress" | "completed" | "cancelled";
  primary_host_contact_id: string | null;
  description: string | null;
  notes: string | null;
};

export type EventHost = Timestamps & {
  id: string;
  event_id: string;
  program_id: string;
  host_role: string;
};

export type EventStaff = Timestamps & {
  id: string;
  event_id: string;
  contact_id: string;
  position: string;
  notes: string | null;
};

export type EventDocument = Timestamps & {
  id: string;
  event_id: string;
  document_type:
    | "agenda"
    | "meeting_minutes"
    | "welcome_packet"
    | "tournament_packet"
    | "tabulation_summary"
    | "other";
  title: string;
  url: string;
  uploaded_at: string;
  uploaded_by: string | null;
};

export type Project = Timestamps & {
  id: string;
  name: string;
  description: string | null;
  status: "planning" | "active" | "on_hold" | "completed" | "cancelled";
  priority: "low" | "medium" | "high";
  start_date: string | null;
  target_completion_date: string | null;
  completed_at: string | null;
  owner_id: string | null;
  committee_id: string | null;
  event_id: string | null;
  notes: string | null;
};

export type ProjectAssignment = Timestamps & {
  id: string;
  project_id: string;
  contact_id: string;
  role_on_project: "Lead" | "Reviewer" | "Contributor";
};

export type Task = Timestamps & {
  id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "blocked" | "done";
  priority: "low" | "medium" | "high";
  due_date: string | null;
  assigned_to: string | null;
  completed_at: string | null;
};

export type Interaction = Timestamps & {
  id: string;
  type: "email" | "call" | "meeting" | "note" | "other";
  subject: string;
  content: string | null;
  occurred_at: string;
  direction: "inbound" | "outbound" | "internal" | null;
  logged_by: string | null;
};

export type InteractionParticipant = Timestamps & {
  id: string;
  interaction_id: string;
  contact_id: string;
  participant_role:
    | "sender"
    | "recipient"
    | "cc"
    | "attendee"
    | "mentioned"
    | "participant";
};

export type InteractionLink = Timestamps & {
  id: string;
  interaction_id: string;
  linked_event_id: string | null;
  linked_committee_id: string | null;
  linked_program_id: string | null;
  linked_project_id: string | null;
};

export type Invitation = Timestamps & {
  id: string;
  contact_id: string;
  email: string;
  token: string;
  invited_by: string | null;
  sent_at: string;
  accepted_at: string | null;
  expires_at: string | null;
};

// =============================================================================
// Database type — the shape Supabase JS expects
// =============================================================================

type TableRow<TRow> = {
  Row: TRow;
  Insert: Partial<TRow> & { id?: string };
  Update: Partial<TRow>;
};

export interface Database {
  public: {
    Tables: {
      contacts: TableRow<Contact>;
      contact_categories: TableRow<ContactCategory>;
      contact_category_assignments: TableRow<ContactCategoryAssignment>;
      programs: TableRow<Program>;
      committees: TableRow<Committee>;
      board_terms: TableRow<BoardTerm>;
      officer_terms: TableRow<OfficerTerm>;
      committee_assignments: TableRow<CommitteeAssignment>;
      program_affiliations: TableRow<ProgramAffiliation>;
      events: TableRow<Event>;
      event_hosts: TableRow<EventHost>;
      event_staff: TableRow<EventStaff>;
      event_documents: TableRow<EventDocument>;
      projects: TableRow<Project>;
      project_assignments: TableRow<ProjectAssignment>;
      tasks: TableRow<Task>;
      interactions: TableRow<Interaction>;
      interaction_participants: TableRow<InteractionParticipant>;
      interaction_links: TableRow<InteractionLink>;
      invitations: TableRow<Invitation>;
    };
    Views: {
      // Active views mirror their underlying tables, just pre-filtered
      active_contacts: { Row: Contact };
      active_contact_categories: { Row: ContactCategory };
      active_contact_category_assignments: { Row: ContactCategoryAssignment };
      active_programs: { Row: Program };
      active_committees: { Row: Committee };
      active_board_terms: { Row: BoardTerm };
      active_officer_terms: { Row: OfficerTerm };
      active_committee_assignments: { Row: CommitteeAssignment };
      active_program_affiliations: { Row: ProgramAffiliation };
      active_events: { Row: Event };
      active_event_hosts: { Row: EventHost };
      active_event_staff: { Row: EventStaff };
      active_event_documents: { Row: EventDocument };
      active_projects: { Row: Project };
      active_project_assignments: { Row: ProjectAssignment };
      active_tasks: { Row: Task };
      active_interactions: { Row: Interaction };
      active_interaction_participants: { Row: InteractionParticipant };
      active_interaction_links: { Row: InteractionLink };
      active_invitations: { Row: Invitation };
    };
    Functions: {
      soft_delete: {
        Args: { table_name: string; row_id: string };
        Returns: string | null;
      };
      restore: {
        Args: { table_name: string; row_id: string };
        Returns: string | null;
      };
    };
  };
}

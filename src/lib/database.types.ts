// src/lib/database.types.ts
// =============================================================================
// Friendly type aliases over the generated Supabase types.
// =============================================================================
// The Supabase CLI writes the canonical generated types to
// `database.generated.ts`. This file:
//   1. Re-exports the entire `Database` type (so anything that imports
//      `Database` from here keeps working)
//   2. Adds friendly aliases (`Contact`, `Event`, `Task`, …) under the names
//      the codebase has been using all along
//
// Workflow:
//   - To regenerate, run `npm run types:generate`
//     (which writes `database.generated.ts`, never this file)
//   - Schema drift surfaces as TS errors at the call sites that use these
//     aliases
//   - This file is hand-edited and committed — it never changes during
//     regeneration
// =============================================================================

import type { Database } from "./database.generated";
export type { Database } from "./database.generated";
export type { Json } from "./database.generated";

type Tables = Database["public"]["Tables"];
type Views = Database["public"]["Views"];

// ---------------------------------------------------------------------------
// Core entities
// ---------------------------------------------------------------------------
export type Contact = Tables["contacts"]["Row"];
export type ContactCategory = Tables["contact_categories"]["Row"];
export type ContactCategoryAssignment =
  Tables["contact_category_assignments"]["Row"];

export type Program = Tables["programs"]["Row"];
export type ProgramAffiliation = Tables["program_affiliations"]["Row"];

export type Committee = Tables["committees"]["Row"];
export type CommitteeAssignment = Tables["committee_assignments"]["Row"];

export type BoardTerm = Tables["board_terms"]["Row"];
export type OfficerTerm = Tables["officer_terms"]["Row"];

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------
export type Event = Tables["events"]["Row"];
export type EventHost = Tables["event_hosts"]["Row"];
export type EventStaff = Tables["event_staff"]["Row"];
export type EventDocument = Tables["event_documents"]["Row"];

// ---------------------------------------------------------------------------
// Interactions
// ---------------------------------------------------------------------------
export type Interaction = Tables["interactions"]["Row"];
export type InteractionParticipant =
  Tables["interaction_participants"]["Row"];
export type InteractionLink = Tables["interaction_links"]["Row"];

// ---------------------------------------------------------------------------
// Tasks & Projects
// ---------------------------------------------------------------------------
export type Task = Tables["tasks"]["Row"];
export type Project = Tables["projects"]["Row"];
export type ProjectAssignment = Tables["project_assignments"]["Row"];

// ---------------------------------------------------------------------------
// Auth / Admin
// ---------------------------------------------------------------------------
export type Invitation = Tables["invitations"]["Row"];

// ---------------------------------------------------------------------------
// AI features
// ---------------------------------------------------------------------------
export type AiConversation = Tables["ai_conversations"]["Row"];
export type AiMessage = Tables["ai_messages"]["Row"];

// ---------------------------------------------------------------------------
// Insert and Update variants for any table.
// Usage:
//   type ContactInsert = Insert<'contacts'>
//   type EventUpdate = Update<'events'>
// ---------------------------------------------------------------------------
export type Insert<T extends keyof Tables> = Tables[T]["Insert"];
export type Update<T extends keyof Tables> = Tables[T]["Update"];

// ---------------------------------------------------------------------------
// Views (read-only "active" filtered versions of tables)
// ---------------------------------------------------------------------------
export type ActiveContact = Views["active_contacts"]["Row"];
export type ActiveProgram = Views["active_programs"]["Row"];
export type ActiveCommittee = Views["active_committees"]["Row"];
export type ActiveEvent = Views["active_events"]["Row"];

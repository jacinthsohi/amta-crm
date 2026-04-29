-- =============================================================================
-- AMTA CRM — Row Level Security & active-row views
-- =============================================================================
-- Authentication model:
--   * Authenticated users (via Supabase Auth) get full read/write access to
--     all tables. AMTA's CRM admins are a small trusted group and the data
--     is internal-only. We can layer more granular policies later if needed.
--   * Anonymous (unauthenticated) users get NO access.
--   * Service role (used by server-side functions, e.g. invitation acceptance)
--     bypasses RLS as usual.
-- =============================================================================

-- Helper: returns true if the caller is an authenticated user
create or replace function public.is_authenticated()
returns boolean
language sql
stable
as $$
  select auth.uid() is not null;
$$;

-- =============================================================================
-- Enable RLS and create policies for every public table
-- =============================================================================

-- All tables use the same simple pattern. We define a helper to apply it.
-- Idea: any authenticated user can SELECT/INSERT/UPDATE/DELETE on every table.
-- "DELETE" here means hard-delete; the app should soft-delete instead.

do $$
declare
  t text;
  tables text[] := array[
    'contact_categories',
    'contacts',
    'contact_category_assignments',
    'programs',
    'committees',
    'board_terms',
    'officer_terms',
    'committee_assignments',
    'program_affiliations',
    'events',
    'event_hosts',
    'event_staff',
    'event_documents',
    'projects',
    'project_assignments',
    'tasks',
    'interactions',
    'interaction_participants',
    'interaction_links',
    'invitations'
  ];
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy authenticated_select_%s on public.%I for select to authenticated using (true)', t, t);
    execute format('create policy authenticated_insert_%s on public.%I for insert to authenticated with check (true)', t, t);
    execute format('create policy authenticated_update_%s on public.%I for update to authenticated using (true) with check (true)', t, t);
    execute format('create policy authenticated_delete_%s on public.%I for delete to authenticated using (true)', t, t);
  end loop;
end;
$$;


-- =============================================================================
-- Active-row views
-- =============================================================================
-- Application code reads from these views by default. They hide soft-deleted
-- rows. The Restore UI (admin) reads from the underlying tables directly.
-- =============================================================================

create view public.active_contact_categories as
  select * from public.contact_categories where deleted_at is null;

create view public.active_contacts as
  select * from public.contacts where deleted_at is null;

create view public.active_contact_category_assignments as
  select * from public.contact_category_assignments where deleted_at is null;

create view public.active_programs as
  select * from public.programs where deleted_at is null;

create view public.active_committees as
  select * from public.committees where deleted_at is null;

create view public.active_board_terms as
  select * from public.board_terms where deleted_at is null;

create view public.active_officer_terms as
  select * from public.officer_terms where deleted_at is null;

create view public.active_committee_assignments as
  select * from public.committee_assignments where deleted_at is null;

create view public.active_program_affiliations as
  select * from public.program_affiliations where deleted_at is null;

create view public.active_events as
  select * from public.events where deleted_at is null;

create view public.active_event_hosts as
  select * from public.event_hosts where deleted_at is null;

create view public.active_event_staff as
  select * from public.event_staff where deleted_at is null;

create view public.active_event_documents as
  select * from public.event_documents where deleted_at is null;

create view public.active_projects as
  select * from public.projects where deleted_at is null;

create view public.active_project_assignments as
  select * from public.project_assignments where deleted_at is null;

create view public.active_tasks as
  select * from public.tasks where deleted_at is null;

create view public.active_interactions as
  select * from public.interactions where deleted_at is null;

create view public.active_interaction_participants as
  select * from public.interaction_participants where deleted_at is null;

create view public.active_interaction_links as
  select * from public.interaction_links where deleted_at is null;

create view public.active_invitations as
  select * from public.invitations where deleted_at is null;

-- Grant view access to the same audience as the underlying tables
grant select on
  public.active_contact_categories,
  public.active_contacts,
  public.active_contact_category_assignments,
  public.active_programs,
  public.active_committees,
  public.active_board_terms,
  public.active_officer_terms,
  public.active_committee_assignments,
  public.active_program_affiliations,
  public.active_events,
  public.active_event_hosts,
  public.active_event_staff,
  public.active_event_documents,
  public.active_projects,
  public.active_project_assignments,
  public.active_tasks,
  public.active_interactions,
  public.active_interaction_participants,
  public.active_interaction_links,
  public.active_invitations
to authenticated;

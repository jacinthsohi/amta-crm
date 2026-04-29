-- =============================================================================
-- AMTA CRM — Initial schema
-- =============================================================================
-- Conventions used throughout:
-- * Every primary key is a uuid generated server-side.
-- * Every table has created_at and updated_at timestamps.
-- * Every table is soft-deletable via deleted_at (NULL = active, set = deleted).
-- * Unique constraints are partial (WHERE deleted_at IS NULL) so deleted
--   rows do not block new ones.
-- * Foreign keys use ON DELETE CASCADE for sub-records (e.g. interaction
--   participants vanish if their parent interaction is hard-deleted),
--   ON DELETE RESTRICT for substantive references (e.g. you cannot hard-delete
--   a committee that has assignments — soft-delete it instead).
-- * Active-row views (active_contacts, active_events, etc.) hide deleted
--   rows from normal queries. The Restore UI queries the underlying tables.
-- =============================================================================

-- Required extensions ---------------------------------------------------------
create extension if not exists "uuid-ossp";

-- =============================================================================
-- Helper: auto-update updated_at
-- =============================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================================================
-- Lookups
-- =============================================================================

create table public.contact_categories (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create unique index contact_categories_name_unique
  on public.contact_categories (name)
  where deleted_at is null;

create trigger contact_categories_updated_at
  before update on public.contact_categories
  for each row execute function public.set_updated_at();

-- Seed the default categories we agreed on
insert into public.contact_categories (name) values
  ('Alumni'),
  ('Donor'),
  ('Judge'),
  ('Coach'),
  ('Current Board Member'),
  ('Past Board Member');


-- =============================================================================
-- Programs (member institutions)
-- =============================================================================

create table public.programs (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null,
  short_name      text not null,
  city            text,
  state           text,
  website         text,
  status          text not null default 'active'
                  check (status in ('active', 'inactive')),
  joined_year     int,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create index programs_active_idx on public.programs (status) where deleted_at is null;
create unique index programs_name_unique on public.programs (name) where deleted_at is null;

create trigger programs_updated_at
  before update on public.programs
  for each row execute function public.set_updated_at();


-- =============================================================================
-- Committees
-- =============================================================================

create table public.committees (
  id                    uuid primary key default uuid_generate_v4(),
  name                  text not null,
  description           text,
  parent_committee_id   uuid references public.committees(id) on delete restrict,
  status                text not null default 'active'
                        check (status in ('active', 'inactive')),
  is_executive          boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz
);

create index committees_parent_idx on public.committees (parent_committee_id)
  where deleted_at is null;
create unique index committees_name_unique on public.committees (name)
  where deleted_at is null;

create trigger committees_updated_at
  before update on public.committees
  for each row execute function public.set_updated_at();


-- =============================================================================
-- Contacts
-- =============================================================================
-- auth_user_id links a contact to a Supabase Auth user (auth.users.id).
-- Most contacts (alumni, donors, etc.) never log in, so this is nullable.
-- When someone accepts an invitation, we set this column on their existing
-- contact row.
-- =============================================================================

create table public.contacts (
  id                  uuid primary key default uuid_generate_v4(),
  auth_user_id        uuid unique references auth.users(id) on delete set null,
  first_name          text not null,
  last_name           text not null,
  email               text,
  phone               text,
  profile_photo_url   text,
  notes               text,
  -- Board-related metadata. has_board_history is true if the contact has any
  -- board terms (we maintain it via trigger to keep queries simple).
  standing            text check (standing in ('active', 'inactive')),
  has_board_history   boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);

create index contacts_email_idx on public.contacts (email) where deleted_at is null;
create index contacts_name_idx on public.contacts (last_name, first_name) where deleted_at is null;
create unique index contacts_email_unique on public.contacts (lower(email))
  where deleted_at is null and email is not null;

create trigger contacts_updated_at
  before update on public.contacts
  for each row execute function public.set_updated_at();


-- =============================================================================
-- Contact ↔ Category (many-to-many)
-- =============================================================================

create table public.contact_category_assignments (
  id                uuid primary key default uuid_generate_v4(),
  contact_id        uuid not null references public.contacts(id) on delete cascade,
  category_id       uuid not null references public.contact_categories(id) on delete cascade,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);

create index cca_contact_idx on public.contact_category_assignments (contact_id)
  where deleted_at is null;
create index cca_category_idx on public.contact_category_assignments (category_id)
  where deleted_at is null;
create unique index cca_unique on public.contact_category_assignments (contact_id, category_id)
  where deleted_at is null;

create trigger cca_updated_at
  before update on public.contact_category_assignments
  for each row execute function public.set_updated_at();


-- =============================================================================
-- Board Terms
-- =============================================================================
-- Captures every term someone has served on the board. Three types:
--   first_year_candidate, second_year_candidate, voting_director.
-- Note: progression first → second → voting is NOT automatic.
-- =============================================================================

create table public.board_terms (
  id              uuid primary key default uuid_generate_v4(),
  contact_id      uuid not null references public.contacts(id) on delete cascade,
  term_type       text not null
                  check (term_type in ('first_year_candidate', 'second_year_candidate', 'voting_director')),
  election_year   int not null,
  start_date      date,
  end_date        date,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create index board_terms_contact_idx on public.board_terms (contact_id) where deleted_at is null;
create index board_terms_year_idx on public.board_terms (election_year) where deleted_at is null;

create trigger board_terms_updated_at
  before update on public.board_terms
  for each row execute function public.set_updated_at();

-- Trigger: maintain has_board_history on contact when board_terms change.
-- Sets to true when a non-deleted term exists; sets to false when none remain.
create or replace function public.refresh_has_board_history()
returns trigger
language plpgsql
as $$
declare
  target_contact uuid;
begin
  target_contact := coalesce(new.contact_id, old.contact_id);
  update public.contacts c
    set has_board_history = exists (
      select 1 from public.board_terms bt
      where bt.contact_id = target_contact and bt.deleted_at is null
    )
    where c.id = target_contact;
  return null;
end;
$$;

create trigger board_terms_refresh_has_history
  after insert or update or delete on public.board_terms
  for each row execute function public.refresh_has_board_history();


-- =============================================================================
-- Officer Terms
-- =============================================================================
-- Officer roles are distinct from board terms. Only President is elected;
-- others are appointed.
-- =============================================================================

create table public.officer_terms (
  id              uuid primary key default uuid_generate_v4(),
  contact_id      uuid not null references public.contacts(id) on delete cascade,
  officer_type    text not null
                  check (officer_type in ('president', 'president_elect', 'past_president', 'secretary', 'treasurer')),
  start_date      date not null,
  end_date        date,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create index officer_terms_contact_idx on public.officer_terms (contact_id) where deleted_at is null;

create trigger officer_terms_updated_at
  before update on public.officer_terms
  for each row execute function public.set_updated_at();


-- =============================================================================
-- Committee Assignments
-- =============================================================================

create table public.committee_assignments (
  id              uuid primary key default uuid_generate_v4(),
  contact_id      uuid not null references public.contacts(id) on delete cascade,
  committee_id    uuid not null references public.committees(id) on delete cascade,
  position        text not null,
  start_date      date,
  end_date        date,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create index ca_contact_idx on public.committee_assignments (contact_id) where deleted_at is null;
create index ca_committee_idx on public.committee_assignments (committee_id) where deleted_at is null;

create trigger ca_updated_at
  before update on public.committee_assignments
  for each row execute function public.set_updated_at();


-- =============================================================================
-- Program Affiliations (contact ↔ program)
-- =============================================================================
-- affiliation_type:
--   student_alumni — a single type that represents "student" while end_year is
--     in the future and "alumni" once end_year has passed.
--   coach — coaches a program's mock trial team.
--   advisor — faculty advisor or similar.
-- =============================================================================

create table public.program_affiliations (
  id                  uuid primary key default uuid_generate_v4(),
  contact_id          uuid not null references public.contacts(id) on delete cascade,
  program_id          uuid not null references public.programs(id) on delete cascade,
  affiliation_type    text not null
                      check (affiliation_type in ('student_alumni', 'coach', 'advisor')),
  start_year          int not null,
  end_year            int,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);

create index pa_contact_idx on public.program_affiliations (contact_id) where deleted_at is null;
create index pa_program_idx on public.program_affiliations (program_id) where deleted_at is null;

create trigger pa_updated_at
  before update on public.program_affiliations
  for each row execute function public.set_updated_at();


-- =============================================================================
-- Events (unified tournaments + board meetings)
-- =============================================================================

create table public.events (
  id                          uuid primary key default uuid_generate_v4(),
  name                        text not null,
  event_type                  text not null
                              check (event_type in ('tournament', 'board_meeting')),
  -- tournament_type only meaningful when event_type = 'tournament'
  tournament_type             text
                              check (tournament_type in ('invitational', 'regional', 'orcs', 'nct')),
  start_date                  date not null,
  end_date                    date,
  location_city               text,
  location_state              text,
  -- A CSS gradient string used as the event banner. Saves us a real photo
  -- pipeline for v1; we can swap to a photo url later.
  photo_banner_gradient       text,
  status                      text not null default 'upcoming'
                              check (status in ('upcoming', 'in_progress', 'completed', 'cancelled')),
  primary_host_contact_id     uuid references public.contacts(id) on delete set null,
  description                 text,
  notes                       text,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  deleted_at                  timestamptz,
  -- Enforce that tournament_type is set iff event_type = 'tournament'
  constraint events_tournament_type_consistent check (
    (event_type = 'tournament'  and tournament_type is not null) or
    (event_type = 'board_meeting' and tournament_type is null)
  )
);

create index events_dates_idx on public.events (start_date, end_date) where deleted_at is null;
create index events_status_idx on public.events (status) where deleted_at is null;
create index events_type_idx on public.events (event_type) where deleted_at is null;

create trigger events_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();


-- =============================================================================
-- Event Hosts (event ↔ program)
-- =============================================================================

create table public.event_hosts (
  id              uuid primary key default uuid_generate_v4(),
  event_id        uuid not null references public.events(id) on delete cascade,
  program_id      uuid not null references public.programs(id) on delete cascade,
  host_role       text not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create index eh_event_idx on public.event_hosts (event_id) where deleted_at is null;
create index eh_program_idx on public.event_hosts (program_id) where deleted_at is null;

create trigger eh_updated_at
  before update on public.event_hosts
  for each row execute function public.set_updated_at();


-- =============================================================================
-- Event Staff (event ↔ contact, with free-text position)
-- =============================================================================

create table public.event_staff (
  id              uuid primary key default uuid_generate_v4(),
  event_id        uuid not null references public.events(id) on delete cascade,
  contact_id      uuid not null references public.contacts(id) on delete cascade,
  position        text not null,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create index es_event_idx on public.event_staff (event_id) where deleted_at is null;
create index es_contact_idx on public.event_staff (contact_id) where deleted_at is null;

create trigger es_updated_at
  before update on public.event_staff
  for each row execute function public.set_updated_at();


-- =============================================================================
-- Event Documents (links to externally-hosted files)
-- =============================================================================

create table public.event_documents (
  id              uuid primary key default uuid_generate_v4(),
  event_id        uuid not null references public.events(id) on delete cascade,
  document_type   text not null
                  check (document_type in ('agenda', 'meeting_minutes', 'welcome_packet', 'tournament_packet', 'tabulation_summary', 'other')),
  title           text not null,
  url             text not null,
  uploaded_at     timestamptz not null default now(),
  uploaded_by     uuid references public.contacts(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create index ed_event_idx on public.event_documents (event_id) where deleted_at is null;

create trigger ed_updated_at
  before update on public.event_documents
  for each row execute function public.set_updated_at();


-- =============================================================================
-- Projects
-- =============================================================================

create table public.projects (
  id                          uuid primary key default uuid_generate_v4(),
  name                        text not null,
  description                 text,
  status                      text not null default 'active'
                              check (status in ('planning', 'active', 'on_hold', 'completed', 'cancelled')),
  priority                    text not null default 'medium'
                              check (priority in ('low', 'medium', 'high')),
  start_date                  date,
  target_completion_date      date,
  completed_at                date,
  owner_id                    uuid references public.contacts(id) on delete set null,
  committee_id                uuid references public.committees(id) on delete set null,
  event_id                    uuid references public.events(id) on delete set null,
  notes                       text,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  deleted_at                  timestamptz
);

create index projects_status_idx on public.projects (status) where deleted_at is null;
create index projects_committee_idx on public.projects (committee_id) where deleted_at is null;
create index projects_owner_idx on public.projects (owner_id) where deleted_at is null;

create trigger projects_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();


-- =============================================================================
-- Project Assignments (project ↔ contact)
-- =============================================================================

create table public.project_assignments (
  id                  uuid primary key default uuid_generate_v4(),
  project_id          uuid not null references public.projects(id) on delete cascade,
  contact_id          uuid not null references public.contacts(id) on delete cascade,
  role_on_project     text not null
                      check (role_on_project in ('Lead', 'Reviewer', 'Contributor')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);

create index proj_a_project_idx on public.project_assignments (project_id) where deleted_at is null;
create index proj_a_contact_idx on public.project_assignments (contact_id) where deleted_at is null;

create trigger proj_a_updated_at
  before update on public.project_assignments
  for each row execute function public.set_updated_at();


-- =============================================================================
-- Tasks
-- =============================================================================

create table public.tasks (
  id              uuid primary key default uuid_generate_v4(),
  project_id      uuid references public.projects(id) on delete set null,
  title           text not null,
  description     text,
  status          text not null default 'todo'
                  check (status in ('todo', 'in_progress', 'blocked', 'done')),
  priority        text not null default 'medium'
                  check (priority in ('low', 'medium', 'high')),
  due_date        date,
  assigned_to     uuid references public.contacts(id) on delete set null,
  completed_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create index tasks_project_idx on public.tasks (project_id) where deleted_at is null;
create index tasks_assignee_idx on public.tasks (assigned_to) where deleted_at is null;
create index tasks_status_idx on public.tasks (status) where deleted_at is null;
create index tasks_due_idx on public.tasks (due_date) where deleted_at is null;

create trigger tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();


-- =============================================================================
-- Interactions
-- =============================================================================

create table public.interactions (
  id              uuid primary key default uuid_generate_v4(),
  type            text not null
                  check (type in ('email', 'call', 'meeting', 'note', 'other')),
  subject         text not null,
  content         text,
  occurred_at     timestamptz not null,
  direction       text
                  check (direction in ('inbound', 'outbound', 'internal')),
  logged_by       uuid references public.contacts(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create index interactions_occurred_idx on public.interactions (occurred_at desc) where deleted_at is null;
create index interactions_type_idx on public.interactions (type) where deleted_at is null;
create index interactions_logged_by_idx on public.interactions (logged_by) where deleted_at is null;

create trigger interactions_updated_at
  before update on public.interactions
  for each row execute function public.set_updated_at();


-- =============================================================================
-- Interaction Participants
-- =============================================================================

create table public.interaction_participants (
  id                  uuid primary key default uuid_generate_v4(),
  interaction_id      uuid not null references public.interactions(id) on delete cascade,
  contact_id          uuid not null references public.contacts(id) on delete cascade,
  participant_role    text not null
                      check (participant_role in ('sender', 'recipient', 'cc', 'attendee', 'mentioned', 'participant')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);

create index ip_interaction_idx on public.interaction_participants (interaction_id) where deleted_at is null;
create index ip_contact_idx on public.interaction_participants (contact_id) where deleted_at is null;

create trigger ip_updated_at
  before update on public.interaction_participants
  for each row execute function public.set_updated_at();


-- =============================================================================
-- Interaction Links
-- =============================================================================
-- Wide-table polymorphism: an interaction link points to exactly one of
-- {event, committee, program, project} — enforced by a check constraint that
-- requires precisely one of the four FK columns to be non-null.
-- =============================================================================

create table public.interaction_links (
  id                  uuid primary key default uuid_generate_v4(),
  interaction_id      uuid not null references public.interactions(id) on delete cascade,
  linked_event_id     uuid references public.events(id) on delete cascade,
  linked_committee_id uuid references public.committees(id) on delete cascade,
  linked_program_id   uuid references public.programs(id) on delete cascade,
  linked_project_id   uuid references public.projects(id) on delete cascade,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz,
  -- Exactly one link target must be set
  constraint il_exactly_one_target check (
    (case when linked_event_id     is not null then 1 else 0 end) +
    (case when linked_committee_id is not null then 1 else 0 end) +
    (case when linked_program_id   is not null then 1 else 0 end) +
    (case when linked_project_id   is not null then 1 else 0 end) = 1
  )
);

create index il_interaction_idx on public.interaction_links (interaction_id) where deleted_at is null;
create index il_event_idx on public.interaction_links (linked_event_id) where deleted_at is null and linked_event_id is not null;
create index il_committee_idx on public.interaction_links (linked_committee_id) where deleted_at is null and linked_committee_id is not null;
create index il_program_idx on public.interaction_links (linked_program_id) where deleted_at is null and linked_program_id is not null;
create index il_project_idx on public.interaction_links (linked_project_id) where deleted_at is null and linked_project_id is not null;

create trigger il_updated_at
  before update on public.interaction_links
  for each row execute function public.set_updated_at();


-- =============================================================================
-- Invitations (invite-only signup)
-- =============================================================================
-- An admin invites someone by creating a row here. The `token` is a random
-- string used in the invite URL. When the invitee accepts, we set accepted_at
-- and link their auth.users row to the contact (via contacts.auth_user_id).
-- Expired or used tokens stay around as audit trail.
-- =============================================================================

create table public.invitations (
  id              uuid primary key default uuid_generate_v4(),
  contact_id      uuid not null references public.contacts(id) on delete cascade,
  email           text not null,
  token           text not null unique,
  invited_by      uuid references public.contacts(id) on delete set null,
  sent_at         timestamptz not null default now(),
  accepted_at     timestamptz,
  expires_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create index invitations_contact_idx on public.invitations (contact_id) where deleted_at is null;
create index invitations_email_idx on public.invitations (email) where deleted_at is null;

create trigger invitations_updated_at
  before update on public.invitations
  for each row execute function public.set_updated_at();

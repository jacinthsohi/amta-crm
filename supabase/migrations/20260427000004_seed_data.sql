-- =============================================================================
-- AMTA CRM — Seed data (development / demo)
-- =============================================================================
-- Loads the full dataset we used in the prototype: 24 contacts, 8 programs,
-- 10 committees, plus their relationships. This makes the app feel "lived in"
-- for development. Wipe before going live (see end of file for instructions).
--
-- Idempotent: uses ON CONFLICT DO NOTHING on natural keys so re-running does
-- not error or duplicate.
--
-- This file does NOT touch contact_categories — those were seeded in the
-- initial migration.
-- =============================================================================

-- =============================================================================
-- Programs
-- =============================================================================
insert into public.programs (id, name, short_name, city, state, website, status, joined_year, notes)
values
  (uuid_generate_v4(), 'Yale University', 'Yale', 'New Haven', 'CT', 'yale.edu', 'active', 1990, 'Long-standing host of the New Haven ORCS and the Yale Invitational.'),
  (uuid_generate_v4(), 'Stanford University', 'Stanford', 'Stanford', 'CA', 'stanford.edu', 'active', 1992, null),
  (uuid_generate_v4(), 'University of Virginia', 'UVA', 'Charlottesville', 'VA', 'virginia.edu', 'active', 1995, null),
  (uuid_generate_v4(), 'Rhodes College', 'Rhodes', 'Memphis', 'TN', 'rhodes.edu', 'active', 1996, 'Hosted 2026 NCT.'),
  (uuid_generate_v4(), 'UCLA', 'UCLA', 'Los Angeles', 'CA', 'ucla.edu', 'active', 2001, null),
  (uuid_generate_v4(), 'University of Chicago', 'UChicago', 'Chicago', 'IL', 'uchicago.edu', 'active', 1998, null),
  (uuid_generate_v4(), 'Northwestern University', 'Northwestern', 'Evanston', 'IL', 'northwestern.edu', 'active', 1994, null),
  (uuid_generate_v4(), 'Tufts University', 'Tufts', 'Medford', 'MA', 'tufts.edu', 'active', 2003, null)
on conflict do nothing;

-- =============================================================================
-- Committees (top-level first, then subcommittees)
-- =============================================================================
insert into public.committees (id, name, description, parent_committee_id, status, is_executive)
values
  (uuid_generate_v4(), 'Executive Committee', 'Officers and key committee chairs. Also serves as the Nominating Committee.', null, 'active', true),
  (uuid_generate_v4(), 'Development Committee', 'Stewards fundraising, donor relationships, and long-term financial sustainability.', null, 'active', false),
  (uuid_generate_v4(), 'Academics Committee', 'Provides resources for AMTA members creating mock trial courses and curricula. Conducts research and serves as a liaison to academic institutions.', null, 'active', false),
  (uuid_generate_v4(), 'Diversity & Inclusion Committee', 'Promotes diversity, equity, and inclusion across AMTA programs and competitions.', null, 'active', false),
  (uuid_generate_v4(), 'Rules, IP & Ethics Committee', 'Reviews and maintains AMTA rules, intellectual property policies, and ethical guidelines.', null, 'active', false),
  (uuid_generate_v4(), 'Tournament Administration Committee', 'Oversees tournament operations including host recruitment, judge coordination, and team placement.', null, 'active', false),
  (uuid_generate_v4(), 'Operational Excellence Committee', 'Improves internal operations, processes, and organizational effectiveness.', null, 'active', false)
on conflict do nothing;

-- Subcommittees of Tournament Administration
insert into public.committees (id, name, description, parent_committee_id, status, is_executive)
select uuid_generate_v4(), 'Host Recruitment & Selection', 'Identifies and evaluates prospective tournament hosts.',
       (select id from public.committees where name = 'Tournament Administration Committee'),
       'active', false
where not exists (select 1 from public.committees where name = 'Host Recruitment & Selection');

insert into public.committees (id, name, description, parent_committee_id, status, is_executive)
select uuid_generate_v4(), 'Host Relations & Judge Recruitment', 'Manages host communication, training, and judge recruitment.',
       (select id from public.committees where name = 'Tournament Administration Committee'),
       'active', false
where not exists (select 1 from public.committees where name = 'Host Relations & Judge Recruitment');

insert into public.committees (id, name, description, parent_committee_id, status, is_executive)
select uuid_generate_v4(), 'Team Placement & Logistics', 'Handles team assignments and logistical planning for tournaments.',
       (select id from public.committees where name = 'Tournament Administration Committee'),
       'active', false
where not exists (select 1 from public.committees where name = 'Team Placement & Logistics');


-- =============================================================================
-- Contacts
-- =============================================================================
-- Build a CTE-based seed so we can reference UUIDs by stable email keys.
--
-- Why email as the natural key? Because the prototype data uses example.org
-- emails and they're unique. We avoid hardcoding UUIDs (which would be ugly
-- and brittle).
-- =============================================================================

-- Insert contacts. has_board_history will be auto-maintained by trigger when
-- we insert their board_terms rows below.
insert into public.contacts (id, first_name, last_name, email, phone, notes, standing)
values
  (uuid_generate_v4(), 'Jacinth', 'Sohi', 'jacinth.sohi@example.org', '(555) 123-4567', 'Currently serving as President. Strong relationships across the academic committee.', 'active'),
  (uuid_generate_v4(), 'Michael', 'D''Ippolito', 'm.dippolito@example.org', '(555) 234-5678', 'President-Elect. Chairs Analytics and Disciplinary committees.', 'active'),
  (uuid_generate_v4(), 'Justin', 'Bernstein', 'justin.bernstein@example.org', '(555) 345-6789', 'Development Committee Chair. Long-standing member, deep institutional knowledge.', 'active'),
  (uuid_generate_v4(), 'DeLois', 'Leapheart', 'leapheart@example.org', '(555) 456-7890', 'Academics Committee Chair.', 'active'),
  (uuid_generate_v4(), 'Lori', 'Williams', 'lori.williams@example.org', '(555) 567-8901', 'Past President. Active in mentorship and host relations.', 'active'),
  (uuid_generate_v4(), 'Sara', 'Wagner', 'sara.wagner@example.org', '(555) 678-9012', 'Treasurer.', 'active'),
  (uuid_generate_v4(), 'Caroline', 'Berube', 'caroline.berube@example.org', '(555) 789-0123', 'Secretary.', 'active'),
  (uuid_generate_v4(), 'Tim', 'Heider', 'tim.heider@example.org', '(555) 890-1234', null, 'active'),
  (uuid_generate_v4(), 'Angela', 'Eisenberg', 'angela.eisenberg@example.org', '(555) 901-2345', 'Operational Excellence chair.', 'active'),
  (uuid_generate_v4(), 'Pat', 'Dinh', 'pat.dinh@example.org', '(555) 012-3456', null, 'active'),
  (uuid_generate_v4(), 'Crissy', 'Hampton', 'crissy.hampton@example.org', '(555) 234-5670', 'D&I Committee Co-Chair.', 'active'),
  (uuid_generate_v4(), 'Kris', 'Tippins', 'kris.tippins@example.org', '(555) 345-6701', 'D&I Committee Co-Chair.', 'active'),
  (uuid_generate_v4(), 'Sara', 'Beth Watson', 'sb.watson@example.org', '(555) 456-7012', 'Rules, IP & Ethics chair.', 'active'),
  (uuid_generate_v4(), 'Reza', 'Rezvani', 'reza.rezvani@example.org', '(555) 567-0123', 'Tournament Administration Committee chair.', 'active'),
  (uuid_generate_v4(), 'Sam', 'Donaldson', 'sam.donaldson@example.org', '(555) 670-1234', null, 'active'),
  (uuid_generate_v4(), 'Karuna', 'Patel', 'karuna.patel@example.org', '(555) 701-2345', null, 'active'),
  (uuid_generate_v4(), 'Devon', 'Ortiz', 'devon.ortiz@example.org', '(555) 012-3457', 'Host Recruitment subcommittee lead.', 'active'),
  (uuid_generate_v4(), 'Maya', 'Patel', 'maya.patel@example.org', '(555) 234-5601', 'NCT 2026 tournament director.', 'active'),
  (uuid_generate_v4(), 'Sarah', 'Reynolds', 'sarah.reynolds@example.org', null, 'Alumna. Recently expressed interest in joining the board.', null),
  (uuid_generate_v4(), 'Maria', 'Garcia', 'maria.garcia@example.org', null, 'Alumna. Strong donor.', null),
  (uuid_generate_v4(), 'David', 'Chen', 'david.chen@example.org', null, 'Coach at Tufts.', null),
  (uuid_generate_v4(), 'Lisa', 'Park', 'lisa.park@example.org', null, 'Frequent judge across the Northeast.', null),
  (uuid_generate_v4(), 'Robert', 'Adams', 'robert.adams@example.org', null, 'Major donor.', null),
  (uuid_generate_v4(), 'Jennifer', 'Wu', 'jennifer.wu@example.org', null, 'Coach at UChicago.', null)
on conflict do nothing;


-- =============================================================================
-- Contact ↔ Category assignments
-- =============================================================================
-- For each contact below, link them to their declared categories.
-- We resolve category id by name (lookup table is pre-seeded).
-- =============================================================================

-- Helper: a function to attach a category to a contact by names (idempotent)
create or replace function public._seed_link_category(contact_email text, category_name text)
returns void
language plpgsql
as $$
declare
  v_contact_id uuid;
  v_category_id uuid;
begin
  select id into v_contact_id from public.contacts where email = contact_email;
  select id into v_category_id from public.contact_categories where name = category_name;
  if v_contact_id is null or v_category_id is null then return; end if;
  insert into public.contact_category_assignments (contact_id, category_id)
  values (v_contact_id, v_category_id)
  on conflict do nothing;
end;
$$;

-- Apply category assignments
select public._seed_link_category('jacinth.sohi@example.org', 'Current Board Member');
select public._seed_link_category('jacinth.sohi@example.org', 'Alumni');

select public._seed_link_category('m.dippolito@example.org', 'Current Board Member');

select public._seed_link_category('justin.bernstein@example.org', 'Current Board Member');
select public._seed_link_category('justin.bernstein@example.org', 'Alumni');

select public._seed_link_category('leapheart@example.org', 'Current Board Member');

select public._seed_link_category('lori.williams@example.org', 'Current Board Member');
select public._seed_link_category('lori.williams@example.org', 'Past Board Member');

select public._seed_link_category('sara.wagner@example.org', 'Current Board Member');
select public._seed_link_category('caroline.berube@example.org', 'Current Board Member');
select public._seed_link_category('tim.heider@example.org', 'Current Board Member');
select public._seed_link_category('angela.eisenberg@example.org', 'Current Board Member');
select public._seed_link_category('pat.dinh@example.org', 'Current Board Member');
select public._seed_link_category('crissy.hampton@example.org', 'Current Board Member');
select public._seed_link_category('kris.tippins@example.org', 'Current Board Member');
select public._seed_link_category('sb.watson@example.org', 'Current Board Member');
select public._seed_link_category('reza.rezvani@example.org', 'Current Board Member');
select public._seed_link_category('sam.donaldson@example.org', 'Current Board Member');
select public._seed_link_category('karuna.patel@example.org', 'Current Board Member');
select public._seed_link_category('devon.ortiz@example.org', 'Current Board Member');
select public._seed_link_category('maya.patel@example.org', 'Current Board Member');

select public._seed_link_category('sarah.reynolds@example.org', 'Alumni');
select public._seed_link_category('maria.garcia@example.org', 'Alumni');
select public._seed_link_category('maria.garcia@example.org', 'Donor');
select public._seed_link_category('david.chen@example.org', 'Coach');
select public._seed_link_category('lisa.park@example.org', 'Judge');
select public._seed_link_category('robert.adams@example.org', 'Donor');
select public._seed_link_category('jennifer.wu@example.org', 'Coach');


-- =============================================================================
-- Board terms (only seed for those with board history)
-- =============================================================================

create or replace function public._seed_board_term(
  contact_email text,
  term_type text,
  election_year int,
  start_date date,
  end_date date
) returns void language plpgsql as $$
declare
  v_contact_id uuid;
begin
  select id into v_contact_id from public.contacts where email = contact_email;
  if v_contact_id is null then return; end if;
  insert into public.board_terms (contact_id, term_type, election_year, start_date, end_date)
  values (v_contact_id, term_type, election_year, start_date, end_date);
end;
$$;

-- Only seed if no board terms exist yet (avoids duplication on re-run)
do $$
begin
  if (select count(*) from public.board_terms) = 0 then
    perform public._seed_board_term('jacinth.sohi@example.org', 'voting_director', 2022, '2022-08-01', null);
    perform public._seed_board_term('jacinth.sohi@example.org', 'first_year_candidate', 2020, '2020-08-01', '2021-07-31');
    perform public._seed_board_term('m.dippolito@example.org', 'voting_director', 2021, '2021-08-01', null);
    perform public._seed_board_term('justin.bernstein@example.org', 'voting_director', 2018, '2018-08-01', null);
    perform public._seed_board_term('leapheart@example.org', 'voting_director', 2020, '2020-08-01', null);
    perform public._seed_board_term('lori.williams@example.org', 'voting_director', 2016, '2016-08-01', null);
    perform public._seed_board_term('sara.wagner@example.org', 'voting_director', 2021, '2021-08-01', null);
    perform public._seed_board_term('caroline.berube@example.org', 'voting_director', 2022, '2022-08-01', null);
    perform public._seed_board_term('tim.heider@example.org', 'voting_director', 2019, '2019-08-01', null);
    perform public._seed_board_term('angela.eisenberg@example.org', 'voting_director', 2020, '2020-08-01', null);
    perform public._seed_board_term('pat.dinh@example.org', 'voting_director', 2023, '2023-08-01', null);
    perform public._seed_board_term('crissy.hampton@example.org', 'voting_director', 2022, '2022-08-01', null);
    perform public._seed_board_term('kris.tippins@example.org', 'voting_director', 2023, '2023-08-01', null);
    perform public._seed_board_term('sb.watson@example.org', 'voting_director', 2020, '2020-08-01', null);
    perform public._seed_board_term('reza.rezvani@example.org', 'voting_director', 2019, '2019-08-01', null);
    perform public._seed_board_term('sam.donaldson@example.org', 'first_year_candidate', 2024, '2024-08-01', null);
    perform public._seed_board_term('karuna.patel@example.org', 'first_year_candidate', 2024, '2024-08-01', null);
    perform public._seed_board_term('devon.ortiz@example.org', 'second_year_candidate', 2023, '2023-08-01', null);
    perform public._seed_board_term('maya.patel@example.org', 'voting_director', 2021, '2021-08-01', null);
  end if;
end;
$$;


-- =============================================================================
-- Officer terms
-- =============================================================================

create or replace function public._seed_officer_term(
  contact_email text,
  officer_type text,
  start_date date,
  end_date date
) returns void language plpgsql as $$
declare
  v_contact_id uuid;
begin
  select id into v_contact_id from public.contacts where email = contact_email;
  if v_contact_id is null then return; end if;
  insert into public.officer_terms (contact_id, officer_type, start_date, end_date)
  values (v_contact_id, officer_type, start_date, end_date);
end;
$$;

do $$
begin
  if (select count(*) from public.officer_terms) = 0 then
    perform public._seed_officer_term('jacinth.sohi@example.org', 'president', '2024-08-01', null);
    perform public._seed_officer_term('jacinth.sohi@example.org', 'president_elect', '2023-08-01', '2024-07-31');
    perform public._seed_officer_term('m.dippolito@example.org', 'president_elect', '2024-08-01', null);
    perform public._seed_officer_term('lori.williams@example.org', 'past_president', '2024-08-01', null);
    perform public._seed_officer_term('lori.williams@example.org', 'president', '2022-08-01', '2024-07-31');
    perform public._seed_officer_term('sara.wagner@example.org', 'treasurer', '2023-08-01', null);
    perform public._seed_officer_term('caroline.berube@example.org', 'secretary', '2023-08-01', null);
  end if;
end;
$$;


-- =============================================================================
-- Committee assignments
-- =============================================================================

create or replace function public._seed_ca(
  contact_email text,
  committee_name text,
  role_position text,
  start_date date
) returns void language plpgsql as $$
declare
  v_contact_id uuid;
  v_committee_id uuid;
begin
  select id into v_contact_id from public.contacts where email = contact_email;
  select id into v_committee_id from public.committees where name = committee_name;
  if v_contact_id is null or v_committee_id is null then return; end if;
  insert into public.committee_assignments (contact_id, committee_id, position, start_date)
  values (v_contact_id, v_committee_id, role_position, start_date);
end;
$$;

do $$
begin
  if (select count(*) from public.committee_assignments) = 0 then
    -- Executive Committee
    perform public._seed_ca('jacinth.sohi@example.org', 'Executive Committee', 'Member', '2024-08-01');
    perform public._seed_ca('m.dippolito@example.org', 'Executive Committee', 'Member', '2024-08-01');
    perform public._seed_ca('justin.bernstein@example.org', 'Executive Committee', 'Member', '2024-08-01');
    perform public._seed_ca('leapheart@example.org', 'Executive Committee', 'Member', '2024-08-01');
    perform public._seed_ca('lori.williams@example.org', 'Executive Committee', 'Member', '2024-08-01');
    perform public._seed_ca('sara.wagner@example.org', 'Executive Committee', 'Member', '2024-08-01');
    perform public._seed_ca('caroline.berube@example.org', 'Executive Committee', 'Member', '2024-08-01');

    -- Development Committee
    perform public._seed_ca('justin.bernstein@example.org', 'Development Committee', 'Chair', '2024-08-01');
    perform public._seed_ca('jacinth.sohi@example.org', 'Development Committee', 'Member', '2024-08-01');
    perform public._seed_ca('tim.heider@example.org', 'Development Committee', 'Member', '2024-08-01');

    -- Academics Committee
    perform public._seed_ca('leapheart@example.org', 'Academics Committee', 'Chair', '2024-08-01');
    perform public._seed_ca('pat.dinh@example.org', 'Academics Committee', 'Member', '2024-08-01');

    -- D&I
    perform public._seed_ca('crissy.hampton@example.org', 'Diversity & Inclusion Committee', 'Co-Chair', '2024-08-01');
    perform public._seed_ca('kris.tippins@example.org', 'Diversity & Inclusion Committee', 'Co-Chair', '2024-08-01');
    perform public._seed_ca('leapheart@example.org', 'Diversity & Inclusion Committee', 'Member', '2024-08-01');
    perform public._seed_ca('devon.ortiz@example.org', 'Diversity & Inclusion Committee', 'Member', '2024-08-01');

    -- Rules, IP & Ethics
    perform public._seed_ca('sb.watson@example.org', 'Rules, IP & Ethics Committee', 'Chair', '2024-08-01');
    perform public._seed_ca('justin.bernstein@example.org', 'Rules, IP & Ethics Committee', 'Member', '2024-08-01');

    -- Tournament Administration
    perform public._seed_ca('reza.rezvani@example.org', 'Tournament Administration Committee', 'Chair', '2024-08-01');
    perform public._seed_ca('sam.donaldson@example.org', 'Tournament Administration Committee', 'Member', '2024-08-01');
    perform public._seed_ca('maya.patel@example.org', 'Tournament Administration Committee', 'Member', '2024-08-01');
    perform public._seed_ca('devon.ortiz@example.org', 'Host Recruitment & Selection', 'Lead', '2024-08-01');
    perform public._seed_ca('karuna.patel@example.org', 'Host Relations & Judge Recruitment', 'Lead', '2024-08-01');

    -- Operational Excellence
    perform public._seed_ca('angela.eisenberg@example.org', 'Operational Excellence Committee', 'Chair', '2024-08-01');
    perform public._seed_ca('pat.dinh@example.org', 'Operational Excellence Committee', 'Member', '2024-08-01');
  end if;
end;
$$;


-- =============================================================================
-- Program affiliations
-- =============================================================================

create or replace function public._seed_pa(
  contact_email text,
  program_name text,
  affiliation_type text,
  start_year int,
  end_year int
) returns void language plpgsql as $$
declare
  v_contact_id uuid;
  v_program_id uuid;
begin
  select id into v_contact_id from public.contacts where email = contact_email;
  select id into v_program_id from public.programs where name = program_name;
  if v_contact_id is null or v_program_id is null then return; end if;
  insert into public.program_affiliations (contact_id, program_id, affiliation_type, start_year, end_year)
  values (v_contact_id, v_program_id, affiliation_type, start_year, end_year);
end;
$$;

do $$
begin
  if (select count(*) from public.program_affiliations) = 0 then
    perform public._seed_pa('jacinth.sohi@example.org', 'Yale University', 'student_alumni', 2010, 2014);
    perform public._seed_pa('m.dippolito@example.org', 'Stanford University', 'student_alumni', 2008, 2012);
    perform public._seed_pa('justin.bernstein@example.org', 'UCLA', 'student_alumni', 2005, 2009);
    perform public._seed_pa('justin.bernstein@example.org', 'UCLA', 'coach', 2010, null);
    perform public._seed_pa('lori.williams@example.org', 'University of Virginia', 'student_alumni', 2002, 2006);
    perform public._seed_pa('caroline.berube@example.org', 'Yale University', 'student_alumni', 2011, 2015);
    perform public._seed_pa('maya.patel@example.org', 'Rhodes College', 'student_alumni', 2014, 2018);
    perform public._seed_pa('maya.patel@example.org', 'Rhodes College', 'coach', 2019, null);
    perform public._seed_pa('sarah.reynolds@example.org', 'University of Chicago', 'student_alumni', 2018, 2022);
    perform public._seed_pa('maria.garcia@example.org', 'Northwestern University', 'student_alumni', 2010, 2014);
    perform public._seed_pa('david.chen@example.org', 'Tufts University', 'coach', 2018, null);
    perform public._seed_pa('jennifer.wu@example.org', 'University of Chicago', 'coach', 2020, null);
    perform public._seed_pa('robert.adams@example.org', 'Yale University', 'student_alumni', 1995, 1999);
  end if;
end;
$$;


-- =============================================================================
-- Cleanup: drop the helper functions used only during this seed
-- =============================================================================
drop function public._seed_link_category(text, text);
drop function public._seed_board_term(text, text, int, date, date);
drop function public._seed_officer_term(text, text, date, date);
drop function public._seed_ca(text, text, text, date);
drop function public._seed_pa(text, text, text, int, int);


-- =============================================================================
-- To wipe seed data later (e.g. before going live):
-- =============================================================================
-- delete from public.program_affiliations;
-- delete from public.committee_assignments;
-- delete from public.officer_terms;
-- delete from public.board_terms;
-- delete from public.contact_category_assignments;
-- delete from public.contacts where email like '%@example.org';
-- delete from public.committees where name <> 'Executive Committee'; -- adjust as needed
-- delete from public.programs where website like '%.edu';
-- =============================================================================

-- =============================================================================
-- AMTA CRM — Soft-delete and restore helpers
-- =============================================================================
-- Application code calls these RPCs instead of running raw UPDATE statements.
-- Centralizing the logic here ensures every "delete" goes through the same
-- code path and makes it trivial to add e.g. audit logging later.
-- =============================================================================

-- Generic soft-delete: takes a table name and an id, sets deleted_at = now().
-- Returns the updated row id, or null if no row matched.
create or replace function public.soft_delete(table_name text, row_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  result uuid;
  allowed_tables text[] := array[
    'contact_categories', 'contacts', 'contact_category_assignments',
    'programs', 'committees', 'board_terms', 'officer_terms',
    'committee_assignments', 'program_affiliations',
    'events', 'event_hosts', 'event_staff', 'event_documents',
    'projects', 'project_assignments', 'tasks',
    'interactions', 'interaction_participants', 'interaction_links',
    'invitations'
  ];
begin
  -- Whitelist check: prevent arbitrary table names from being passed
  if not (table_name = any(allowed_tables)) then
    raise exception 'Table % is not soft-deletable', table_name;
  end if;
  -- Caller must be authenticated
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  execute format('update public.%I set deleted_at = now() where id = $1 and deleted_at is null returning id', table_name)
    into result
    using row_id;
  return result;
end;
$$;

-- Restore: clears deleted_at on a previously soft-deleted row.
create or replace function public.restore(table_name text, row_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  result uuid;
  allowed_tables text[] := array[
    'contact_categories', 'contacts', 'contact_category_assignments',
    'programs', 'committees', 'board_terms', 'officer_terms',
    'committee_assignments', 'program_affiliations',
    'events', 'event_hosts', 'event_staff', 'event_documents',
    'projects', 'project_assignments', 'tasks',
    'interactions', 'interaction_participants', 'interaction_links',
    'invitations'
  ];
begin
  if not (table_name = any(allowed_tables)) then
    raise exception 'Table % is not restorable', table_name;
  end if;
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  execute format('update public.%I set deleted_at = null where id = $1 and deleted_at is not null returning id', table_name)
    into result
    using row_id;
  return result;
end;
$$;

grant execute on function public.soft_delete(text, uuid) to authenticated;
grant execute on function public.restore(text, uuid) to authenticated;

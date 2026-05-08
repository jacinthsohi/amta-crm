-- =============================================================================
-- Cascade soft-delete from programs to program_affiliations
-- =============================================================================
-- Until now, soft-deleting a program left dangling program_affiliations rows
-- pointing at it. The detail page rendered "(deleted program)" on the
-- contact's affiliations list, which was confusing and incorrect.
--
-- This migration:
--   1. Adds an AFTER UPDATE trigger on `programs` that cascades a deleted_at
--      change to all related program_affiliations.
--   2. Backfills existing orphans: any active program_affiliation that points
--      at an already-deleted program is soft-deleted now, with deleted_at
--      copied from the program.
--
-- Out of scope (deliberately):
--   - Cascade-on-restore. If a program is later un-deleted via the restore()
--     RPC, its affiliations will NOT come back automatically. They can be
--     restored individually. Tracked for follow-up.
--   - Cascade for other entities (contacts, committees, events). We're only
--     handling programs -> program_affiliations here. Same pattern can be
--     extended later as needed.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Trigger function
-- -----------------------------------------------------------------------------
create or replace function public.cascade_program_soft_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only act when deleted_at transitions from null to non-null. We don't
  -- want to fire on every update, and we explicitly skip the un-delete case
  -- (handled separately if/when we add cascade-on-restore).
  if new.deleted_at is not null and old.deleted_at is null then
    update public.program_affiliations
       set deleted_at = new.deleted_at
     where program_id = new.id
       and deleted_at is null;
  end if;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Trigger
-- -----------------------------------------------------------------------------
drop trigger if exists programs_cascade_soft_delete on public.programs;

create trigger programs_cascade_soft_delete
  after update of deleted_at on public.programs
  for each row
  execute function public.cascade_program_soft_delete();

-- -----------------------------------------------------------------------------
-- 3. Backfill existing orphans
-- -----------------------------------------------------------------------------
-- Find every active affiliation whose program is already deleted, and
-- soft-delete the affiliation, copying the program's deleted_at value so
-- the timestamps stay consistent.
update public.program_affiliations pa
   set deleted_at = p.deleted_at
  from public.programs p
 where pa.program_id = p.id
   and pa.deleted_at is null
   and p.deleted_at is not null;

commit;

-- -----------------------------------------------------------------------------
-- After running:
--   1. Tell PostgREST to reload its schema cache:
--        notify pgrst, 'reload schema';
--   2. Verify the backfill worked:
--        select count(*) from public.program_affiliations pa
--         join public.programs p on p.id = pa.program_id
--         where pa.deleted_at is null and p.deleted_at is not null;
--      Should return 0.
--   3. Test the cascade:
--        - Pick a non-critical program.
--        - Soft-delete it via the app or `select public.soft_delete('programs', '<uuid>')`.
--        - Verify any of its program_affiliations rows now have deleted_at set.
--        - Restore the program if you only deleted it for testing
--          (NOTE: affiliations will NOT auto-restore — un-delete each manually
--          if needed).
-- -----------------------------------------------------------------------------

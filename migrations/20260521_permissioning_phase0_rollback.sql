-- =============================================================================
-- 20260521_permissioning_phase0_rollback.sql
-- Rollback for: 20260521_permissioning_phase0.sql
-- =============================================================================
-- Reverses Phase 0 completely, returning the database to its pre-migration
-- state. Safe to run if Phase 0 needs to be undone.
--
-- ORDER MATTERS:
--   1. Restore is_current_user_admin() to its ORIGINAL body FIRST. It must
--      never not-exist, because 6 RLS policies depend on it (invitations,
--      profile_access_tokens). We REPLACE it in place — never DROP it.
--   2. Drop the two NEW functions (nothing depends on them yet — Phase 0
--      added no policies that use them).
--   3. Restore the active_contacts view to its ORIGINAL column list
--      (WITHOUT internal_role). Must come BEFORE dropping the column,
--      because the current view references it.
--   4. Drop the internal_role column.
--   5. Drop the enum type (must come AFTER the column that uses it).
--
-- is_admin was never modified by Phase 0, so there is nothing to restore there.
--
-- RUN AS A WHOLE — select-all before running in the Supabase SQL editor.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Restore is_current_user_admin() to its ORIGINAL definition.
-- ---------------------------------------------------------------------------
-- Exact body from before Phase 0 — checks is_admin = TRUE, reads the
-- active_contacts view. Return type unchanged, so CREATE OR REPLACE works
-- without a DROP. Doing this FIRST means the 6 dependent policies are never
-- left pointing at a missing function.
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
  RETURNS boolean
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.active_contacts c
    WHERE c.auth_user_id = auth.uid()
      AND c.is_admin = TRUE
  );
$function$;

-- ---------------------------------------------------------------------------
-- 2. Drop the two functions Phase 0 added.
-- ---------------------------------------------------------------------------
-- Safe: Phase 0 added no RLS policies, so nothing references these yet.
DROP FUNCTION IF EXISTS public.is_current_user_super_admin();
DROP FUNCTION IF EXISTS public.is_current_user_internal();

-- ---------------------------------------------------------------------------
-- 3. Restore the active_contacts view to its ORIGINAL column list.
-- ---------------------------------------------------------------------------
-- Same as the pre-Phase-0 definition — explicit column list, deleted_at
-- IS NULL, WITHOUT internal_role.
--
-- This is a DROP + CREATE, not CREATE OR REPLACE. CREATE OR REPLACE VIEW can
-- only ADD columns at the end — it CANNOT remove a column ("cannot drop
-- columns from view"). Removing internal_role requires dropping the view and
-- recreating it. DROP VIEW is safe here: nothing else depends on
-- active_contacts except the role-check functions, and at this point in the
-- rollback the new ones are already dropped (step 2) and is_current_user_admin
-- was just redefined (step 1) — functions hold no hard dependency that blocks
-- a view drop (SQL function bodies are re-resolved at call time).
--
-- Must run before step 4: the column drop needs the view to no longer
-- reference internal_role.
DROP VIEW IF EXISTS public.active_contacts;

CREATE VIEW public.active_contacts AS
  SELECT id,
         auth_user_id,
         first_name,
         last_name,
         pronouns,
         email,
         secondary_email,
         phone,
         profile_photo_url,
         notes,
         standing,
         has_board_history,
         is_admin,
         current_city,
         current_state,
         ai_summary,
         ai_summary_generated_at,
         created_at,
         updated_at,
         deleted_at
    FROM public.contacts
   WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- 4. Drop the internal_role column.
-- ---------------------------------------------------------------------------
-- The backfilled values are discarded with the column. is_admin still holds
-- the original admin flag, so no access information is lost.
ALTER TABLE public.contacts
  DROP COLUMN IF EXISTS internal_role;

-- ---------------------------------------------------------------------------
-- 5. Drop the enum type.
-- ---------------------------------------------------------------------------
-- Must come after the column drop (the column's type is this enum).
DROP TYPE IF EXISTS public.internal_role;

COMMIT;

-- =============================================================================
-- VERIFICATION — after rollback:
--   - SELECT pg_get_functiondef(oid) FROM pg_proc
--     WHERE proname = 'is_current_user_admin';
--     -> should show the is_admin = TRUE body again.
--   - is_current_user_super_admin / _internal -> should NOT exist.
--   - SELECT pg_get_viewdef('public.active_contacts', true);
--     -> should NOT list internal_role.
--   - contacts.internal_role column -> should NOT exist.
--   - internal_role type -> should NOT exist.
--   - Admin-gated pages still work (restored function + untouched is_admin
--     column mean access is exactly as pre-Phase-0).
-- =============================================================================

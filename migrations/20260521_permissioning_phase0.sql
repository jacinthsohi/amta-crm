-- =============================================================================
-- 20260521_permissioning_phase0.sql
-- Permissioning model — Phase 0: additive foundation (ZERO behavior change)
-- =============================================================================
-- Design doc: docs/permissioning-model.md  (§5 schema, §6 Phase 0)
--
-- This migration is PURELY ADDITIVE. It introduces the role enum, the
-- internal_role column, refreshes the active_contacts view to expose that
-- column, adds the new role-check functions, and redefines
-- is_current_user_admin() to the nested form. It changes NO RLS policy.
-- After it runs, the system must behave identically — see the verification
-- block at the end.
--
-- Why "zero behavior change" holds:
--   - is_current_user_admin() is redefined to mean "at least Admin" — true
--     for internal_role IN ('admin','super_admin').
--   - The backfill sets the one current admin (is_admin = TRUE) to
--     'super_admin', which IS "at least Admin".
--   - Therefore every existing policy that calls is_current_user_admin()
--     (verified May 21: 6 policies across invitations + profile_access_tokens)
--     evaluates exactly as before.
--
-- WHY THE VIEW REFRESH (step 3) — learned the hard way:
--   active_contacts is a view with an EXPLICIT column list (not SELECT *).
--   Adding internal_role to the contacts base table does NOT make it appear
--   in the view. The role-check functions read active_contacts (mirroring
--   the original is_current_user_admin()), so the view MUST be refreshed to
--   include internal_role or the functions fail with "column does not
--   exist". Step 3 re-creates the view with the same column list plus the
--   new column.
--
-- Verified before writing this migration (May 21, prod):
--   - 6 RLS policies reference is_current_user_admin(): invitations (3),
--     profile_access_tokens (3). None on contacts.
--   - Exactly 1 contact has is_admin = TRUE (Jacinth Sohi), with a non-NULL
--     auth_user_id. The backfill is a single row.
--   - active_contacts view definition captured (explicit column list,
--     WHERE deleted_at IS NULL, no joins).
--
-- is_admin is NOT dropped here — see docs §5.3. It is retired in a later
-- phase once nothing reads it.
--
-- RUN THIS AS A WHOLE. In the Supabase SQL editor, select-all before running
-- so every statement executes, not just the one under the cursor.
-- Rollback: 20260521_permissioning_phase0_rollback.sql
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. The role enum
-- ---------------------------------------------------------------------------
-- Three values. "External" is deliberately NOT here — external users have no
-- auth account and never carry an internal_role (see docs §5.1).
CREATE TYPE public.internal_role AS ENUM (
  'super_admin',
  'admin',
  'internal_user'
);

-- ---------------------------------------------------------------------------
-- 2. The column on contacts
-- ---------------------------------------------------------------------------
-- Nullable on purpose: NULL = "not an internal user" (the majority of
-- contacts). Only contacts who actually log in get a role.
ALTER TABLE public.contacts
  ADD COLUMN internal_role public.internal_role;

COMMENT ON COLUMN public.contacts.internal_role IS
  'Internal access role (permissioning model, Phase 0, 2026-05-21). '
  'NULL = not an internal user. See docs/permissioning-model.md. '
  'Coexists with is_admin until is_admin is retired in a later phase.';

-- ---------------------------------------------------------------------------
-- 3. Refresh the active_contacts view to expose internal_role
-- ---------------------------------------------------------------------------
-- Same definition as before (explicit column list, deleted_at IS NULL),
-- with internal_role added. Placed AFTER the column is added (step 2) and
-- BEFORE the functions (step 4), which depend on the view having the column.
--
-- internal_role is APPENDED at the END of the column list — NOT inserted in
-- the middle. CREATE OR REPLACE VIEW is positional: it can only add columns
-- after the last existing one. Inserting mid-list makes Postgres read it as
-- a column rename and fails (42P16). Column order in the view is cosmetic;
-- the functions reference internal_role by name, so end-of-list is fine.
CREATE OR REPLACE VIEW public.active_contacts AS
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
         deleted_at,
         internal_role
    FROM public.contacts
   WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- 4. Backfill from is_admin
-- ---------------------------------------------------------------------------
-- Current admins become Super Admins (docs §6 Phase 0). Uses WHERE is_admin
-- so it stays correct even if an admin was added since the May 21 check.
--
-- deleted_at IS NULL: only ACTIVE contacts are promoted. The contacts base
-- table includes soft-deleted rows; a soft-deleted ex-admin must NOT receive
-- a role. (The role-check functions read active_contacts, which already
-- filters deleted rows — but writing a role onto a deleted record is still
-- wrong, so we exclude them here at the source.)
UPDATE public.contacts
   SET internal_role = 'super_admin'
 WHERE is_admin = TRUE
   AND deleted_at IS NULL
   AND internal_role IS NULL;  -- idempotent: don't clobber if re-run

-- Assertion: we verified exactly 1 admin row on May 21. If the backfill
-- produced zero super_admins, reality drifted from what was verified — stop
-- and re-check before trusting the rest of the migration.
DO $$
DECLARE
  super_count integer;
BEGIN
  SELECT count(*) INTO super_count
  FROM public.contacts
  WHERE internal_role = 'super_admin';

  IF super_count = 0 THEN
    RAISE EXCEPTION
      'Phase 0 backfill produced 0 super_admins. Expected at least 1 '
      '(verified 1 on 2026-05-21). Aborting — investigate before retrying.';
  END IF;

  RAISE NOTICE 'Phase 0 backfill: % super_admin row(s).', super_count;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Role-check functions
-- ---------------------------------------------------------------------------
-- All three mirror the EXISTING is_current_user_admin() exactly:
--   LANGUAGE sql, STABLE SECURITY DEFINER, SET search_path = 'public',
--   and reading from the active_contacts VIEW (refreshed in step 3) so
--   soft-deleted users are excluded — same as the original function.

-- 5a. Narrowest: only Super Admins. Used where the Super/Admin distinction
--     matters (role management — docs §7).
CREATE OR REPLACE FUNCTION public.is_current_user_super_admin()
  RETURNS boolean
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.active_contacts c
    WHERE c.auth_user_id = auth.uid()
      AND c.internal_role = 'super_admin'
  );
$function$;

-- 5b. "At least an internal user" — any of the three roles (non-NULL).
CREATE OR REPLACE FUNCTION public.is_current_user_internal()
  RETURNS boolean
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.active_contacts c
    WHERE c.auth_user_id = auth.uid()
      AND c.internal_role IS NOT NULL
  );
$function$;

-- 5c. REDEFINE is_current_user_admin() to the nested form: "at least Admin".
--     Previously checked is_admin = TRUE. Now checks
--     internal_role IN ('admin','super_admin'). Return type is unchanged
--     (boolean), so CREATE OR REPLACE is allowed — no DROP needed.
--     This is what keeps every existing policy working: a Super Admin is
--     still "an admin" for all admin-gated tables.
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
      AND c.internal_role IN ('admin', 'super_admin')
  );
$function$;

COMMIT;

-- =============================================================================
-- VERIFICATION — run these AFTER the migration commits. Each should confirm
-- zero behavior change. (These are SELECTs; safe to run anytime.)
-- =============================================================================
--
-- a. The one admin is now a super_admin, and is_admin is untouched:
--      SELECT first_name, last_name, is_admin, internal_role
--      FROM public.contacts WHERE is_admin = TRUE OR internal_role IS NOT NULL;
--    Expect: Jacinth Sohi, is_admin = true, internal_role = 'super_admin'.
--
-- b. The view now exposes internal_role:
--      SELECT internal_role FROM public.active_contacts LIMIT 1;
--    Expect: runs without error (the column resolves).
--
-- c. The new functions exist and the old one still returns boolean:
--      SELECT proname FROM pg_proc
--      WHERE proname IN ('is_current_user_admin','is_current_user_super_admin',
--                        'is_current_user_internal');
--    Expect: all three rows.
--
-- d. ZERO behavior change — confirm in the app, NOT just SQL: signed in as
--    an admin, the admin-gated pages (invitations) still work; the 6 policies
--    on invitations + profile_access_tokens still admit the admin. There are
--    no non-admin internal users yet, so nothing else changes.
-- =============================================================================

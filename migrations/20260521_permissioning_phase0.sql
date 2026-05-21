-- =============================================================================
-- 20260521_permissioning_phase0.sql
-- Permissioning model — Phase 0: additive foundation (ZERO behavior change)
-- =============================================================================
-- Design doc: docs/permissioning-model.md  (§5 schema, §6 Phase 0)
--
-- This migration is PURELY ADDITIVE. It introduces the role enum, the
-- internal_role column, the new role-check functions, and redefines
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
-- Verified before writing this migration (May 21, prod):
--   - 6 RLS policies reference is_current_user_admin(): invitations (3),
--     profile_access_tokens (3). None on contacts.
--   - Exactly 1 contact has is_admin = TRUE (Jacinth Sohi), and that row
--     has a non-NULL auth_user_id. The backfill is a single row.
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
-- 3. Backfill from is_admin
-- ---------------------------------------------------------------------------
-- Current admins become Super Admins (docs §6 Phase 0). Uses WHERE is_admin
-- so it stays correct even if an admin was added since the May 21 check.
UPDATE public.contacts
   SET internal_role = 'super_admin'
 WHERE is_admin = TRUE
   AND internal_role IS NULL;  -- idempotent: don't clobber if re-run

-- Assertion: we verified exactly 1 admin row on May 21. If the count differs,
-- reality drifted from what was verified — stop and re-check before trusting
-- the rest of the migration. (Does not fail on MORE than 1; only on ZERO,
-- which would mean the backfill matched nothing and something is wrong.)
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
-- 4. Role-check functions
-- ---------------------------------------------------------------------------
-- All three mirror the EXISTING is_current_user_admin() exactly:
--   LANGUAGE sql, STABLE SECURITY DEFINER, SET search_path = 'public',
--   and reading from the active_contacts VIEW (not the contacts base table)
--   so soft-deleted users are excluded — same as the original function.

-- 4a. Narrowest: only Super Admins. Used where the Super/Admin distinction
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

-- 4b. "At least an internal user" — any of the three roles (non-NULL).
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

-- 4c. REDEFINE is_current_user_admin() to the nested form: "at least Admin".
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
-- b. The new functions exist and the old one still returns boolean:
--      SELECT proname FROM pg_proc
--      WHERE proname IN ('is_current_user_admin','is_current_user_super_admin',
--                        'is_current_user_internal');
--    Expect: all three rows.
--
-- c. ZERO behavior change — confirm in the app, NOT just SQL: signed in as
--    an admin, the admin-gated pages (invitations) still work; the 6 policies
--    on invitations + profile_access_tokens still admit the admin. There are
--    no non-admin internal users yet, so nothing else changes.
-- =============================================================================

-- =============================================================================
-- 20260622_permissioning_phase1_accept_invitation_rollback.sql
-- Rollback for Permissioning Phase 1.
-- =============================================================================
-- Drops the accept_invitation RPC. NOTE: rolling back the DB is only safe if
-- the FRONTEND has also been reverted to the direct-write flow
-- (AcceptInvitationPage / FinishInvitationPage). If the deployed frontend
-- still calls accept_invitation(), dropping it breaks onboarding. Revert the
-- app first, then run this.
--
-- Phase 1 changed no RLS policy and altered no table, so there is nothing else
-- to undo. contacts policies were never touched.
-- =============================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.accept_invitation(text);

COMMIT;

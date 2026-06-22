-- =============================================================================
-- 20260622_permissioning_phase1_accept_invitation.sql
-- Permissioning model — Phase 1: accept-invitation → SECURITY DEFINER RPC
-- =============================================================================
-- Design doc: docs/permissioning-model.md  (§6 Phase 1)
--
-- WHY THIS PHASE EXISTS (the landmine):
--   The accept-invitation flow (AcceptInvitationPage / FinishInvitationPage)
--   currently writes contacts.auth_user_id DIRECTLY from the browser. That
--   write succeeds ONLY because the contacts UPDATE policy is `true`. Phase 2
--   will tighten that policy — at which point the direct write breaks, and
--   new-user onboarding breaks SILENTLY. This phase moves the privileged write
--   behind a SECURITY DEFINER RPC so it no longer depends on the open policy.
--   Phase 1 MUST ship and be verified before Phase 2 touches contacts policies.
--
-- WHAT THIS RPC DOES (verified against live schema, 2026-06-22):
--   accept_invitation(p_token) validates the invitation and, under definer
--   privileges, performs the full acceptance atomically:
--     1. links the calling auth user to the invitation's contact, and
--     2. stamps invitations.accepted_at.
--
-- A LATENT BUG THIS ALSO FIXES:
--   invitations RLS is admin-only on SELECT/INSERT/UPDATE (verified live).
--   The old flow's `accepted_at` stamp ran as a freshly-signed-up NON-admin,
--   so its UPDATE matched 0 rows under RLS and returned success WITHOUT ever
--   setting accepted_at. Result today: invitation links are never marked used
--   and stay live until they expire. Doing the stamp inside this definer RPC
--   finally makes it stick. (The old SELECT worked only because it went
--   through the active_invitations VIEW, which bypasses RLS.)
--   Confirmed in prod 2026-06-22: of 6 live invitations, 2 have a linked
--   contact (auth_user_id set) yet accepted_at IS NULL — real victims of this
--   silent no-op. (The 2 that ARE stamped were accepted by an admin, whose
--   UPDATE passes the admin-only invitations policy.)
--
-- SECURITY MODEL (mirrors Profile V1 conventions):
--   - SECURITY DEFINER, search_path pinned to 'public'.
--   - Identity is taken from auth.uid() / auth.jwt() — NOT a caller-supplied
--     user id — so a caller can only ever link THEMSELVES to a contact.
--   - The DB enforces the email match (auth.jwt() email == invitation email),
--     so "only the invited person can claim this" is a database guarantee,
--     not just a client-side check.
--   - REVOKE ALL FROM PUBLIC + GRANT EXECUTE TO authenticated. The caller is
--     authenticated by this point (password sign-up or Google OAuth has
--     completed); they simply are not yet linked to a contact row.
--   - plpgsql + VOLATILE (it mutates) — deliberately NOT the STABLE sql shape
--     of the read-only role-check functions.
--
-- Phase 1 changes NO RLS policy. contacts stays `true`; this only ADDS a safe
-- path. Verifying the RPC works while contacts is still open is the whole point
-- (prove the risky thing in isolation before it becomes load-bearing).
--
-- RUN THIS AS A WHOLE. In the Supabase SQL editor, select-all before running.
-- Rollback: 20260622_permissioning_phase1_accept_invitation_rollback.sql
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- accept_invitation(p_token)
-- ---------------------------------------------------------------------------
-- Returns jsonb: { "status": "accepted" | "already_accepted", "contact_id": <uuid> }
-- Raises a clear exception (surfaced to the client by PostgREST) on every
-- failure case: not authenticated, unknown/deleted token, revoked, expired,
-- email mismatch, already used by someone else, or link conflict.
CREATE OR REPLACE FUNCTION public.accept_invitation(p_token text)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_uid          uuid := auth.uid();
  v_email        text := lower(auth.jwt() ->> 'email');
  v_invitation   public.invitations;
BEGIN
  -- Caller must be authenticated. Both onboarding flows have completed sign-in
  -- (password sign-up or Google OAuth) before reaching this call.
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to accept an invitation.'
      USING ERRCODE = '28000';
  END IF;

  -- Look up the invitation by its secret token. Read the base table (not the
  -- view) because we are about to mutate; filter soft-deleted explicitly.
  SELECT * INTO v_invitation
  FROM public.invitations
  WHERE token = p_token
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'We could not find that invitation. It may have been revoked.'
      USING ERRCODE = 'P0002';
  END IF;

  -- Revoked invitations are dead. (revoked_at exists on the table; the old
  -- client checks never looked at it — the RPC does.)
  IF v_invitation.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'This invitation has been revoked. Ask an admin for a new one.'
      USING ERRCODE = 'P0001';
  END IF;

  -- Expiry.
  IF v_invitation.expires_at IS NOT NULL AND v_invitation.expires_at < now() THEN
    RAISE EXCEPTION 'This invitation has expired. Ask an admin for a new one.'
      USING ERRCODE = 'P0001';
  END IF;

  -- The authenticated caller's email MUST match the invited address. This is
  -- the database-level guarantee that only the invited person can claim it.
  IF v_email IS NULL OR v_email <> lower(v_invitation.email) THEN
    RAISE EXCEPTION
      'Your account email does not match this invitation. Sign in with the invited email address.'
      USING ERRCODE = 'P0001';
  END IF;

  -- Idempotency: if already accepted by THIS user, treat as success (e.g. a
  -- double-submit or a refresh of the finish page). If accepted by someone
  -- else, refuse.
  IF v_invitation.accepted_at IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.contacts
      WHERE id = v_invitation.contact_id
        AND auth_user_id = v_uid
    ) THEN
      RETURN jsonb_build_object('status', 'already_accepted',
                                'contact_id', v_invitation.contact_id);
    END IF;
    RAISE EXCEPTION 'This invitation has already been used. Please sign in instead.'
      USING ERRCODE = 'P0001';
  END IF;

  -- Link the auth user to the contact. Guard against linking a soft-deleted
  -- contact, and against stealing a contact already linked to a DIFFERENT user
  -- (allow re-linking to the same user for idempotency).
  UPDATE public.contacts
     SET auth_user_id = v_uid
   WHERE id = v_invitation.contact_id
     AND deleted_at IS NULL
     AND (auth_user_id IS NULL OR auth_user_id = v_uid);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'We could not link your account to this contact. Contact an admin.'
      USING ERRCODE = 'P0001';
  END IF;

  -- Stamp acceptance. This is the write that silently no-op'd under the old
  -- non-admin flow; here it runs under definer privileges and sticks.
  UPDATE public.invitations
     SET accepted_at = now()
   WHERE id = v_invitation.id;

  RETURN jsonb_build_object('status', 'accepted',
                            'contact_id', v_invitation.contact_id);
END;
$function$;

COMMENT ON FUNCTION public.accept_invitation(text) IS
  'Permissioning Phase 1 (2026-06-22). Token-gated SECURITY DEFINER RPC that '
  'links the calling auth user to an invitation''s contact and stamps '
  'accepted_at, atomically. Replaces the browser''s direct contacts/invitations '
  'writes so onboarding survives Phase 2 contacts-policy tightening. '
  'See docs/permissioning-model.md §6.';

-- Least privilege: only authenticated callers may execute it.
REVOKE ALL ON FUNCTION public.accept_invitation(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_invitation(text) TO authenticated;

COMMIT;

-- =============================================================================
-- VERIFICATION — run AFTER commit (and see the isolated probe used during the
-- 2026-06-22 build session, which exercised the happy path + every failure
-- branch in a self-rolling-back DO block).
-- =============================================================================
-- a. Function exists with the expected grants:
--      SELECT proname, proacl FROM pg_proc WHERE proname = 'accept_invitation';
--    Expect: one row; ACL grants EXECUTE to authenticated, not to PUBLIC/anon.
--
-- b. End-to-end in the app (the real test): accept a fresh invitation via BOTH
--    the password path and the Google path. Confirm the user lands on the
--    dashboard AND that invitations.accepted_at is now set (it was silently
--    NULL before this phase):
--      SELECT email, accepted_at FROM public.invitations
--      WHERE token = '<the test token>';
-- =============================================================================

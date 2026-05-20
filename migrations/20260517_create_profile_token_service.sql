-- =============================================================================
-- Profile V1 / Email automation: service-callable token mint
-- =============================================================================
-- Adds create_profile_token_service(), a SECURITY DEFINER function that
-- mints a profile magic-link token WITHOUT checking is_current_user_admin().
--
-- WHY NO AUTH CHECK — READ BEFORE EDITING:
--   The existing create_profile_token() gates on is_current_user_admin(),
--   which reads auth.uid(). That works when an authenticated admin calls it
--   from the browser. It does NOT work when a Vercel serverless function
--   calls it using the Supabase SERVICE ROLE — under the service role,
--   auth.uid() is NULL, so the admin check fails and the call is rejected.
--
--   The /api/send-magic-link serverless function needs to mint tokens. That
--   function does its OWN admin verification (it checks the calling user's
--   JWT and confirms contacts.is_admin) before doing any privileged work.
--   So by the time it would call this function, the caller is already
--   proven to be an admin.
--
--   Therefore this function intentionally has NO is_current_user_admin()
--   gate. Its safety depends ENTIRELY on the REVOKE below: it is callable
--   ONLY by the service role (which never reaches end users). 
--
--   *** DO NOT GRANT EXECUTE ON THIS FUNCTION TO anon OR authenticated. ***
--   Doing so would let any logged-in user — or any unauthenticated visitor —
--   mint a 30-day edit token for ANY contact. The REVOKE is load-bearing
--   security, not boilerplate.
--
-- This migration also refactors create_profile_token() to share a single
-- private helper (_mint_profile_token) so the actual revoke-then-insert
-- logic lives in exactly one place. The two public-facing functions differ
-- ONLY in their auth gate.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- _mint_profile_token(p_contact_id uuid) -> text   [PRIVATE HELPER]
-- -----------------------------------------------------------------------------
-- The actual token logic: revoke any currently-valid tokens for the contact,
-- then issue a fresh one. No auth check of any kind — callers are responsible
-- for authorization. Underscore prefix signals "internal, do not call
-- directly." REVOKE'd from everyone; only other SECURITY DEFINER functions
-- in this schema (which run as the definer) can invoke it.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._mint_profile_token(p_contact_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
BEGIN
  -- Revoke any currently-valid tokens for this contact. One valid token at
  -- a time keeps the mental model clean: the latest link is the live link.
  UPDATE public.profile_access_tokens
  SET revoked_at = now()
  WHERE contact_id = p_contact_id
    AND revoked_at IS NULL
    AND expires_at > now();

  -- Issue a new UUID token. expires_at defaults to now() + 30 days on the
  -- table; we let that default fire.
  INSERT INTO public.profile_access_tokens (contact_id, token)
  VALUES (p_contact_id, gen_random_uuid()::text)
  RETURNING token INTO v_token;

  RETURN v_token;
END;
$$;

-- Private helper: callable by nobody directly. SECURITY DEFINER functions
-- below invoke it as the definer (postgres), which retains execute rights.
REVOKE ALL ON FUNCTION public._mint_profile_token(uuid) FROM PUBLIC;

-- -----------------------------------------------------------------------------
-- create_profile_token(p_contact_id uuid) -> text   [ADMIN, browser-facing]
-- -----------------------------------------------------------------------------
-- Unchanged behavior from Chunk 5: admin-gated. Now delegates the actual
-- token work to _mint_profile_token so the logic isn't duplicated.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_profile_token(p_contact_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'Only admins can create profile tokens';
  END IF;

  RETURN public._mint_profile_token(p_contact_id);
END;
$$;

REVOKE ALL ON FUNCTION public.create_profile_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_profile_token(uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- create_profile_token_service(p_contact_id uuid) -> text   [SERVICE ROLE ONLY]
-- -----------------------------------------------------------------------------
-- No auth gate (see the big comment at the top of this file). For use by
-- trusted server-side callers (Vercel serverless functions using the
-- Supabase service role) that have ALREADY verified the requester is an
-- admin. REVOKE'd from anon + authenticated so end users can never call it.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_profile_token_service(p_contact_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Intentionally NO is_current_user_admin() check. See file header.
  -- Authorization is the caller's responsibility; safety comes from the
  -- REVOKE below restricting this to the service role.
  RETURN public._mint_profile_token(p_contact_id);
END;
$$;

-- Load-bearing security: service role only. Never grant to anon/authenticated.
REVOKE ALL ON FUNCTION public.create_profile_token_service(uuid) FROM PUBLIC;

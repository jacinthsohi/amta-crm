-- =============================================================================
-- Profile V1 Chunk 5: revoke-then-issue for profile tokens
-- =============================================================================
-- Adds revoke_profile_token() and updates create_profile_token() to revoke
-- all active tokens for the contact before issuing a new one.
--
-- Why: a contact should have at most one valid magic link at a time. If an
-- admin regenerates a link (e.g. because the contact lost the email), the
-- old one should stop working immediately. Without this, a stolen token
-- would remain valid for up to 30 days even after a new one was issued.
--
-- Both functions are admin-only (SECURITY DEFINER + is_current_user_admin
-- check). REVOKE PUBLIC + GRANT EXECUTE to authenticated only.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- revoke_profile_token(p_contact_id uuid) -> integer (count revoked)
-- -----------------------------------------------------------------------------
-- Marks all currently-valid tokens for a contact as revoked. Returns the
-- count of tokens that were revoked (0 if none were active). Idempotent —
-- calling it on a contact with no active tokens is a no-op.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.revoke_profile_token(p_contact_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'Only admins can revoke profile tokens';
  END IF;

  UPDATE public.profile_access_tokens
  SET revoked_at = now()
  WHERE contact_id = p_contact_id
    AND revoked_at IS NULL
    AND expires_at > now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_profile_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_profile_token(uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- create_profile_token(p_contact_id uuid) -> text
-- -----------------------------------------------------------------------------
-- Replaces the existing create_profile_token. Now revokes any existing
-- active tokens for the contact before issuing a fresh one. Returns the
-- new token string.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_profile_token(p_contact_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
BEGIN
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'Only admins can create profile tokens';
  END IF;

  -- Revoke any currently-valid tokens for this contact first. One valid
  -- token at a time keeps the mental model clean: the latest link is the
  -- live link.
  PERFORM public.revoke_profile_token(p_contact_id);

  -- Issue a new UUID token. expires_at defaults to now() + 30 days on the
  -- table; we let that default fire.
  INSERT INTO public.profile_access_tokens (contact_id, token)
  VALUES (p_contact_id, gen_random_uuid()::text)
  RETURNING token INTO v_token;

  RETURN v_token;
END;
$$;

REVOKE ALL ON FUNCTION public.create_profile_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_profile_token(uuid) TO authenticated;

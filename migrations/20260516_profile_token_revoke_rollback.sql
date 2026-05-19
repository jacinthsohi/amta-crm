-- =============================================================================
-- Rollback for 20260516_profile_token_revoke.sql
-- =============================================================================
-- Restores create_profile_token to its pre-Chunk-5 behavior (no automatic
-- revocation of prior tokens) and drops revoke_profile_token entirely.
-- =============================================================================

DROP FUNCTION IF EXISTS public.revoke_profile_token(uuid);

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

  INSERT INTO public.profile_access_tokens (contact_id, token)
  VALUES (p_contact_id, gen_random_uuid()::text)
  RETURNING token INTO v_token;

  RETURN v_token;
END;
$$;

REVOKE ALL ON FUNCTION public.create_profile_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_profile_token(uuid) TO authenticated;

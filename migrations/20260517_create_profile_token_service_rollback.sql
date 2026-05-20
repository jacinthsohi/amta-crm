-- =============================================================================
-- Rollback for 20260517_create_profile_token_service.sql
-- =============================================================================
-- Drops the service variant and the private helper, and restores
-- create_profile_token() to its self-contained Chunk 5 form (inlining the
-- token logic again rather than delegating to _mint_profile_token).
--
-- Order matters: create_profile_token must be restored to its inline form
-- BEFORE _mint_profile_token is dropped, otherwise there's a brief window
-- where create_profile_token references a function that no longer exists.
-- =============================================================================

-- 1. Restore create_profile_token to its self-contained Chunk 5 form.
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

  UPDATE public.profile_access_tokens
  SET revoked_at = now()
  WHERE contact_id = p_contact_id
    AND revoked_at IS NULL
    AND expires_at > now();

  INSERT INTO public.profile_access_tokens (contact_id, token)
  VALUES (p_contact_id, gen_random_uuid()::text)
  RETURNING token INTO v_token;

  RETURN v_token;
END;
$$;

REVOKE ALL ON FUNCTION public.create_profile_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_profile_token(uuid) TO authenticated;

-- 2. Now safe to drop the service variant and the private helper.
DROP FUNCTION IF EXISTS public.create_profile_token_service(uuid);
DROP FUNCTION IF EXISTS public._mint_profile_token(uuid);

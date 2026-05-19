-- =============================================================================
-- Rollback for 20260516_profile_affiliations.sql
-- =============================================================================
-- Drops the four new public RPCs and restores get_profile_by_token to its
-- pre-Chunk-4 behavior (no affiliations array).
-- =============================================================================

DROP FUNCTION IF EXISTS public.add_my_affiliation(text, uuid, text, integer, integer);
DROP FUNCTION IF EXISTS public.update_my_affiliation(text, uuid, uuid, text, integer, integer);
DROP FUNCTION IF EXISTS public.delete_my_affiliation(text, uuid);
DROP FUNCTION IF EXISTS public.search_programs_public(text);

-- Restore get_profile_by_token to the pre-Chunk-4 shape (no affiliations).
CREATE OR REPLACE FUNCTION public.get_profile_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact_id uuid;
  v_result jsonb;
BEGIN
  v_contact_id := public.verify_profile_token(p_token);
  IF v_contact_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'id', c.id,
    'first_name', c.first_name,
    'last_name', c.last_name,
    'pronouns', c.pronouns,
    'email', c.email,
    'secondary_email', c.secondary_email,
    'phone', c.phone,
    'current_city', c.current_city,
    'current_state', c.current_state,
    'profile_photo_url', c.profile_photo_url
  )
  INTO v_result
  FROM public.contacts c
  WHERE c.id = v_contact_id;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_profile_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profile_by_token(text) TO anon, authenticated;

-- =============================================================================
-- Profile V1 Chunk 4: self-service program affiliations
-- =============================================================================
-- Adds public RPCs that let a magic-link holder manage their own
-- program_affiliations rows. Same security model as update_my_profile:
-- SECURITY DEFINER, gated on a valid token (verify_profile_token),
-- REVOKE PUBLIC + GRANT EXECUTE to anon/authenticated.
--
-- Functions:
--   add_my_affiliation(p_token, p_program_id, p_affiliation_type,
--                      p_start_year, p_end_year) -> uuid (new affiliation id)
--   update_my_affiliation(p_token, p_affiliation_id, p_program_id,
--                         p_affiliation_type, p_start_year, p_end_year) -> uuid
--   delete_my_affiliation(p_token, p_affiliation_id) -> boolean (soft delete)
--   search_programs_public(p_query) -> json (combobox picker source)
--
-- Each mutation function:
--   1. Resolves the token to a contact_id (or raises if invalid).
--   2. Verifies the target affiliation belongs to that contact (for
--      update/delete) — defense against a leaked token + guessed
--      affiliation_id.
--   3. Performs the change and refreshes the token's expiry by 30 days
--      (same as update_my_profile — active editing keeps the link alive).
--
-- Notes:
--   - 'notes' column on program_affiliations is admin-only; public RPCs
--     never touch it.
--   - delete is SOFT (sets deleted_at) per the schema's existing pattern.
--     Admins can restore by clearing deleted_at.
--   - affiliation_type is constrained at the schema level to three values,
--     but we also validate in-RPC for friendlier error messages.
--   - search_programs_public filters soft-deleted programs but includes
--     'inactive' status (defunct schools still have alumni). It searches
--     name, short_name, city, and state.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- add_my_affiliation
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_my_affiliation(
  p_token text,
  p_program_id uuid,
  p_affiliation_type text,
  p_start_year integer,
  p_end_year integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact_id uuid;
  v_new_id uuid;
BEGIN
  v_contact_id := public.verify_profile_token(p_token);
  IF v_contact_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired token';
  END IF;

  IF p_affiliation_type NOT IN ('student_alumni', 'coach', 'advisor') THEN
    RAISE EXCEPTION 'Invalid affiliation_type: %', p_affiliation_type;
  END IF;

  IF p_start_year IS NULL THEN
    RAISE EXCEPTION 'start_year is required';
  END IF;

  INSERT INTO public.program_affiliations (
    contact_id, program_id, affiliation_type, start_year, end_year
  )
  VALUES (
    v_contact_id, p_program_id, p_affiliation_type, p_start_year, p_end_year
  )
  RETURNING id INTO v_new_id;

  UPDATE public.profile_access_tokens
  SET expires_at = now() + interval '30 days'
  WHERE token = p_token
    AND revoked_at IS NULL;

  RETURN v_new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.add_my_affiliation(text, uuid, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_my_affiliation(text, uuid, text, integer, integer) TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- update_my_affiliation
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_my_affiliation(
  p_token text,
  p_affiliation_id uuid,
  p_program_id uuid,
  p_affiliation_type text,
  p_start_year integer,
  p_end_year integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact_id uuid;
  v_owner_id uuid;
BEGIN
  v_contact_id := public.verify_profile_token(p_token);
  IF v_contact_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired token';
  END IF;

  IF p_affiliation_type NOT IN ('student_alumni', 'coach', 'advisor') THEN
    RAISE EXCEPTION 'Invalid affiliation_type: %', p_affiliation_type;
  END IF;

  -- Ownership check: only allow updating affiliations that belong to the
  -- token holder AND that haven't been soft-deleted. Prevents a leaked
  -- token + guessed UUID from clobbering another contact's data, and
  -- also prevents "undeleting via update".
  SELECT contact_id INTO v_owner_id
  FROM public.program_affiliations
  WHERE id = p_affiliation_id
    AND deleted_at IS NULL;

  IF v_owner_id IS NULL OR v_owner_id <> v_contact_id THEN
    RAISE EXCEPTION 'Affiliation not found or not owned by token holder';
  END IF;

  UPDATE public.program_affiliations
  SET program_id = p_program_id,
      affiliation_type = p_affiliation_type,
      start_year = p_start_year,
      end_year = p_end_year
  WHERE id = p_affiliation_id;

  UPDATE public.profile_access_tokens
  SET expires_at = now() + interval '30 days'
  WHERE token = p_token
    AND revoked_at IS NULL;

  RETURN p_affiliation_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_my_affiliation(text, uuid, uuid, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_my_affiliation(text, uuid, uuid, text, integer, integer) TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- delete_my_affiliation (SOFT DELETE)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_my_affiliation(
  p_token text,
  p_affiliation_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact_id uuid;
  v_owner_id uuid;
BEGIN
  v_contact_id := public.verify_profile_token(p_token);
  IF v_contact_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired token';
  END IF;

  SELECT contact_id INTO v_owner_id
  FROM public.program_affiliations
  WHERE id = p_affiliation_id
    AND deleted_at IS NULL;

  IF v_owner_id IS NULL OR v_owner_id <> v_contact_id THEN
    RAISE EXCEPTION 'Affiliation not found or not owned by token holder';
  END IF;

  UPDATE public.program_affiliations
  SET deleted_at = now()
  WHERE id = p_affiliation_id;

  UPDATE public.profile_access_tokens
  SET expires_at = now() + interval '30 days'
  WHERE token = p_token
    AND revoked_at IS NULL;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_affiliation(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_my_affiliation(text, uuid) TO anon, authenticated;

-- =============================================================================
-- Extend get_profile_by_token to include the contact's affiliations.
-- Filters deleted_at IS NULL on both affiliations and programs (a
-- soft-deleted program shouldn't surface its name to the user).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_profile_by_token(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact_id uuid;
  v_result json;
BEGIN
  v_contact_id := public.verify_profile_token(p_token);
  IF v_contact_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT json_build_object(
    'id', c.id,
    'first_name', c.first_name,
    'last_name', c.last_name,
    'pronouns', c.pronouns,
    'email', c.email,
    'secondary_email', c.secondary_email,
    'phone', c.phone,
    'current_city', c.current_city,
    'current_state', c.current_state,
    'profile_photo_url', c.profile_photo_url,
    'affiliations', COALESCE(
      (
        SELECT json_agg(
          json_build_object(
            'id', a.id,
            'program_id', a.program_id,
            'program_name', p.name,
            'program_short_name', p.short_name,
            'program_city', p.city,
            'program_state', p.state,
            'affiliation_type', a.affiliation_type,
            'start_year', a.start_year,
            'end_year', a.end_year
          )
          ORDER BY a.start_year DESC NULLS LAST, p.name ASC
        )
        FROM public.program_affiliations a
        LEFT JOIN public.programs p
          ON p.id = a.program_id AND p.deleted_at IS NULL
        WHERE a.contact_id = c.id
          AND a.deleted_at IS NULL
      ),
      '[]'::json
    )
  )
  INTO v_result
  FROM public.contacts c
  WHERE c.id = v_contact_id;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_profile_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profile_by_token(text) TO anon, authenticated;

-- =============================================================================
-- Public program search for the combobox. Searches name, short_name, city,
-- and state. Filters soft-deleted programs but INCLUDES status='inactive'
-- since defunct schools still have alumni who need to attest.
-- Capped at 20 results.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.search_programs_public(p_query text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_query text;
  v_result json;
BEGIN
  v_query := COALESCE(NULLIF(trim(p_query), ''), '');

  SELECT COALESCE(json_agg(
    json_build_object(
      'id', p.id,
      'name', p.name,
      'short_name', p.short_name,
      'city', p.city,
      'state', p.state,
      'status', p.status
    )
    ORDER BY p.name
  ), '[]'::json)
  INTO v_result
  FROM (
    SELECT id, name, short_name, city, state, status
    FROM public.programs
    WHERE
      deleted_at IS NULL
      AND (
        v_query = '' OR
        name ILIKE '%' || v_query || '%' OR
        short_name ILIKE '%' || v_query || '%' OR
        city ILIKE '%' || v_query || '%' OR
        state ILIKE '%' || v_query || '%'
      )
    ORDER BY name
    LIMIT 20
  ) p;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.search_programs_public(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_programs_public(text) TO anon, authenticated;

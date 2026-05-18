-- =============================================================================
-- 20260516_profile_access_tokens.sql
-- =============================================================================
-- Schema + security foundation for self-service profile editing via
-- magic links.
--
-- Background:
--   Phase 3 of the alumni journey: any contact (board members, alumni,
--   judges) should be able to update their own information without
--   needing a CRM account. Magic-link approach over account-based:
--   lower friction, no password, more inclusive for older users.
--
-- Design decisions:
--   - Tokens stored in a dedicated `profile_access_tokens` table,
--     keyed by contact_id. Distinct from `invitations` (which are
--     one-time, account-creating). Profile tokens are revisitable
--     edit handles.
--   - 30-day expiry. Long enough that an email can sit in an inbox
--     for a week, short enough that a leaked email forwarded
--     months later doesn't become a permanent vulnerability.
--   - Token refreshes on save: each successful update_my_profile
--     call extends the expiry. "Active editing keeps the session
--     alive."
--   - UUID format for tokens — 32+ random characters,
--     effectively unguessable.
--   - SECURITY DEFINER RPCs for both verification and updates,
--     so the function runs as postgres (full access) but the
--     function itself checks the token. The contacts table's
--     existing admin-only RLS stays in place; non-admins reach
--     contacts only through these RPCs.
--   - update_my_profile accepts a controlled whitelist of columns
--     ONLY. Users can't flip is_admin on themselves, can't change
--     primary email (which would compromise auth association),
--     can't change has_board_history, etc.
--
-- Out of scope (deferred):
--   - Token distribution (the email-sending flow). Captured as
--     Chunk 4. For now, tokens are created via admin SQL or RPC.
--   - Profile photo upload. Deferred to V2.
--   - Affiliations editing — V1 shows them read-only.
--
-- Note on naming:
--   I used `update_my_profile` rather than `update_profile_by_token`
--   because the user-facing semantic is "update MY profile" — the
--   token is just plumbing.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Table
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.profile_access_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS profile_access_tokens_token_idx
  ON public.profile_access_tokens(token);

CREATE INDEX IF NOT EXISTS profile_access_tokens_contact_id_idx
  ON public.profile_access_tokens(contact_id);

COMMENT ON TABLE public.profile_access_tokens IS
'Magic-link tokens that let a contact edit their own profile without a CRM account. One contact can have multiple tokens (each represents a fresh issuance, e.g. resend); only non-expired, non-revoked tokens are valid.';

COMMENT ON COLUMN public.profile_access_tokens.token IS
'Random UUID string the user receives via email link. Looked up by URL query param.';

COMMENT ON COLUMN public.profile_access_tokens.expires_at IS
'Absolute expiry. Default 30 days from issuance. Updates extend this on save.';

COMMENT ON COLUMN public.profile_access_tokens.revoked_at IS
'Admin can revoke a token (e.g. if leaked) by setting this. Revoked tokens are treated as invalid even if not yet expired.';

-- -----------------------------------------------------------------------------
-- RLS — admin-only direct access. Public flow uses the RPCs below.
-- -----------------------------------------------------------------------------

ALTER TABLE public.profile_access_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_select_profile_tokens"
  ON public.profile_access_tokens FOR SELECT
  USING (is_current_user_admin());

CREATE POLICY "admins_insert_profile_tokens"
  ON public.profile_access_tokens FOR INSERT
  WITH CHECK (is_current_user_admin());

CREATE POLICY "admins_update_profile_tokens"
  ON public.profile_access_tokens FOR UPDATE
  USING (is_current_user_admin());

-- -----------------------------------------------------------------------------
-- verify_profile_token — public RPC, returns contact_id if token is valid
-- -----------------------------------------------------------------------------
-- Returns NULL if token is unknown, expired, or revoked.
-- This is the read path for the /profile page: client validates the
-- token first, then loads the contact data via a second RPC.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.verify_profile_token(p_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact_id uuid;
BEGIN
  SELECT contact_id INTO v_contact_id
  FROM public.profile_access_tokens
  WHERE token = p_token
    AND expires_at > now()
    AND revoked_at IS NULL;

  IF v_contact_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Mark the token as recently used. Helps with analytics / debugging
  -- and tells us if a token is still in active circulation.
  UPDATE public.profile_access_tokens
  SET last_used_at = now()
  WHERE token = p_token;

  RETURN v_contact_id;
END;
$$;

COMMENT ON FUNCTION public.verify_profile_token IS
'Validates a profile access token and returns the associated contact_id (or NULL). Marks the token as used. Called by the public /profile page to authenticate the editing session.';

REVOKE ALL ON FUNCTION public.verify_profile_token FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_profile_token TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- get_profile_by_token — public RPC, returns the contact data
-- -----------------------------------------------------------------------------
-- Returns a JSON blob with only the fields the profile page needs.
-- Critically NOT exposing internal fields like notes, ai_summary,
-- is_admin, standing, has_board_history.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_profile_by_token(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact_id uuid;
  v_profile json;
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
    'profile_photo_url', c.profile_photo_url
  ) INTO v_profile
  FROM public.contacts c
  WHERE c.id = v_contact_id
    AND c.deleted_at IS NULL;

  RETURN v_profile;
END;
$$;

COMMENT ON FUNCTION public.get_profile_by_token IS
'Returns the editable profile fields for the contact associated with the given token, or NULL if the token is invalid. Intentionally exposes only public-safe fields (no notes, no ai_summary, no admin flags).';

REVOKE ALL ON FUNCTION public.get_profile_by_token FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profile_by_token TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- update_my_profile — public RPC, updates the contact's editable fields
-- -----------------------------------------------------------------------------
-- Whitelist of fields the user can edit:
--   - first_name, last_name, pronouns
--   - secondary_email (NOT primary; changing primary would risk
--     decoupling the user from how we reach them)
--   - phone
--   - current_city, current_state
--
-- Returns the updated profile JSON (same shape as get_profile_by_token).
-- Refreshes the token expiry by 30 days from now.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_my_profile(
  p_token text,
  p_first_name text,
  p_last_name text,
  p_pronouns text,
  p_secondary_email text,
  p_phone text,
  p_current_city text,
  p_current_state text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact_id uuid;
BEGIN
  -- Validate token
  v_contact_id := public.verify_profile_token(p_token);
  IF v_contact_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired profile token';
  END IF;

  -- Basic sanity: first/last name can't be wiped to empty
  IF p_first_name IS NULL OR trim(p_first_name) = '' THEN
    RAISE EXCEPTION 'First name is required';
  END IF;
  IF p_last_name IS NULL OR trim(p_last_name) = '' THEN
    RAISE EXCEPTION 'Last name is required';
  END IF;

  -- Update only the whitelisted columns
  UPDATE public.contacts
  SET
    first_name = trim(p_first_name),
    last_name = trim(p_last_name),
    pronouns = NULLIF(trim(coalesce(p_pronouns, '')), ''),
    secondary_email = NULLIF(trim(lower(coalesce(p_secondary_email, ''))), ''),
    phone = NULLIF(trim(coalesce(p_phone, '')), ''),
    current_city = NULLIF(trim(coalesce(p_current_city, '')), ''),
    current_state = NULLIF(coalesce(p_current_state, ''), ''),
    updated_at = now()
  WHERE id = v_contact_id;

  -- Refresh the token expiry so active editing keeps the session alive
  UPDATE public.profile_access_tokens
  SET expires_at = now() + interval '30 days'
  WHERE token = p_token;

  -- Return the updated profile for client-side cache update
  RETURN public.get_profile_by_token(p_token);
END;
$$;

COMMENT ON FUNCTION public.update_my_profile IS
'Updates editable profile fields for the contact associated with the given token. Whitelist-only: cannot modify primary email, admin flags, board history, or any internal-only fields. Refreshes token expiry by 30 days on successful update.';

REVOKE ALL ON FUNCTION public.update_my_profile FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_my_profile TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- create_profile_token — admin RPC, issues a fresh token for a contact
-- -----------------------------------------------------------------------------
-- Admin calls this to generate a magic link for a specific contact.
-- (The email-sending happens client-side or in a separate Edge Function.)
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

  INSERT INTO public.profile_access_tokens (contact_id)
  VALUES (p_contact_id)
  RETURNING token INTO v_token;

  RETURN v_token;
END;
$$;

COMMENT ON FUNCTION public.create_profile_token IS
'Admin-only: issues a fresh profile edit token for a specific contact. Returns the token, which the caller is expected to email to the contact.';

REVOKE ALL ON FUNCTION public.create_profile_token FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_profile_token TO authenticated;

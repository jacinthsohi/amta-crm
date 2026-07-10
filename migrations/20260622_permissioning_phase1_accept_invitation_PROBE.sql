-- =============================================================================
-- 20260622_permissioning_phase1_accept_invitation_PROBE.sql
-- *** NOT A MIGRATION — a throwaway isolation test. Self-rolling-back. ***
-- =============================================================================
-- Purpose: prove accept_invitation() works BEFORE it becomes load-bearing,
-- per the "test the risky thing in isolation first" discipline.
--
-- How it works: this whole script is ONE DO block. It creates the function
-- and throwaway test data, exercises the happy path plus every failure branch
-- by impersonating callers via request.jwt.claims, asserts each outcome, then
-- DELIBERATELY raises at the end so the entire transaction — function, test
-- users, test contacts, test invitations, all of it — ROLLS BACK. NOTHING
-- persists.
--
-- Real-world constraints the test data must respect (each one was found by
-- RUNNING this probe against prod on 2026-10-08 — the probe earned its keep):
--   * contacts.auth_user_id is a FOREIGN KEY to auth.users AND is UNIQUE, so
--     the probe mints two throwaway auth.users rows (only `id` is NOT NULL
--     there; the table has no triggers) inside the rolled-back transaction.
--   * contacts has a UNIQUE index on lower(email) (contacts_email_unique), so
--     every test contact gets its own distinct address.
--
-- HOW TO READ THE RESULT: it ALWAYS ends by raising an exception. Look at the
-- message:
--   * "PROBE PASS — all N checks green"  → success, safe to apply the real
--     migration (20260622_permissioning_phase1_accept_invitation.sql).
--   * "PROBE FAIL: <reason>"             → do NOT apply; tell Claude the reason.
-- Either way the DB is untouched afterward (verify: the function does not
-- exist, no Probe* contacts, no probe.* auth users).
--
-- The embedded function body MUST match the real migration. If you change one,
-- change the other.
-- =============================================================================

DO $probe$
DECLARE
  v_uid_a   uuid := gen_random_uuid();
  v_uid_b   uuid := gen_random_uuid();
  v_e       text;              -- the invitation email for the current check
  v_e_happy text := 'probe.happy.phase1@example.com';
  v_contact uuid;
  v_inv     uuid;
  v_res     jsonb;
  v_linked  uuid;
  v_acc     timestamptz;
  v_checks  int := 0;
BEGIN
  -- Throwaway auth users so the FK on contacts.auth_user_id is satisfiable.
  INSERT INTO auth.users (id, email) VALUES
    (v_uid_a, 'probe.a.phase1@example.com'),
    (v_uid_b, 'probe.b.phase1@example.com');

  -- Install the function under test (identical body to the real migration).
  CREATE OR REPLACE FUNCTION public.accept_invitation(p_token text)
    RETURNS jsonb
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
  AS $fn$
  DECLARE
    v_uid        uuid := auth.uid();
    v_email      text := lower(auth.jwt() ->> 'email');
    v_invitation public.invitations;
  BEGIN
    IF v_uid IS NULL THEN
      RAISE EXCEPTION 'You must be signed in to accept an invitation.' USING ERRCODE = '28000';
    END IF;
    SELECT * INTO v_invitation FROM public.invitations
      WHERE token = p_token AND deleted_at IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'We could not find that invitation. It may have been revoked.' USING ERRCODE = 'P0002';
    END IF;
    IF v_invitation.revoked_at IS NOT NULL THEN
      RAISE EXCEPTION 'This invitation has been revoked. Ask an admin for a new one.' USING ERRCODE = 'P0001';
    END IF;
    IF v_invitation.expires_at IS NOT NULL AND v_invitation.expires_at < now() THEN
      RAISE EXCEPTION 'This invitation has expired. Ask an admin for a new one.' USING ERRCODE = 'P0001';
    END IF;
    IF v_email IS NULL OR v_email <> lower(v_invitation.email) THEN
      RAISE EXCEPTION 'Your account email does not match this invitation. Sign in with the invited email address.' USING ERRCODE = 'P0001';
    END IF;
    IF v_invitation.accepted_at IS NOT NULL THEN
      IF EXISTS (SELECT 1 FROM public.contacts WHERE id = v_invitation.contact_id AND auth_user_id = v_uid) THEN
        RETURN jsonb_build_object('status','already_accepted','contact_id', v_invitation.contact_id);
      END IF;
      RAISE EXCEPTION 'This invitation has already been used. Please sign in instead.' USING ERRCODE = 'P0001';
    END IF;
    IF EXISTS (SELECT 1 FROM public.contacts WHERE auth_user_id = v_uid AND id <> v_invitation.contact_id) THEN
      RAISE EXCEPTION 'Your account is already linked to a different contact. Contact an admin.' USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.contacts SET auth_user_id = v_uid
      WHERE id = v_invitation.contact_id AND deleted_at IS NULL
        AND (auth_user_id IS NULL OR auth_user_id = v_uid);
    IF NOT FOUND THEN
      RAISE EXCEPTION 'We could not link your account to this contact. Contact an admin.' USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.invitations SET accepted_at = now() WHERE id = v_invitation.id;
    RETURN jsonb_build_object('status','accepted','contact_id', v_invitation.contact_id);
  END;
  $fn$;

  -- CHECK 1 — HAPPY PATH ----------------------------------------------------
  v_e := v_e_happy;
  INSERT INTO public.contacts (first_name, last_name, email)
    VALUES ('Probe','HappyPath', v_e) RETURNING id INTO v_contact;
  INSERT INTO public.invitations (contact_id, email, token, sent_at, expires_at)
    VALUES (v_contact, v_e, 'probe-happy', now(), now() + interval '7 days')
    RETURNING id INTO v_inv;

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_uid_a::text, 'email', v_e, 'role','authenticated')::text, true);

  v_res := public.accept_invitation('probe-happy');
  SELECT auth_user_id INTO v_linked FROM public.contacts WHERE id = v_contact;
  SELECT accepted_at  INTO v_acc    FROM public.invitations WHERE id = v_inv;

  IF v_res->>'status' <> 'accepted' THEN RAISE EXCEPTION 'PROBE FAIL: happy path status=% (want accepted)', v_res; END IF;
  IF v_linked IS DISTINCT FROM v_uid_a THEN RAISE EXCEPTION 'PROBE FAIL: auth_user_id not linked (got %)', v_linked; END IF;
  IF v_acc IS NULL THEN RAISE EXCEPTION 'PROBE FAIL: accepted_at not stamped'; END IF;
  v_checks := v_checks + 1;

  -- CHECK 2 — IDEMPOTENT re-accept by SAME user -> already_accepted ----------
  v_res := public.accept_invitation('probe-happy');
  IF v_res->>'status' <> 'already_accepted' THEN RAISE EXCEPTION 'PROBE FAIL: re-accept status=% (want already_accepted)', v_res; END IF;
  v_checks := v_checks + 1;

  -- CHECK 3 — already accepted by a DIFFERENT user -> rejected ---------------
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_uid_b::text, 'email', v_e_happy, 'role','authenticated')::text, true);
  BEGIN
    v_res := public.accept_invitation('probe-happy');
    RAISE EXCEPTION 'PROBE FAIL: different-user re-accept should have raised, got %', v_res;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'PROBE FAIL%' THEN RAISE; END IF;  -- propagate real failure
    v_checks := v_checks + 1;  -- expected rejection
  END;

  -- CHECK 4 — EMAIL MISMATCH -> rejected ------------------------------------
  v_e := 'probe.mismatch.phase1@example.com';
  INSERT INTO public.contacts (first_name, last_name, email)
    VALUES ('Probe','Mismatch', v_e) RETURNING id INTO v_contact;
  INSERT INTO public.invitations (contact_id, email, token, sent_at, expires_at)
    VALUES (v_contact, v_e, 'probe-mismatch', now(), now() + interval '7 days');
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_uid_b::text, 'email','someone.else@example.com','role','authenticated')::text, true);
  BEGIN
    v_res := public.accept_invitation('probe-mismatch');
    RAISE EXCEPTION 'PROBE FAIL: email mismatch should have raised, got %', v_res;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'PROBE FAIL%' THEN RAISE; END IF;
    v_checks := v_checks + 1;
  END;

  -- CHECK 5 — EXPIRED -> rejected -------------------------------------------
  v_e := 'probe.expired.phase1@example.com';
  INSERT INTO public.contacts (first_name, last_name, email)
    VALUES ('Probe','Expired', v_e) RETURNING id INTO v_contact;
  INSERT INTO public.invitations (contact_id, email, token, sent_at, expires_at)
    VALUES (v_contact, v_e, 'probe-expired', now(), now() - interval '1 day');
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_uid_b::text, 'email', v_e, 'role','authenticated')::text, true);
  BEGIN
    v_res := public.accept_invitation('probe-expired');
    RAISE EXCEPTION 'PROBE FAIL: expired should have raised, got %', v_res;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'PROBE FAIL%' THEN RAISE; END IF;
    v_checks := v_checks + 1;
  END;

  -- CHECK 6 — REVOKED -> rejected -------------------------------------------
  v_e := 'probe.revoked.phase1@example.com';
  INSERT INTO public.contacts (first_name, last_name, email)
    VALUES ('Probe','Revoked', v_e) RETURNING id INTO v_contact;
  INSERT INTO public.invitations (contact_id, email, token, sent_at, expires_at, revoked_at)
    VALUES (v_contact, v_e, 'probe-revoked', now(), now() + interval '7 days', now());
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_uid_b::text, 'email', v_e, 'role','authenticated')::text, true);
  BEGIN
    v_res := public.accept_invitation('probe-revoked');
    RAISE EXCEPTION 'PROBE FAIL: revoked should have raised, got %', v_res;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'PROBE FAIL%' THEN RAISE; END IF;
    v_checks := v_checks + 1;
  END;

  -- CHECK 7 — NOT AUTHENTICATED -> rejected ---------------------------------
  v_e := 'probe.anon.phase1@example.com';
  INSERT INTO public.contacts (first_name, last_name, email)
    VALUES ('Probe','Anon', v_e) RETURNING id INTO v_contact;
  INSERT INTO public.invitations (contact_id, email, token, sent_at, expires_at)
    VALUES (v_contact, v_e, 'probe-anon', now(), now() + interval '7 days');
  PERFORM set_config('request.jwt.claims', '{}', true);  -- no sub -> auth.uid() NULL
  BEGIN
    v_res := public.accept_invitation('probe-anon');
    RAISE EXCEPTION 'PROBE FAIL: unauthenticated should have raised, got %', v_res;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'PROBE FAIL%' THEN RAISE; END IF;
    v_checks := v_checks + 1;
  END;

  -- CHECK 8 — caller ALREADY LINKED to a different contact -> rejected -------
  -- uid_a is linked to the HappyPath contact (CHECK 1). Accepting a fresh
  -- invitation for a DIFFERENT contact as uid_a must hit the UNIQUE guard with
  -- the friendly message, not a raw 23505.
  v_e := 'probe.elsewhere.phase1@example.com';
  INSERT INTO public.contacts (first_name, last_name, email)
    VALUES ('Probe','Elsewhere', v_e) RETURNING id INTO v_contact;
  INSERT INTO public.invitations (contact_id, email, token, sent_at, expires_at)
    VALUES (v_contact, v_e, 'probe-elsewhere', now(), now() + interval '7 days');
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_uid_a::text, 'email', v_e, 'role','authenticated')::text, true);
  BEGIN
    v_res := public.accept_invitation('probe-elsewhere');
    RAISE EXCEPTION 'PROBE FAIL: already-linked-elsewhere should have raised, got %', v_res;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'PROBE FAIL%' THEN RAISE; END IF;
    IF SQLERRM NOT LIKE '%already linked to a different contact%' THEN
      RAISE EXCEPTION 'PROBE FAIL: wrong error for already-linked-elsewhere: %', SQLERRM;
    END IF;
    v_checks := v_checks + 1;
  END;

  -- All green. Raise to force rollback of EVERYTHING (function, users, data).
  RAISE EXCEPTION 'PROBE PASS — all % checks green. (This error is intentional: it rolls back the test. Nothing was persisted.)', v_checks;
END;
$probe$;

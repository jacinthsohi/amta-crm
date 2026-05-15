-- =============================================================================
-- 20260514_alumni_location_fields.sql
-- =============================================================================
-- Adds optional `current_city` and `current_state` columns to both `contacts`
-- and `alumni_claims`. Captures where the contact currently lives — distinct
-- from their program's location (which is what we have today via affiliations).
--
-- Why this matters:
--   Until now, an alum's geographic identity rolls up via their program's
--   state. Yale alum = CT, even if they live in California. For community
--   building, regional events, and donor cultivation, *current* location
--   matters more than college location. The /data alumni heatmap will
--   eventually offer a toggle between "by program state" and "by current
--   state" once enough alumni have populated this.
--
-- Design decisions:
--   - Two separate fields (city, state) rather than a single freeform
--     "location" string. State is needed for the heatmap; city for the
--     "alumni in NYC meetup" use case.
--   - `current_city` is freeform text — international cities are too varied
--     to enum.
--   - `current_state` is freeform text BUT the UI offers a dropdown with
--     50 US states + "International" + "Other". Stored as text rather than
--     enum so we can adjust the dropdown values without a schema migration.
--   - Both nullable, both optional in all forms. Public form should never
--     require fields that break for international alumni.
--   - Both on `alumni_claims` too so the reviewing admin sees what the
--     alum submitted before approval.
--
-- Note on the view recreate:
--   `active_contacts` view doesn't auto-expose new base-table columns. This
--   is the fourth+ instance of the column-drift pattern. RLS audit (🔴 HIGH
--   in backlog) will permanently address by recreating views with
--   `security_invoker` AND a column-completeness pass.
--
-- Verified against information_schema.columns on May 14, 2026: contacts had
-- 18 columns pre-migration, this brings it to 20.
-- =============================================================================

-- Add the new columns to contacts
ALTER TABLE public.contacts
ADD COLUMN IF NOT EXISTS current_city text,
ADD COLUMN IF NOT EXISTS current_state text;

COMMENT ON COLUMN public.contacts.current_city IS
'Optional city where the contact currently lives. Free-text since values can be international.';

COMMENT ON COLUMN public.contacts.current_state IS
'Optional state where the contact currently lives. US state name, or "International" / "Other".';

-- Add matching columns to alumni_claims
ALTER TABLE public.alumni_claims
ADD COLUMN IF NOT EXISTS current_city text,
ADD COLUMN IF NOT EXISTS current_state text;

COMMENT ON COLUMN public.alumni_claims.current_city IS
'Optional city captured on the alumni signup form. Transferred to contacts.current_city on approval.';

COMMENT ON COLUMN public.alumni_claims.current_state IS
'Optional state captured on the alumni signup form. Transferred to contacts.current_state on approval.';

-- Recreate active_contacts view with full column list including new fields.
DROP VIEW IF EXISTS public.active_contacts;

CREATE VIEW public.active_contacts AS
SELECT
  id,
  auth_user_id,
  first_name,
  last_name,
  pronouns,
  email,
  secondary_email,
  phone,
  profile_photo_url,
  notes,
  standing,
  has_board_history,
  is_admin,
  current_city,
  current_state,
  ai_summary,
  ai_summary_generated_at,
  created_at,
  updated_at,
  deleted_at
FROM public.contacts
WHERE deleted_at IS NULL;

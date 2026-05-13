-- =============================================================================
-- 20260513_secondary_email.sql
-- =============================================================================
-- Adds an optional `secondary_email` column to `contacts` and recreates the
-- `active_contacts` view to expose it.
--
-- Context:
--   Many contacts have two relevant email addresses: board members with a
--   workspace email + personal email; alumni with a school email + personal
--   email; etc. Users determine which is primary themselves (vs. having the
--   system auto-assign by source) since the "primary" semantic is "where I
--   want to be contacted."
--
-- Design decisions:
--   - One column on `contacts`, not a separate `contact_emails` table. Two
--     emails per contact covers the vast majority of real cases. Revisit
--     if we ever genuinely need N>2 emails per contact.
--   - `secondary_email` is NOT unique. Secondary is supplementary; uniqueness
--     creates weird states like "I can't add Mary's personal email because
--     Bob has it as his primary." Primary email retains uniqueness.
--   - Dupe detection in CSV import + Ask AI search both fields. Same person,
--     just reached via different channels.
--
-- Note: this is the second instance of the "active_* view column drift"
-- pattern (the first was `country` on `active_programs` on May 13). The
-- RLS-bypass audit (🔴 HIGH in backlog) should also do a column-completeness
-- pass while it's recreating views.
-- =============================================================================

ALTER TABLE public.contacts
ADD COLUMN IF NOT EXISTS secondary_email text;

COMMENT ON COLUMN public.contacts.secondary_email IS
'Optional second email for the contact (e.g. school + personal, or work + personal). Primary email remains the canonical identifier; secondary is supplementary.';

-- Recreate active_contacts to expose the new column.
-- (Views don't auto-update when underlying tables change.)
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
  ai_summary,
  ai_summary_generated_at,
  created_at,
  updated_at,
  deleted_at
FROM public.contacts
WHERE deleted_at IS NULL;

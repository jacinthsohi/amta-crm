-- =============================================================================
-- 20260513_alumni_claims_secondary_email.sql
-- =============================================================================
-- Adds an optional `secondary_email` column to `alumni_claims`, matching the
-- same field on `contacts`. The alumni signup form captures both emails,
-- and when an admin approves the claim, the secondary email is transferred
-- to the new contact record.
--
-- Why this column lives on the claim row (vs. only on contacts):
--   We want the reviewing admin to see exactly what the alum submitted,
--   including their second email. If we only persisted secondary_email at
--   approval time, the admin would have no chance to verify or correct it
--   while reviewing the claim. The cost is a tiny redundant column.
--
-- Note: alumni_claims does NOT currently have an active_alumni_claims view
-- (verified via pg_views). No view recreation needed here, unlike the
-- active_contacts and active_programs cases.
-- =============================================================================

ALTER TABLE public.alumni_claims
ADD COLUMN IF NOT EXISTS secondary_email text;

COMMENT ON COLUMN public.alumni_claims.secondary_email IS
'Optional second email captured on the alumni signup form. Transferred to contacts.secondary_email when the claim is approved.';

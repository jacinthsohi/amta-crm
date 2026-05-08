-- =============================================================================
-- Add meeting_briefs table
-- =============================================================================
-- Stores AI-generated meeting prep briefs. We don't cache (per design — briefs
-- are time-sensitive), but we DO save every generated brief so the user can
-- see their last one without regenerating, and so we have an audit trail.
--
-- Each brief is keyed by (contact_id, generated_by, generated_at) — multiple
-- briefs for the same contact accumulate over time. The contact detail page
-- shows the most recent.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.meeting_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  generated_by UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  meeting_context TEXT,
  brief JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS meeting_briefs_contact_id_generated_at_idx
  ON public.meeting_briefs (contact_id, generated_at DESC);

ALTER TABLE public.meeting_briefs ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read briefs (same audience as contacts)
CREATE POLICY "Authenticated users can read meeting briefs"
  ON public.meeting_briefs FOR SELECT
  TO authenticated
  USING (true);

-- Inserts happen server-side via the service-role key (bypassing RLS),
-- but we add an authenticated-user policy too for future client-side use.
CREATE POLICY "Authenticated users can insert meeting briefs"
  ON public.meeting_briefs FOR INSERT
  TO authenticated
  WITH CHECK (true);

GRANT SELECT, INSERT ON public.meeting_briefs TO authenticated;

COMMIT;

-- ---------------------------------------------------------------------------
-- After running:
--   1. Run `npm run types:generate` to refresh database.generated.ts
--   2. Verify table exists:
--        SELECT * FROM meeting_briefs LIMIT 1;
--      (will return zero rows, that's expected)
-- ---------------------------------------------------------------------------

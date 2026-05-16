-- =============================================================================
-- 20260516_ai_views_security_invoker.sql
-- =============================================================================
-- Tier 1 of the RLS-bypass-views audit. Recreates the two AI views with
-- `security_invoker = true` so they honor RLS policies on the underlying
-- tables instead of bypassing them.
--
-- Background:
--   Postgres views run with the *creator's* permissions by default. All our
--   active_* views are owned by the `postgres` superuser, so when an
--   authenticated user queries `active_ai_conversations`, the query runs
--   as postgres and bypasses every RLS policy on `ai_conversations`.
--
--   Today this doesn't manifest as a visible bug because there's only one
--   real user (jacinth). But the moment a second admin exists, they'd see
--   each other's conversation history in the sidebar — a real leak.
--
--   With `security_invoker = true`, the view's SELECT runs as the *caller*,
--   so RLS applies normally. The policies are already correctly user-scoped
--   (verified May 16, 2026):
--     - ai_conversations.SELECT: (auth_user_id = auth.uid())
--     - ai_messages.SELECT: conversation_id IN (
--         SELECT id FROM ai_conversations WHERE auth_user_id = auth.uid()
--       )
--
--   Both rowsecurity flags are already enabled on the base tables.
--
-- Scope decision:
--   This migration is intentionally limited to the AI views. The
--   invitations views (active_invitations, active_invitations_view) ALSO
--   bypass RLS, but their RLS policies are admin-only — meaning if we
--   flip security_invoker on them, non-admin users clicking magic links
--   in invitation emails would get "not found" because they fail the
--   `is_current_user_admin()` check. Fixing those requires a real design
--   decision about how to expose invitation-by-token reads to public
--   users, which is captured as a design discussion in the backlog.
--
--   The other ~19 active_* views are Tier 2/3 — they'll be batched in
--   later migrations once we have a clearer audit of what each one's
--   correct RLS posture should be.
--
-- Risk assessment for this migration:
--   - Only one app file queries these views: src/features/ask/hooks.ts
--   - Both queries are already written assuming RLS scopes the result
--     (no explicit auth_user_id filter — the view is expected to do it).
--   - Existing test data: jacinth's conversations. After migration she
--     will see exactly the same conversations she sees now (they all
--     have her auth_user_id).
--   - Visible behavior change for current user: zero.
--   - Behavior change for hypothetical future users: cross-user data
--     leakage is closed.
--
-- Rollback:
--   See 20260516_ai_views_security_invoker_rollback.sql. To revert,
--   run that file — it recreates the views WITHOUT security_invoker
--   to restore current (broken) behavior.
--
-- Column lists verified against pg_get_viewdef on May 16, 2026 (not from
-- memory — lessons from yesterday).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- active_ai_conversations
-- -----------------------------------------------------------------------------

DROP VIEW IF EXISTS public.active_ai_conversations;

CREATE VIEW public.active_ai_conversations
WITH (security_invoker = true) AS
SELECT
  id,
  auth_user_id,
  title,
  last_role,
  last_message_at,
  created_at,
  updated_at,
  deleted_at
FROM public.ai_conversations
WHERE deleted_at IS NULL;

COMMENT ON VIEW public.active_ai_conversations IS
'AI conversations not soft-deleted. Uses security_invoker so RLS policies on ai_conversations are enforced (each user sees only their own conversations).';

-- -----------------------------------------------------------------------------
-- active_ai_messages
-- -----------------------------------------------------------------------------
-- Note: no deleted_at filter because ai_messages has no deleted_at column.
-- Messages aren't soft-deleted individually; if a conversation is soft-
-- deleted, the view filters it via the conversation, not via messages.
-- (Verified May 16, 2026: ai_messages columns are id, conversation_id,
-- role, content, display_text, referenced_contact_ids, tool_calls,
-- created_at — no deleted_at.)

DROP VIEW IF EXISTS public.active_ai_messages;

CREATE VIEW public.active_ai_messages
WITH (security_invoker = true) AS
SELECT
  id,
  conversation_id,
  role,
  content,
  display_text,
  referenced_contact_ids,
  tool_calls,
  created_at
FROM public.ai_messages;

COMMENT ON VIEW public.active_ai_messages IS
'AI messages. Uses security_invoker so RLS policy on ai_messages is enforced (each user sees only messages from their own conversations, scoped via parent ai_conversations.auth_user_id).';

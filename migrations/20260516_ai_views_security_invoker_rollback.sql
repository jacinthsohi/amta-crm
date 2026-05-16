-- =============================================================================
-- 20260516_ai_views_security_invoker_rollback.sql
-- =============================================================================
-- ROLLBACK ONLY. Use this if 20260516_ai_views_security_invoker.sql causes
-- unexpected breakage in prod. Running this restores the AI views to their
-- pre-fix state (running as postgres owner, bypassing RLS).
--
-- This is NOT the desired end state — running this re-introduces the
-- security hole. Use only as an emergency revert while the actual issue
-- is debugged.
-- =============================================================================

DROP VIEW IF EXISTS public.active_ai_conversations;

CREATE VIEW public.active_ai_conversations AS
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

DROP VIEW IF EXISTS public.active_ai_messages;

CREATE VIEW public.active_ai_messages AS
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

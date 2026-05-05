import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

/**
 * TanStack Query hooks for the AI conversations & messages tables.
 *
 * Conversations and messages are owned by individual users (RLS enforces
 * this server-side). All queries scope to the current user automatically
 * via Supabase auth.
 */

export type AIConversation = {
  id: string;
  auth_user_id: string;
  title: string | null;
  last_role: "user" | "assistant" | null;
  last_message_at: string;
  created_at: string;
  updated_at: string;
};

export type AIToolCall = {
  tool: string;
  input: Record<string, unknown>;
  output_summary: string;
};

export type AIMessage = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: unknown[]; // Anthropic content blocks
  display_text: string | null;
  referenced_contact_ids: string[];
  tool_calls: AIToolCall[];
  created_at: string;
};

const KEYS = {
  conversations: ["ai-conversations"] as const,
  conversation: (id: string) => ["ai-conversation", id] as const,
  messages: (conversationId: string) =>
    ["ai-messages", conversationId] as const,
};

// =============================================================================
// Conversations list — for the sidebar
// =============================================================================

export function useAIConversations() {
  return useQuery<AIConversation[]>({
    queryKey: KEYS.conversations,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("active_ai_conversations")
        .select("*")
        .order("last_message_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as AIConversation[];
    },
  });
}

// =============================================================================
// Single conversation — for displaying messages
// =============================================================================

export function useAIMessages(conversationId: string | null) {
  return useQuery<AIMessage[]>({
    queryKey: conversationId ? KEYS.messages(conversationId) : ["ai-messages", "none"],
    enabled: Boolean(conversationId),
    queryFn: async () => {
      if (!conversationId) return [];
      const { data, error } = await supabase
        .from("active_ai_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data ?? []) as AIMessage[];
    },
  });
}

// =============================================================================
// Create conversation — called when user starts a new thread
// =============================================================================

export function useCreateAIConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const { data, error } = await supabase
        .from("ai_conversations")
        .insert({
          auth_user_id: user.id,
          last_message_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data as AIConversation;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.conversations });
    },
  });
}

// =============================================================================
// Delete conversation (soft delete)
// =============================================================================

export function useDeleteAIConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("ai_conversations")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.conversations });
    },
  });
}

// =============================================================================
// Append a message to a conversation
// =============================================================================

export function useAppendAIMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      conversation_id: string;
      role: "user" | "assistant";
      content: unknown[];
      display_text?: string;
      referenced_contact_ids?: string[];
      tool_calls?: AIToolCall[];
    }) => {
      const { data, error } = await supabase
        .from("ai_messages")
        .insert({
          conversation_id: params.conversation_id,
          role: params.role,
          content: params.content,
          display_text: params.display_text ?? null,
          referenced_contact_ids: params.referenced_contact_ids ?? [],
          tool_calls: params.tool_calls ?? [],
        })
        .select()
        .single();
      if (error) throw error;

      // Update the conversation's last_role and last_message_at
      await supabase
        .from("ai_conversations")
        .update({
          last_role: params.role,
          last_message_at: new Date().toISOString(),
        })
        .eq("id", params.conversation_id);

      return data as AIMessage;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: KEYS.messages(vars.conversation_id) });
      qc.invalidateQueries({ queryKey: KEYS.conversations });
    },
  });
}

// =============================================================================
// Update conversation title (for AI-generated titles)
// =============================================================================

export function useUpdateAIConversationTitle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; title: string }) => {
      const { error } = await supabase
        .from("ai_conversations")
        .update({ title: params.title })
        .eq("id", params.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.conversations });
    },
  });
}

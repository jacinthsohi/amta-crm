import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sparkles,
  Send,
  Plus,
  Trash2,
  Loader2,
  Wrench,
  ArrowRight,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/cn";
import {
  useAIConversations,
  useAIMessages,
  useCreateAIConversation,
  useDeleteAIConversation,
  useAppendAIMessage,
  useUpdateAIConversationTitle,
  type AIToolCall,
  type AIMessage,
} from "./hooks";

/**
 * Smart Contact Search ("Ask") page.
 *
 * Three-pane layout:
 *   - Left rail: list of past conversations (similar to ChatGPT/Claude.ai)
 *   - Main area: scrollable conversation thread
 *   - Bottom: input box for the next question
 *
 * On submit, we:
 *   1. Save the user message to ai_messages
 *   2. Call POST /api/ask with the full conversation history
 *   3. Save the assistant response to ai_messages
 *   4. (If first turn) call /api/ask-title to generate a conversation title
 */

const SUGGESTED_PROMPTS = [
  "Who currently chairs the Diversity & Inclusion Committee?",
  "Which board members serve on the Tournament Administration Committee?",
  "Who are the current AMTA officers?",
  "Show me everyone involved with the 2026 NCT case committees.",
];

export default function AskPage() {
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    null,
  );

  const conversationsQuery = useAIConversations();
  const conversations = conversationsQuery.data ?? [];

  return (
    <div className="flex h-full">
      <ConversationsRail
        activeId={activeConversationId}
        onSelect={setActiveConversationId}
        onNew={() => setActiveConversationId(null)}
      />
      <div className="flex-1 min-w-0 flex flex-col">
        {activeConversationId ? (
          <ConversationView
            conversationId={activeConversationId}
            onConversationDeleted={() => setActiveConversationId(null)}
          />
        ) : (
          <NewConversationView
            onConversationCreated={(id) => setActiveConversationId(id)}
          />
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Conversation rail — left sidebar with past threads
// =============================================================================

function ConversationsRail({
  activeId,
  onSelect,
  onNew,
}: {
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  const conversationsQuery = useAIConversations();
  const conversations = conversationsQuery.data ?? [];
  const deleteConversation = useDeleteAIConversation();

  return (
    <aside className="w-72 shrink-0 border-r border-zinc-200 bg-zinc-50/50 flex flex-col">
      <div className="p-3 border-b border-zinc-200">
        <button
          onClick={onNew}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-maroon-700 text-white text-sm font-medium hover:bg-maroon-800 transition-colors"
        >
          <Plus size={15} />
          <span>New conversation</span>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="p-4 text-xs text-zinc-500 text-center">
            No conversations yet. Start a new one!
          </div>
        ) : (
          <ul className="py-1">
            {conversations.map((c) => (
              <li key={c.id}>
                <div
                  className={cn(
                    "group flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-zinc-100 transition-colors",
                    activeId === c.id && "bg-zinc-100",
                  )}
                  onClick={() => onSelect(c.id)}
                >
                  <Sparkles
                    size={13}
                    className="text-maroon-700 shrink-0"
                  />
                  <span className="flex-1 text-sm text-zinc-800 truncate">
                    {c.title ?? "Untitled conversation"}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (
                        confirm("Delete this conversation? This can't be undone.")
                      ) {
                        deleteConversation.mutate(c.id);
                      }
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400 hover:text-red-700"
                    title="Delete"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

// =============================================================================
// New conversation view — empty state with suggestions
// =============================================================================

function NewConversationView({
  onConversationCreated,
}: {
  onConversationCreated: (id: string) => void;
}) {
  const [input, setInput] = useState("");
  const createConversation = useCreateAIConversation();
  const [isCreating, setIsCreating] = useState(false);

  async function handleSubmit(text: string) {
    if (!text.trim() || isCreating) return;
    setIsCreating(true);
    try {
      const conversation = await createConversation.mutateAsync();
      // Stash the initial input in sessionStorage so the conversation view
      // can pick it up and immediately submit. Cleaner than prop-drilling.
      sessionStorage.setItem(`ai-pending-${conversation.id}`, text);
      onConversationCreated(conversation.id);
    } catch (e) {
      alert("Failed to start conversation: " + (e as Error).message);
      setIsCreating(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-8 py-16">
          <div className="flex items-center gap-2 text-maroon-800 mb-2">
            <Sparkles size={20} />
            <h1 className="text-2xl font-semibold tracking-tight">
              Ask AMTA
            </h1>
          </div>
          <p className="text-zinc-600 mb-10 leading-relaxed">
            Ask natural-language questions about your contacts, committees, and
            community. The AI can search across your CRM data to help you find
            people and understand relationships.
          </p>
          <div className="text-xs uppercase tracking-wide text-zinc-500 font-medium mb-3">
            Try asking
          </div>
          <ul className="space-y-2">
            {SUGGESTED_PROMPTS.map((p) => (
              <li key={p}>
                <button
                  onClick={() => handleSubmit(p)}
                  disabled={isCreating}
                  className="w-full text-left px-4 py-3 rounded-lg border border-zinc-200 bg-white hover:border-maroon-300 hover:bg-maroon-50/30 transition-colors flex items-center gap-3 group disabled:opacity-50"
                >
                  <span className="text-sm text-zinc-800 flex-1">{p}</span>
                  <ArrowRight
                    size={14}
                    className="text-zinc-400 group-hover:text-maroon-700 transition-colors"
                  />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <ChatInput
        value={input}
        onChange={setInput}
        onSubmit={() => handleSubmit(input)}
        disabled={isCreating}
        placeholder="Ask about your contacts and committees..."
      />
    </div>
  );
}

// =============================================================================
// Conversation view — shows messages for an active conversation
// =============================================================================

function ConversationView({
  conversationId,
  onConversationDeleted,
}: {
  conversationId: string;
  onConversationDeleted: () => void;
}) {
  const messagesQuery = useAIMessages(conversationId);
  const messages = messagesQuery.data ?? [];
  const appendMessage = useAppendAIMessage();
  const updateTitle = useUpdateAIConversationTitle();

  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [streamingToolCalls, setStreamingToolCalls] = useState<AIToolCall[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages or thinking state changes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, isThinking, streamingToolCalls.length]);

  // Pick up any pending initial input from sessionStorage
  useEffect(() => {
    const pending = sessionStorage.getItem(`ai-pending-${conversationId}`);
    if (pending) {
      sessionStorage.removeItem(`ai-pending-${conversationId}`);
      handleSubmit(pending);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  async function handleSubmit(text: string) {
    if (!text.trim() || isThinking) return;
    setInput("");
    setIsThinking(true);
    setStreamingToolCalls([]);

    try {
      // 1. Save the user message
      const userContent = [{ type: "text", text }];
      await appendMessage.mutateAsync({
        conversation_id: conversationId,
        role: "user",
        content: userContent,
        display_text: text,
      });

      // 2. Build the message history to send to the API.
      // We need the full Anthropic-format message list, including any
      // previous tool_use/tool_result blocks.
      const apiMessages = [
        ...messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        { role: "user" as const, content: userContent },
      ];

      // 3. Get the user's session token for auth
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Not signed in");

      // 4. Call /api/ask
      const res = await fetch(`/api/ask?t=${Date.now()}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (!res.ok) {
        let msg = `Request failed (${res.status})`;
        try {
          const errJson = await res.json();
          if (errJson?.error) msg = errJson.error;
        } catch {
          // ignore
        }
        throw new Error(msg);
      }

      const data = (await res.json()) as {
        final_text: string;
        contact_ids: string[];
        tool_calls: AIToolCall[];
        full_messages: any[];
      };

      // 5. Save the assistant response. The content we save is the LAST
      // assistant message from full_messages — that has the right structure
      // (text + any tool_use blocks).
      const lastAssistant = [...data.full_messages]
        .reverse()
        .find((m) => m.role === "assistant");
      const assistantContent = lastAssistant?.content ?? [
        { type: "text", text: data.final_text },
      ];

      await appendMessage.mutateAsync({
        conversation_id: conversationId,
        role: "assistant",
        content: assistantContent,
        display_text: data.final_text,
        referenced_contact_ids: data.contact_ids,
        tool_calls: data.tool_calls,
      });

      // 6. If this was the first message, generate a title
      if (messages.length === 0) {
        // Fire-and-forget — we don't block the UI on this
        generateTitle(text, data.final_text).then((title) => {
          if (title) {
            updateTitle.mutate({ id: conversationId, title });
          }
        });
      }
    } catch (e) {
      alert("Error: " + (e as Error).message);
    } finally {
      setIsThinking(false);
      setStreamingToolCalls([]);
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-8 py-8 space-y-6">
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
          {isThinking && <ThinkingIndicator toolCalls={streamingToolCalls} />}
        </div>
      </div>
      <ChatInput
        value={input}
        onChange={setInput}
        onSubmit={() => handleSubmit(input)}
        disabled={isThinking}
        placeholder="Ask a follow-up..."
      />
    </div>
  );
}

// =============================================================================
// Message bubble
// =============================================================================

function MessageBubble({ message }: { message: AIMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-maroon-700 text-white px-4 py-2.5">
          <div className="text-sm leading-relaxed whitespace-pre-wrap">
            {message.display_text ?? ""}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {message.tool_calls.length > 0 && (
        <ToolCallsTrace calls={message.tool_calls} />
      )}
      <SimpleMarkdown text={stripContactIdsLine(message.display_text ?? "")} />
      {message.referenced_contact_ids.length > 0 && (
        <ContactCardsRow contactIds={message.referenced_contact_ids} />
      )}
    </div>
  );
}

/**
 * Display-side safety net: strip any CONTACT_IDS section that snuck through
 * the server-side parsing. Belt-and-suspenders approach so users never see
 * raw machine output.
 */
function stripContactIdsLine(text: string): string {
  return text.replace(/\s*CONTACT_IDS:\s*[\s\S]*?(?=\n\s*\n|$)/i, "").trim();
}

/**
 * Tiny markdown renderer. Handles **bold**, line breaks, bullet lists,
 * and paragraphs. We avoid pulling in a full markdown library because we
 * only need a few features and want to keep the bundle small.
 */
function SimpleMarkdown({ text }: { text: string }) {
  // Split into blocks separated by blank lines
  const blocks = text.split(/\n\s*\n/).filter((b) => b.trim());

  return (
    <div className="text-sm text-zinc-800 leading-relaxed space-y-3">
      {blocks.map((block, i) => {
        const lines = block.split("\n");

        // A block is a list if any line starts with "- " or "* ".
        // Continuation lines (no bullet) are folded into the preceding item.
        const hasBullets = lines.some((l) => /^\s*[-*]\s/.test(l));

        if (hasBullets) {
          const items: string[] = [];
          for (const line of lines) {
            if (/^\s*[-*]\s/.test(line)) {
              items.push(line.replace(/^\s*[-*]\s/, ""));
            } else if (items.length > 0) {
              // Continuation of previous bullet
              items[items.length - 1] += " " + line.trim();
            }
          }
          return (
            <ul key={i} className="list-disc pl-5 space-y-1">
              {items.map((item, j) => (
                <li key={j}>
                  <InlineMarkdown text={item} />
                </li>
              ))}
            </ul>
          );
        }

        return (
          <div key={i} className="whitespace-pre-wrap">
            {lines.map((line, j) => (
              <span key={j}>
                <InlineMarkdown text={line} />
                {j < lines.length - 1 && <br />}
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Renders inline formatting: **bold** and *italic*. Splits the text on
 * markers and wraps the appropriate spans.
 */
function InlineMarkdown({ text }: { text: string }) {
  // Split on **bold** segments. Capture group preserves the delimiters.
  const parts = text.split(/(\*\*[^*]+\*\*)/);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={i} className="font-semibold">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

// =============================================================================
// Tool calls trace (the "showy" piece — visualizes the agentic loop)
// =============================================================================

function ToolCallsTrace({ calls }: { calls: AIToolCall[] }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 px-3 py-2 space-y-1">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500 mb-1">
        <Wrench size={11} />
        <span>Research trace</span>
      </div>
      {calls.map((call, i) => (
        <div key={i} className="text-xs text-zinc-700 flex items-start gap-2">
          <span className="text-maroon-600 font-mono shrink-0 mt-0.5">
            {String(i + 1).padStart(2, "0")}
          </span>
          <span>{call.output_summary}</span>
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// Thinking indicator (with live tool call visibility)
// =============================================================================

function ThinkingIndicator({ toolCalls }: { toolCalls: AIToolCall[] }) {
  return (
    <div className="space-y-3">
      {toolCalls.length > 0 && <ToolCallsTrace calls={toolCalls} />}
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <Loader2 size={14} className="animate-spin" />
        <span>Thinking…</span>
      </div>
    </div>
  );
}

// =============================================================================
// Contact cards — clickable references to specific people
// =============================================================================

function ContactCardsRow({ contactIds }: { contactIds: string[] }) {
  return (
    <div className="flex flex-wrap gap-2 pt-1">
      {contactIds.map((id) => (
        <ContactCard key={id} contactId={id} />
      ))}
    </div>
  );
}

function ContactCard({ contactId }: { contactId: string }) {
  const navigate = useNavigate();
  const [contact, setContact] = useState<{
    first_name: string;
    last_name: string;
    email: string | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("active_contacts")
      .select("first_name, last_name, email")
      .eq("id", contactId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) setContact(data);
      });
    return () => {
      cancelled = true;
    };
  }, [contactId]);

  if (!contact) return null;

  return (
    <button
      onClick={() => navigate(`/contacts/${contactId}`)}
      className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white hover:border-maroon-300 hover:bg-maroon-50/30 px-3 py-1.5 transition-colors"
    >
      <span className="text-xs font-medium text-zinc-800">
        {contact.first_name} {contact.last_name}
      </span>
      <ArrowRight size={11} className="text-zinc-400" />
    </button>
  );
}

// =============================================================================
// Chat input box (bottom of screen)
// =============================================================================

function ChatInput({
  value,
  onChange,
  onSubmit,
  disabled,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  placeholder: string;
}) {
  return (
    <div className="border-t border-zinc-200 px-8 py-4">
      <div className="max-w-3xl mx-auto">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
          className="flex items-end gap-2 rounded-xl border border-zinc-300 focus-within:border-maroon-500 bg-white shadow-sm transition-colors"
        >
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSubmit();
              }
            }}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className="flex-1 resize-none px-4 py-3 bg-transparent text-sm focus:outline-none disabled:opacity-50"
            style={{ minHeight: "44px", maxHeight: "180px" }}
          />
          <button
            type="submit"
            disabled={disabled || !value.trim()}
            className="m-1.5 p-2 rounded-lg bg-maroon-700 text-white hover:bg-maroon-800 disabled:bg-zinc-300 transition-colors"
          >
            <Send size={15} />
          </button>
        </form>
      </div>
    </div>
  );
}

// =============================================================================
// Title generation — uses Claude to summarize the first exchange in 4 words
// =============================================================================

async function generateTitle(
  userQuestion: string,
  assistantAnswer: string,
): Promise<string | null> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return null;

    const res = await fetch("/api/ask-title", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        user_question: userQuestion,
        assistant_answer: assistantAnswer,
      }),
    });

    if (!res.ok) return null;
    const data = (await res.json()) as { title?: string };
    return data.title ?? null;
  } catch {
    return null;
  }
}

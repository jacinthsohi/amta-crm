import { useState } from "react";
import { Sparkles, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

/**
 * AI-generated 2-3 sentence summary of a contact, displayed inline on the
 * contact detail page.
 *
 * Behavior:
 *   - If the contact has a cached `ai_summary`, show it with a "Regenerate"
 *     link.
 *   - If not, show a "Generate AI summary" button. Clicking streams the
 *     response into view word-by-word.
 *   - After streaming completes, the backend persists the summary to the
 *     contact's row, and we invalidate the contact query so it stays fresh.
 *
 * Loading states:
 *   - "idle"      — initial; button or cached summary visible
 *   - "streaming" — the API call is in flight; show streaming text
 *   - "error"     — request failed; show error + retry option
 */

type Status = "idle" | "streaming" | "error";

type Props = {
  contactId: string;
  cachedSummary: string | null;
  cachedGeneratedAt: string | null;
};

export function AISummary({ contactId, cachedSummary, cachedGeneratedAt }: Props) {
  const qc = useQueryClient();
  const [streamedText, setStreamedText] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  // The text to display: prefer streaming text (most recent), fall back to cache
  const displayedText =
    status === "streaming" || streamedText ? streamedText : cachedSummary;

  async function generate() {
    setStatus("streaming");
    setError(null);
    setStreamedText("");

    try {
      // Need a valid Supabase session to authenticate the API call.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Not signed in. Please refresh the page.");
      }

      const res = await fetch(`/api/contact-summary?t=${Date.now()}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ contact_id: contactId }),
      });

      if (!res.ok) {
        // Try to parse the error JSON from the API
        let msg = `Request failed (${res.status})`;
        try {
          const errJson = await res.json();
          if (errJson?.error) msg = errJson.error;
        } catch {
          // Response wasn't JSON; fall through with the generic message
        }
        throw new Error(msg);
      }

      if (!res.body) {
        throw new Error("No response body returned.");
      }

      // Read the streaming response chunk by chunk
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        setStreamedText(buffer);
      }

      setStatus("idle");

      // Refresh the contact query so cachedSummary picks up the new value
      // on the next render. The backend has already persisted it.
      qc.invalidateQueries({ queryKey: ["contact", contactId] });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setStatus("error");
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  // Empty state: no cached summary, not streaming
  if (!displayedText && status === "idle") {
    return (
      <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50/50 p-4">
        <button
          onClick={generate}
          className="flex items-center gap-2 text-sm text-zinc-600 hover:text-maroon-700 transition-colors"
        >
          <Sparkles size={15} />
          <span>Generate AI summary</span>
        </button>
      </div>
    );
  }

  // Error state
  if (status === "error" && !displayedText) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm">
        <div className="text-red-900 font-medium mb-1.5 flex items-center gap-1.5">
          <Sparkles size={14} />
          <span>AI summary failed</span>
        </div>
        <div className="text-red-800 mb-2">{error}</div>
        <button
          onClick={generate}
          className="text-red-900 hover:underline text-xs"
        >
          Try again
        </button>
      </div>
    );
  }

  // Has content — either cached or streaming or just-finished-streaming
  return (
    <div className="rounded-lg border border-maroon-100 bg-maroon-50/30 p-4">
      <div className="flex items-start justify-between gap-3 mb-1.5">
        <div className="flex items-center gap-1.5 text-xs font-medium text-maroon-800 uppercase tracking-wide">
          <Sparkles size={13} />
          <span>AI Summary</span>
          {status === "streaming" && (
            <span className="text-zinc-500 text-[11px] normal-case font-normal tracking-normal">
              · generating…
            </span>
          )}
        </div>
        {status !== "streaming" && (
          <button
            onClick={generate}
            className="flex items-center gap-1 text-xs text-zinc-500 hover:text-maroon-700 transition-colors"
            title="Regenerate the summary"
          >
            <RefreshCw size={12} />
            <span>Regenerate</span>
          </button>
        )}
      </div>
      <div className="text-sm text-zinc-800 leading-relaxed">
        {displayedText}
        {status === "streaming" && (
          <span className="inline-block w-1.5 h-3.5 ml-0.5 bg-maroon-700 animate-pulse align-middle" />
        )}
      </div>
      {cachedGeneratedAt && status === "idle" && !streamedText && (
        <div className="mt-2 text-[11px] text-zinc-500">
          Generated {formatRelative(cachedGeneratedAt)}
        </div>
      )}
      {status === "error" && (
        <div className="mt-2 text-xs text-red-700">
          Error: {error}
        </div>
      )}
    </div>
  );
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = now - then;
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const days = Math.floor(hr / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}

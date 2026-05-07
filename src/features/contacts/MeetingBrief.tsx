import { useEffect, useState } from "react";
import {
  CalendarClock,
  RefreshCw,
  Loader2,
  AlertCircle,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

/**
 * AI-generated meeting prep brief. Click "Prep for meeting" → optionally add
 * meeting context → click "Generate brief" → see structured sections.
 *
 * Different from AISummary in three ways:
 *   - Always fresh (no caching). Briefs are time-sensitive.
 *   - Non-streaming, structured output. Backend uses Claude tool use.
 *   - Optional meeting context input ("budget discussion", "recruiting call")
 *     to focus the brief.
 *
 * On the contact detail page, this lives below the AISummary component.
 */

interface MeetingBriefData {
  who_they_are: string;
  your_history: string;
  recent_activity: string[];
  open_threads: string[];
  talking_points: string[];
}

type Status = "idle" | "context" | "loading" | "ready" | "error";

interface Props {
  contactId: string;
  contactFirstName: string;
}

export function MeetingBrief({ contactId, contactFirstName }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [meetingContext, setMeetingContext] = useState("");
  const [brief, setBrief] = useState<MeetingBriefData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);

  // When user clicks the initial prep button, jump to the context-input stage
  // so they can optionally add meeting context before generating.
  function startPrep() {
    setStatus("context");
  }

  function cancel() {
    setStatus(brief ? "ready" : "idle");
  }

  async function generate() {
    setStatus("loading");
    setError(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Not signed in. Please refresh the page.");

      const res = await fetch(`/api/meeting-brief?t=${Date.now()}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          contact_id: contactId,
          meeting_context: meetingContext.trim() || undefined,
        }),
      });

      if (!res.ok) {
        let msg = `Request failed (${res.status})`;
        try {
          const errJson = await res.json();
          if (errJson?.error) msg = errJson.error;
        } catch {
          // Fall through with generic message
        }
        throw new Error(msg);
      }

      const data = (await res.json()) as MeetingBriefData;
      setBrief(data);
      setGeneratedAt(new Date());
      setStatus("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  }

  // Cmd+Enter in the context textarea triggers generate
  useEffect(() => {
    if (status !== "context") return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        generate();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, meetingContext]);

  // -------------------------------------------------------------------------
  // IDLE — initial state, button to start
  // -------------------------------------------------------------------------
  if (status === "idle") {
    return (
      <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50/50 p-4">
        <button
          onClick={startPrep}
          className="flex items-center gap-2 text-sm text-zinc-600 hover:text-maroon-700 transition-colors"
        >
          <CalendarClock size={15} />
          <span>Prep for meeting with {contactFirstName}</span>
        </button>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // CONTEXT — optional meeting-context input
  // -------------------------------------------------------------------------
  if (status === "context") {
    return (
      <div className="rounded-lg border border-maroon-100 bg-maroon-50/30 p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-maroon-800 uppercase tracking-wide">
            <CalendarClock size={13} />
            <span>Meeting prep</span>
          </div>
          <button
            onClick={cancel}
            className="p-0.5 text-zinc-400 hover:text-zinc-700 transition-colors"
            aria-label="Cancel"
          >
            <X size={14} />
          </button>
        </div>
        <label className="block text-xs text-zinc-600 mb-1.5">
          What's this meeting about? (optional)
        </label>
        <textarea
          value={meetingContext}
          onChange={(e) => setMeetingContext(e.target.value)}
          placeholder={`e.g., "Discussing case licensing budget", "Recruiting them for the Tab committee", "1:1 catch-up"`}
          rows={2}
          maxLength={500}
          autoFocus
          className="w-full px-3 py-2 text-sm rounded-md border border-zinc-200 bg-white outline-none focus:border-maroon-700 transition-colors resize-none"
        />
        <div className="flex items-center justify-between mt-3">
          <p className="text-[11px] text-zinc-500">
            Skip this to get a general-purpose brief.{" "}
            <span className="text-zinc-400">⌘+Enter to generate.</span>
          </p>
          <div className="flex gap-2">
            <button
              onClick={cancel}
              className="px-3 py-1.5 rounded-md text-sm text-zinc-700 hover:bg-zinc-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={generate}
              className="px-3 py-1.5 rounded-md text-sm font-medium text-white bg-maroon-700 hover:bg-maroon-800 transition-colors"
            >
              Generate brief
            </button>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // LOADING — spinner while Claude generates
  // -------------------------------------------------------------------------
  if (status === "loading") {
    return (
      <div className="rounded-lg border border-maroon-100 bg-maroon-50/30 p-4">
        <div className="flex items-center gap-2 text-sm text-zinc-700">
          <Loader2 size={14} className="animate-spin text-maroon-700" />
          <span>Building your brief…</span>
        </div>
        <p className="text-xs text-zinc-500 mt-1.5">
          Pulling recent activity, open threads, and committee history.
        </p>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // ERROR — failure state with retry
  // -------------------------------------------------------------------------
  if (status === "error") {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm">
        <div className="text-red-900 font-medium mb-1.5 flex items-center gap-1.5">
          <AlertCircle size={14} />
          <span>Couldn't build the brief</span>
        </div>
        <div className="text-red-800 mb-2 text-xs">{error}</div>
        <button
          onClick={() => setStatus("context")}
          className="text-red-900 hover:underline text-xs"
        >
          Try again
        </button>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // READY — render the structured brief
  // -------------------------------------------------------------------------
  if (!brief) return null;

  return (
    <div className="rounded-lg border border-maroon-100 bg-maroon-50/30 p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-1.5 text-xs font-medium text-maroon-800 uppercase tracking-wide">
          <CalendarClock size={13} />
          <span>Meeting brief</span>
          {generatedAt && (
            <span className="text-zinc-500 text-[11px] normal-case font-normal tracking-normal">
              · just now
            </span>
          )}
        </div>
        <button
          onClick={() => setStatus("context")}
          className="flex items-center gap-1 text-xs text-zinc-500 hover:text-maroon-700 transition-colors"
          title="Regenerate the brief"
        >
          <RefreshCw size={12} />
          <span>Regenerate</span>
        </button>
      </div>

      <div className="space-y-3 text-sm">
        <BriefSection label="Who they are" body={brief.who_they_are} />
        <BriefSection label="Your history" body={brief.your_history} />
        <BriefList label="Recent activity" items={brief.recent_activity} />
        {brief.open_threads.length > 0 && (
          <BriefList label="Open threads" items={brief.open_threads} />
        )}
        <BriefList label="Talking points" items={brief.talking_points} />
      </div>
    </div>
  );
}

function BriefSection({ label, body }: { label: string; body: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 mb-1">
        {label}
      </div>
      <div className="text-zinc-800 leading-relaxed">{body}</div>
    </div>
  );
}

function BriefList({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 mb-1">
        {label}
      </div>
      <ul className="space-y-1 text-zinc-800 leading-relaxed">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-zinc-400 shrink-0">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

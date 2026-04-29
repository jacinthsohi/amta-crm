import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Search,
  ChevronRight,
  Mail,
  Phone,
  Users,
  StickyNote,
  CircleDot,
} from "lucide-react";
import {
  useInteractions,
  type InteractionWithRelations,
} from "./hooks";
import { ParticipantStack } from "@/components/ParticipantStack";
import { Tag } from "@/components/Tag";
import { LoadingState, ErrorState, EmptyState } from "@/components/states";
import { PrimaryButton } from "@/components/Buttons";
import { InteractionForm } from "./InteractionForm";
import { formatDate, htmlToPlainText } from "@/lib/format";
import type { Interaction } from "@/lib/database.types";

type TypeFilter = "all" | "meeting" | "call" | "email" | "note" | "other";

const FILTERS: { id: TypeFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "meeting", label: "Meetings" },
  { id: "call", label: "Calls" },
  { id: "email", label: "Emails" },
  { id: "note", label: "Notes" },
];

function typeIcon(t: Interaction["type"]) {
  if (t === "meeting") return <Users size={13} className="text-zinc-500" />;
  if (t === "call") return <Phone size={13} className="text-zinc-500" />;
  if (t === "email") return <Mail size={13} className="text-zinc-500" />;
  if (t === "note") return <StickyNote size={13} className="text-zinc-500" />;
  return <CircleDot size={13} className="text-zinc-500" />;
}

export default function InteractionsListPage() {
  const navigate = useNavigate();
  const { data: interactions, isLoading, error, refetch } = useInteractions();

  const [filter, setFilter] = useState<TypeFilter>("all");
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!interactions) return [];
    let result = interactions;
    if (filter !== "all") result = result.filter((i) => i.type === filter);
    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(
        (i) =>
          i.subject.toLowerCase().includes(q) ||
          (i.content ?? "").toLowerCase().includes(q),
      );
    }
    return result;
  }, [interactions, filter, query]);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <div className="px-8 pt-7 pb-5 border-b border-zinc-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight text-zinc-900">
              Interactions
            </h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              Meetings, calls, emails, and notes — what's been happening across
              the org.
            </p>
          </div>
          <PrimaryButton onClick={() => setFormOpen(true)}>
            <span className="inline-flex items-center gap-1.5">
              <Plus size={14} />
              Log interaction
            </span>
          </PrimaryButton>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm flex-1 max-w-md bg-white border border-zinc-200">
            <Search size={14} className="text-zinc-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by subject or content…"
              className="flex-1 outline-none bg-transparent text-zinc-800 placeholder:text-zinc-400"
            />
          </div>
          <div className="flex items-center gap-1">
            {FILTERS.map((f) => {
              const active = filter === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={
                    "px-2.5 py-1 rounded-md text-xs transition-colors border " +
                    (active
                      ? "bg-maroon-50 text-maroon-700 border-maroon-100 font-medium"
                      : "bg-transparent text-zinc-600 border-transparent hover:bg-zinc-50")
                  }
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : filtered.length === 0 ? (
          <EmptyState>No interactions match these filters.</EmptyState>
        ) : (
          <div className="divide-y divide-zinc-100">
            {filtered.map((i) => (
              <InteractionRow
                key={i.id}
                interaction={i}
                onClick={() => navigate(`/interactions/${i.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      <InteractionForm open={formOpen} onClose={() => setFormOpen(false)} />
    </div>
  );
}

function InteractionRow({
  interaction: i,
  onClick,
}: {
  interaction: InteractionWithRelations;
  onClick: () => void;
}) {
  const participantContacts = i.participants
    .map((p) => p.contact)
    .filter((c): c is NonNullable<typeof c> => Boolean(c));
  return (
    <div
      onClick={onClick}
      className="flex items-center justify-between px-8 py-3 hover:bg-zinc-50 cursor-pointer transition-colors group"
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {typeIcon(i.type)}
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-zinc-900 truncate">
              {i.subject}
            </span>
            <Tag tone="neutral">
              {i.type.charAt(0).toUpperCase() + i.type.slice(1)}
            </Tag>
          </div>
          {i.content && (
            <span className="text-xs text-zinc-500 truncate max-w-2xl">
              {htmlToPlainText(i.content)}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-4 shrink-0">
        {participantContacts.length > 0 && (
          <ParticipantStack contacts={participantContacts} />
        )}
        <span className="text-xs text-zinc-500 w-20 text-right">
          {formatDate(i.occurred_at)}
        </span>
        <ChevronRight
          size={15}
          className="text-zinc-300 group-hover:text-zinc-500 transition-colors"
        />
      </div>
    </div>
  );
}

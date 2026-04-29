import { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  Mail,
  Phone,
  Users,
  StickyNote,
  CircleDot,
  Calendar,
  GraduationCap,
  Briefcase,
  FolderKanban,
} from "lucide-react";
import {
  useInteraction,
  INTERACTION_TYPE_LABELS,
  INTERACTION_DIRECTION_LABELS,
  type InteractionDetailFull,
} from "./hooks";
import { Avatar } from "@/components/Avatar";
import { Tag } from "@/components/Tag";
import { Section } from "@/components/Section";
import { RichTextDisplay } from "@/components/RichTextDisplay";
import { LoadingState, ErrorState, EmptyState } from "@/components/states";
import { formatDate } from "@/lib/format";
import { InteractionForm } from "./InteractionForm";
import type { Interaction } from "@/lib/database.types";

function typeIcon(t: Interaction["type"], size = 26) {
  if (t === "meeting") return <Users size={size} className="text-maroon-700" />;
  if (t === "call") return <Phone size={size} className="text-maroon-700" />;
  if (t === "email") return <Mail size={size} className="text-maroon-700" />;
  if (t === "note") return <StickyNote size={size} className="text-maroon-700" />;
  return <CircleDot size={size} className="text-maroon-700" />;
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  const date = formatDate(iso);
  const time = d.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${date} at ${time}`;
}

export default function InteractionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: interaction, isLoading, error, refetch } = useInteraction(id);

  const [editOpen, setEditOpen] = useState(false);

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!interaction) {
    return (
      <div className="px-8 py-9">
        <p className="text-sm text-zinc-600">
          That interaction could not be found.
        </p>
        <Link
          to="/interactions"
          className="text-xs text-maroon-700 hover:underline"
        >
          ← Back to interactions
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <div className="px-8 py-3 flex items-center gap-2 text-sm border-b border-zinc-200">
        <button
          onClick={() => navigate("/interactions")}
          className="flex items-center gap-1 text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          <ChevronLeft size={15} />
          <span>Interactions</span>
        </button>
        <ChevronRight size={13} className="text-zinc-300" />
        <span className="text-zinc-900 font-medium truncate">
          {interaction.subject}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        <Hero interaction={interaction} onEdit={() => setEditOpen(true)} />
        <div className="px-8 py-7">
          <ParticipantsSection interaction={interaction} />
          {interaction.content && <ContentSection interaction={interaction} />}
          <LinksSection interaction={interaction} />
        </div>
      </div>

      <InteractionForm
        open={editOpen}
        onClose={() => setEditOpen(false)}
        initialInteraction={interaction}
      />
    </div>
  );
}

function Hero({
  interaction: i,
  onEdit,
}: {
  interaction: InteractionDetailFull;
  onEdit: () => void;
}) {
  return (
    <div className="px-8 pt-8 pb-6 border-b border-zinc-200">
      <div className="flex items-start gap-5">
        <div className="flex items-center justify-center w-16 h-16 rounded-xl bg-maroon-50 border border-maroon-100 shrink-0">
          {typeIcon(i.type)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <h1 className="text-[24px] font-semibold tracking-tight text-zinc-900">
              {i.subject}
            </h1>
            <Tag tone="maroon">
              {INTERACTION_TYPE_LABELS[i.type] ?? i.type}
            </Tag>
            {i.direction && (
              <Tag tone="neutral">
                {INTERACTION_DIRECTION_LABELS[i.direction] ?? i.direction}
              </Tag>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm text-zinc-600 flex-wrap">
            <span className="inline-flex items-center gap-1.5">
              <Calendar size={13} className="text-zinc-400" />
              {formatDateTime(i.occurred_at)}
            </span>
            {i.logged_by_contact && (
              <span className="text-zinc-500">
                logged by {i.logged_by_contact.first_name}{" "}
                {i.logged_by_contact.last_name}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onEdit}
          className="px-3 py-1.5 rounded-md text-xs font-medium border border-zinc-200 text-zinc-700 bg-white hover:bg-zinc-50 transition-colors"
        >
          Edit
        </button>
      </div>
    </div>
  );
}

function ParticipantsSection({
  interaction,
}: {
  interaction: InteractionDetailFull;
}) {
  const navigate = useNavigate();
  const parts = interaction.participants;
  return (
    <Section title="Participants" count={parts.length}>
      {parts.length === 0 ? (
        <EmptyState>No participants recorded.</EmptyState>
      ) : (
        <div className="space-y-2">
          {parts.map((p) => {
            const c = p.contact;
            if (!c) return null;
            return (
              <button
                key={p.id}
                onClick={() => navigate(`/contacts/${c.id}`)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-md text-left bg-white border border-zinc-200 hover:bg-zinc-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Avatar contact={c} size={28} />
                  <span className="text-sm font-medium text-zinc-900">
                    {c.first_name} {c.last_name}
                  </span>
                </div>
                <ChevronRight size={13} className="text-zinc-300" />
              </button>
            );
          })}
        </div>
      )}
    </Section>
  );
}

function ContentSection({
  interaction: i,
}: {
  interaction: InteractionDetailFull;
}) {
  return (
    <Section title="Notes">
      <div className="p-4 rounded-md bg-white border border-zinc-200">
        <RichTextDisplay html={i.content} />
      </div>
    </Section>
  );
}

function LinksSection({
  interaction: i,
}: {
  interaction: InteractionDetailFull;
}) {
  const navigate = useNavigate();
  const total =
    i.linked_events.length +
    i.linked_committees.length +
    i.linked_programs.length +
    i.linked_projects.length;

  if (total === 0) return null;

  return (
    <Section title="Links" count={total}>
      <div className="space-y-2">
        {i.linked_events.map((e) => (
          <button
            key={`e-${e.id}`}
            onClick={() => navigate(`/events/${e.id}`)}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-md text-left bg-white border border-zinc-200 hover:bg-zinc-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Calendar size={14} className="text-zinc-500" />
              <span className="text-sm font-medium text-zinc-900">
                {e.name}
              </span>
              <Tag tone="neutral">Event</Tag>
            </div>
            <ChevronRight size={13} className="text-zinc-300" />
          </button>
        ))}
        {i.linked_committees.map((c) => (
          <button
            key={`c-${c.id}`}
            onClick={() => navigate(`/committees/${c.id}`)}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-md text-left bg-white border border-zinc-200 hover:bg-zinc-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Briefcase size={14} className="text-zinc-500" />
              <span className="text-sm font-medium text-zinc-900">{c.name}</span>
              <Tag tone="neutral">Committee</Tag>
            </div>
            <ChevronRight size={13} className="text-zinc-300" />
          </button>
        ))}
        {i.linked_programs.map((p) => (
          <button
            key={`pg-${p.id}`}
            onClick={() => navigate(`/programs/${p.id}`)}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-md text-left bg-white border border-zinc-200 hover:bg-zinc-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <GraduationCap size={14} className="text-zinc-500" />
              <span className="text-sm font-medium text-zinc-900">{p.name}</span>
              <Tag tone="neutral">Program</Tag>
            </div>
            <ChevronRight size={13} className="text-zinc-300" />
          </button>
        ))}
        {i.linked_projects.map((p) => (
          <button
            key={`pj-${p.id}`}
            onClick={() => navigate(`/projects/${p.id}`)}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-md text-left bg-white border border-zinc-200 hover:bg-zinc-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <FolderKanban size={14} className="text-zinc-500" />
              <span className="text-sm font-medium text-zinc-900">{p.name}</span>
              <Tag tone="neutral">Project</Tag>
            </div>
            <ChevronRight size={13} className="text-zinc-300" />
          </button>
        ))}
      </div>
    </Section>
  );
}

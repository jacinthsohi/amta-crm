import { useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  MapPin,
  Plus,
  ExternalLink,
  FileText,
  GraduationCap,
  FolderKanban,
} from "lucide-react";
import {
  useEvent,
  DOCUMENT_TYPE_LABELS,
  type EventWithRelations,
} from "./hooks";
import { useProjectsForEvent } from "@/features/projects/hooks";
import { useInteractionsForEvent } from "@/features/interactions/hooks";
import { Avatar } from "@/components/Avatar";
import { Tag } from "@/components/Tag";
import { Section } from "@/components/Section";
import { RichTextDisplay } from "@/components/RichTextDisplay";
import { LoadingState, ErrorState, EmptyState } from "@/components/states";
import { formatDate } from "@/lib/format";
import { EventForm } from "./EventForm";
import { EventHostForm } from "./EventHostForm";
import { EventStaffForm } from "./EventStaffForm";
import { EventDocumentForm } from "./EventDocumentForm";
import { ProjectForm } from "@/features/projects/ProjectForm";
import { InteractionForm } from "@/features/interactions/InteractionForm";

function statusTone(s: EventWithRelations["status"]) {
  if (s === "upcoming") return "success" as const;
  if (s === "in_progress") return "maroon" as const;
  if (s === "completed") return "muted" as const;
  return "muted" as const;
}

function statusLabel(s: EventWithRelations["status"]) {
  if (s === "in_progress") return "In progress";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function eventDateRange(e: EventWithRelations) {
  if (!e.end_date || e.end_date === e.start_date) return formatDate(e.start_date);
  return `${formatDate(e.start_date)} – ${formatDate(e.end_date)}`;
}

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: event, isLoading, error, refetch } = useEvent(id);

  const [editOpen, setEditOpen] = useState(false);
  const [hostOpen, setHostOpen] = useState(false);
  const [staffOpen, setStaffOpen] = useState(false);
  const [docOpen, setDocOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [interactionOpen, setInteractionOpen] = useState(false);

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!event) {
    return (
      <div className="px-8 py-9">
        <p className="text-sm text-zinc-600">
          That event could not be found. It may have been deleted.
        </p>
        <Link to="/events" className="text-xs text-maroon-700 hover:underline">
          ← Back to events
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <div className="px-8 py-3 flex items-center gap-2 text-sm border-b border-zinc-200">
        <button
          onClick={() => navigate("/events")}
          className="flex items-center gap-1 text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          <ChevronLeft size={15} />
          <span>Events</span>
        </button>
        <ChevronRight size={13} className="text-zinc-300" />
        <span className="text-zinc-900 font-medium">{event.name}</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        <Hero event={event} onEdit={() => setEditOpen(true)} />
        <div className="px-8 py-7">
          {event.event_type === "tournament" && (
            <HostsSection event={event} onAdd={() => setHostOpen(true)} />
          )}
          <StaffSection event={event} onAdd={() => setStaffOpen(true)} />
          <DocumentsSection event={event} onAdd={() => setDocOpen(true)} />
          <ProjectsSection
            eventId={event.id}
            onAdd={() => setProjectOpen(true)}
          />
          <InteractionsSection
            eventId={event.id}
            onAdd={() => setInteractionOpen(true)}
          />
        </div>
      </div>

      <EventForm
        open={editOpen}
        onClose={() => setEditOpen(false)}
        initialEvent={event}
      />
      <EventHostForm
        open={hostOpen}
        onClose={() => setHostOpen(false)}
        eventId={event.id}
      />
      <EventStaffForm
        open={staffOpen}
        onClose={() => setStaffOpen(false)}
        eventId={event.id}
      />
      <EventDocumentForm
        open={docOpen}
        onClose={() => setDocOpen(false)}
        eventId={event.id}
      />
      <ProjectForm
        open={projectOpen}
        onClose={() => setProjectOpen(false)}
      />
      <InteractionForm
        open={interactionOpen}
        onClose={() => setInteractionOpen(false)}
      />
    </div>
  );
}

function Hero({
  event: e,
  onEdit,
}: {
  event: EventWithRelations;
  onEdit: () => void;
}) {
  const navigate = useNavigate();
  const banner =
    e.photo_banner_gradient ?? "linear-gradient(135deg, #70172a, #a82d4a)";
  return (
    <div className="border-b border-zinc-200">
      {/* Banner stripe */}
      <div className="h-32 w-full" style={{ background: banner }} />
      <div className="px-8 pt-6 pb-6">
        <div className="flex items-start gap-5">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <h1 className="text-[24px] font-semibold tracking-tight text-zinc-900">
                {e.name}
              </h1>
              {e.event_type === "tournament" ? (
                <Tag tone="maroon">
                  {e.tournament_type
                    ? e.tournament_type.toUpperCase()
                    : "Tournament"}
                </Tag>
              ) : (
                <Tag tone="neutral">Board meeting</Tag>
              )}
              <Tag tone={statusTone(e.status)}>{statusLabel(e.status)}</Tag>
            </div>
            <div className="flex items-center gap-5 text-sm text-zinc-600 flex-wrap">
              <div className="flex items-center gap-1.5">
                <Calendar size={13} className="text-zinc-400" />
                <span>{eventDateRange(e)}</span>
              </div>
              {(e.location_city || e.location_state) && (
                <div className="flex items-center gap-1.5">
                  <MapPin size={13} className="text-zinc-400" />
                  <span>
                    {e.location_city}
                    {e.location_city && e.location_state ? ", " : ""}
                    {e.location_state}
                  </span>
                </div>
              )}
              {e.primary_host_contact && (
                <button
                  onClick={() =>
                    navigate(`/contacts/${e.primary_host_contact!.id}`)
                  }
                  className="inline-flex items-center gap-1.5 hover:text-maroon-700 transition-colors"
                >
                  <Avatar contact={e.primary_host_contact} size={18} />
                  <span>
                    {e.primary_host_contact.first_name}{" "}
                    {e.primary_host_contact.last_name}
                  </span>
                  <span className="text-xs text-zinc-400">primary host</span>
                </button>
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
        {e.description && (
          <div className="mt-5 p-3 rounded-md text-sm text-zinc-700 leading-relaxed bg-zinc-50 border border-zinc-100">
            <RichTextDisplay html={e.description} />
          </div>
        )}
      </div>
    </div>
  );
}

function HostsSection({
  event,
  onAdd,
}: {
  event: EventWithRelations;
  onAdd: () => void;
}) {
  const navigate = useNavigate();
  return (
    <Section
      title="Host programs"
      count={event.hosts.length}
      action={
        <button
          onClick={onAdd}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded-md text-zinc-600 hover:text-maroon-700 hover:bg-maroon-50 transition-colors"
        >
          <Plus size={12} />
          Add host
        </button>
      }
    >
      {event.hosts.length === 0 ? (
        <EmptyState>No host programs assigned yet.</EmptyState>
      ) : (
        <div className="space-y-2">
          {event.hosts.map((h) => {
            const p = h.program;
            if (!p) return null;
            return (
              <button
                key={h.id}
                onClick={() => navigate(`/programs/${p.id}`)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-md text-left bg-white border border-zinc-200 hover:bg-zinc-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <GraduationCap size={14} className="text-zinc-500" />
                  <span className="text-sm font-medium text-zinc-900">
                    {p.name}
                  </span>
                  {p.city && (
                    <span className="text-xs text-zinc-500">
                      {p.city}, {p.state}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2.5">
                  <Tag tone={/^host$/i.test(h.host_role) ? "maroon" : "neutral"}>
                    {h.host_role}
                  </Tag>
                  <ChevronRight size={13} className="text-zinc-300" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </Section>
  );
}

function StaffSection({
  event,
  onAdd,
}: {
  event: EventWithRelations;
  onAdd: () => void;
}) {
  const navigate = useNavigate();
  return (
    <Section
      title="Staff"
      count={event.staff.length}
      action={
        <button
          onClick={onAdd}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded-md text-zinc-600 hover:text-maroon-700 hover:bg-maroon-50 transition-colors"
        >
          <Plus size={12} />
          Add staff
        </button>
      }
    >
      {event.staff.length === 0 ? (
        <EmptyState>No staff assigned yet.</EmptyState>
      ) : (
        <div className="space-y-2">
          {event.staff.map((s) => {
            const c = s.contact;
            if (!c) return null;
            return (
              <button
                key={s.id}
                onClick={() => navigate(`/contacts/${c.id}`)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-md text-left bg-white border border-zinc-200 hover:bg-zinc-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Avatar contact={c} size={28} />
                  <span className="text-sm font-medium text-zinc-900">
                    {c.first_name} {c.last_name}
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Tag tone="neutral">{s.position}</Tag>
                  <ChevronRight size={13} className="text-zinc-300" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </Section>
  );
}

function DocumentsSection({
  event,
  onAdd,
}: {
  event: EventWithRelations;
  onAdd: () => void;
}) {
  // Group documents by type
  const grouped = useMemo(() => {
    const m = new Map<string, typeof event.documents>();
    for (const d of event.documents) {
      const existing = m.get(d.document_type);
      if (existing) existing.push(d);
      else m.set(d.document_type, [d]);
    }
    return m;
  }, [event.documents]);

  return (
    <Section
      title="Documents"
      count={event.documents.length}
      action={
        <button
          onClick={onAdd}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded-md text-zinc-600 hover:text-maroon-700 hover:bg-maroon-50 transition-colors"
        >
          <Plus size={12} />
          Add document
        </button>
      }
    >
      {event.documents.length === 0 ? (
        <EmptyState>No documents linked yet.</EmptyState>
      ) : (
        <div>
          {Array.from(grouped.entries()).map(([type, docs]) => (
            <div key={type} className="mb-5 last:mb-0">
              <h4 className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-2">
                {DOCUMENT_TYPE_LABELS[type] ?? type} ({docs.length})
              </h4>
              <div className="space-y-2">
                {docs.map((d) => (
                  <a
                    key={d.id}
                    href={d.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between px-3 py-2.5 rounded-md bg-white border border-zinc-200 hover:bg-zinc-50 transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText size={14} className="text-zinc-500 shrink-0" />
                      <span className="text-sm font-medium text-zinc-900 truncate">
                        {d.title}
                      </span>
                    </div>
                    <ExternalLink
                      size={13}
                      className="text-zinc-300 group-hover:text-zinc-500 transition-colors shrink-0 ml-3"
                    />
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

function ProjectsSection({
  eventId,
  onAdd,
}: {
  eventId: string;
  onAdd: () => void;
}) {
  const navigate = useNavigate();
  const { data: projects } = useProjectsForEvent(eventId);
  return (
    <Section
      title="Related projects"
      count={projects?.length ?? 0}
      action={
        <button
          onClick={onAdd}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded-md text-zinc-600 hover:text-maroon-700 hover:bg-maroon-50 transition-colors"
        >
          <Plus size={12} />
          New project
        </button>
      }
    >
      {!projects || projects.length === 0 ? (
        <EmptyState>No projects linked to this event yet.</EmptyState>
      ) : (
        <div className="space-y-2">
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => navigate(`/projects/${p.id}`)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-md text-left bg-white border border-zinc-200 hover:bg-zinc-50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <FolderKanban size={14} className="text-zinc-500" />
                <span className="text-sm font-medium text-zinc-900 truncate">
                  {p.name}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Tag tone={p.status === "active" ? "maroon" : "neutral"}>
                  {p.status === "on_hold"
                    ? "On hold"
                    : p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                </Tag>
                <ChevronRight size={13} className="text-zinc-300" />
              </div>
            </button>
          ))}
        </div>
      )}
    </Section>
  );
}

function InteractionsSection({
  eventId,
  onAdd,
}: {
  eventId: string;
  onAdd: () => void;
}) {
  const navigate = useNavigate();
  const { data: interactions } = useInteractionsForEvent(eventId);
  return (
    <Section
      title="Related interactions"
      count={interactions?.length ?? 0}
      action={
        <button
          onClick={onAdd}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded-md text-zinc-600 hover:text-maroon-700 hover:bg-maroon-50 transition-colors"
        >
          <Plus size={12} />
          Log interaction
        </button>
      }
    >
      {!interactions || interactions.length === 0 ? (
        <EmptyState>
          No interactions logged for this event yet.
        </EmptyState>
      ) : (
        <div className="space-y-2">
          {interactions.map((i) => (
            <button
              key={i.id}
              onClick={() => navigate(`/interactions/${i.id}`)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-md text-left bg-white border border-zinc-200 hover:bg-zinc-50 transition-colors"
            >
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-medium text-zinc-900 truncate">
                  {i.subject}
                </span>
                <span className="text-xs text-zinc-500">
                  {i.type} · {formatDate(i.occurred_at)}
                </span>
              </div>
              <ChevronRight size={13} className="text-zinc-300 shrink-0 ml-3" />
            </button>
          ))}
        </div>
      )}
    </Section>
  );
}

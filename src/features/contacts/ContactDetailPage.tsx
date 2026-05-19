import { useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  Mail,
  Phone,
  MapPin,
  Award,
  GraduationCap,
  Briefcase,
  Plus,
  Calendar,
  CheckSquare,
  Square,
  AlertCircle,
  CircleDashed,
} from "lucide-react";
import { useContact, type ContactDetail as ContactDetailType } from "./hooks";
import { useProgramsLookup, useCommitteesLookup } from "@/lib/lookups";
import { useEventsForContact } from "@/features/events/hooks";
import { useTasksForContact } from "@/features/tasks/hooks";
import { useInteractionsForContact } from "@/features/interactions/hooks";
import { Avatar } from "@/components/Avatar";
import { Tag } from "@/components/Tag";
import { Section } from "@/components/Section";
import { RichTextDisplay } from "@/components/RichTextDisplay";
import { LoadingState, ErrorState, EmptyState } from "@/components/states";
import {
  formatDate,
  formatTermType,
  formatOfficerType,
  formatAffiliationType,
  formatYearRange,
} from "@/lib/format";
import { formatLocation } from "@/lib/format-location";
import { ContactForm } from "./ContactForm";
import { BoardTermForm } from "./BoardTermForm";
import { OfficerTermForm } from "./OfficerTermForm";
import { CommitteeAssignmentForm } from "./CommitteeAssignmentForm";
import { ProgramAffiliationForm } from "./ProgramAffiliationForm";
import { ProfileLinkSection } from "./ProfileLinkSection";
import { TaskForm } from "@/features/tasks/TaskForm";
import { InteractionForm } from "@/features/interactions/InteractionForm";
import type { Task } from "@/lib/database.types";
import { AISummary } from "./AISummary";
import { MeetingBrief } from "./MeetingBrief";

function isCurrentBoard(c: { category_names: string[] }): boolean {
  return c.category_names.includes("Current Board Member");
}

export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: contact, isLoading, error, refetch } = useContact(id);

  // Modal state for each form
  const [editOpen, setEditOpen] = useState(false);
  const [boardTermOpen, setBoardTermOpen] = useState(false);
  const [officerTermOpen, setOfficerTermOpen] = useState(false);
  const [committeeAssignmentOpen, setCommitteeAssignmentOpen] = useState(false);
  const [programAffiliationOpen, setProgramAffiliationOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>();
  const [interactionOpen, setInteractionOpen] = useState(false);

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!contact) {
    return (
      <div className="px-8 py-9">
        <p className="text-sm text-zinc-600">
          That contact could not be found. They may have been deleted.
        </p>
        <Link to="/contacts" className="text-xs text-maroon-700 hover:underline">
          ← Back to contacts
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Top bar / breadcrumb */}
      <div className="px-8 py-3 flex items-center gap-2 text-sm border-b border-zinc-200">
        <button
          onClick={() => navigate("/contacts")}
          className="flex items-center gap-1 text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          <ChevronLeft size={15} />
          <span>Contacts</span>
        </button>
        <ChevronRight size={13} className="text-zinc-300" />
        <span className="text-zinc-900 font-medium">
          {contact.first_name} {contact.last_name}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        <Hero contact={contact} onEdit={() => setEditOpen(true)} />

        {/* AI summary — generated on demand, cached on the contact row */}
        {/* Meeting brief — always fresh, structured output */}
        <div className="px-8 pt-1 pb-2 space-y-3">
          <AISummary
            contactId={contact.id}
            cachedSummary={contact.ai_summary}
            cachedGeneratedAt={contact.ai_summary_generated_at}
          />
          <MeetingBrief
            contactId={contact.id}
            contactFirstName={contact.first_name}
          />
        </div>

        <div
          className="px-8 py-7 grid gap-10"
          style={{ gridTemplateColumns: "minmax(0, 1fr) 320px" }}
        >
          <div className="min-w-0">
            <OfficerTermsSection
              contact={contact}
              onAdd={() => setOfficerTermOpen(true)}
            />
            <BoardTermsSection
              contact={contact}
              onAdd={() => setBoardTermOpen(true)}
            />
            <CommitteeAssignmentsSection
              contact={contact}
              onAdd={() => setCommitteeAssignmentOpen(true)}
            />
            <ProgramAffiliationsSection
              contact={contact}
              onAdd={() => setProgramAffiliationOpen(true)}
            />
            <EventsStaffingSection contactId={contact.id} />
            <TasksSection
              contactId={contact.id}
              onAdd={() => {
                setEditingTask(undefined);
                setTaskOpen(true);
              }}
              onEditTask={(t) => {
                setEditingTask(t);
                setTaskOpen(true);
              }}
            />
            <InteractionsSection
              contactId={contact.id}
              onAdd={() => setInteractionOpen(true)}
            />
          </div>

          <Sidebar contact={contact} />
        </div>
      </div>

      {/* Modals */}
      <ContactForm
        open={editOpen}
        onClose={() => setEditOpen(false)}
        initialContact={contact}
      />
      <BoardTermForm
        open={boardTermOpen}
        onClose={() => setBoardTermOpen(false)}
        contactId={contact.id}
      />
      <OfficerTermForm
        open={officerTermOpen}
        onClose={() => setOfficerTermOpen(false)}
        contactId={contact.id}
      />
      <CommitteeAssignmentForm
        open={committeeAssignmentOpen}
        onClose={() => setCommitteeAssignmentOpen(false)}
        contactId={contact.id}
      />
      <ProgramAffiliationForm
        open={programAffiliationOpen}
        onClose={() => setProgramAffiliationOpen(false)}
        contactId={contact.id}
      />
      <TaskForm
        open={taskOpen}
        onClose={() => {
          setTaskOpen(false);
          setEditingTask(undefined);
        }}
        initialTask={editingTask}
      />
      <InteractionForm
        open={interactionOpen}
        onClose={() => setInteractionOpen(false)}
      />
    </div>
  );
}

function Hero({
  contact: c,
  onEdit,
}: {
  contact: ContactDetailType;
  onEdit: () => void;
}) {
  const locationLabel = formatLocation(c.current_city, c.current_state);

  return (
    <div className="px-8 pt-8 pb-6 border-b border-zinc-200">
      <div className="flex items-start gap-5">
        <Avatar contact={c} size={64} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <h1 className="text-[24px] font-semibold tracking-tight text-zinc-900">
              {c.first_name} {c.last_name}
            </h1>
            {c.pronouns && (
              <span className="text-sm text-zinc-500">({c.pronouns})</span>
            )}
            {isCurrentBoard(c) && <Tag tone="maroon">Current Board</Tag>}
            {c.standing === "active" && !isCurrentBoard(c) && (
              <Tag tone="success">Active</Tag>
            )}
            {c.standing === "inactive" && <Tag tone="muted">Inactive</Tag>}
          </div>
          <div className="flex items-center gap-5 text-sm text-zinc-600 mb-1.5 flex-wrap">
            {c.email && (
              <div className="flex items-center gap-1.5" title="Primary email">
                <Mail size={13} className="text-zinc-400" />
                <span>{c.email}</span>
              </div>
            )}
            {c.secondary_email && (
              <div
                className="flex items-center gap-1.5 text-xs text-zinc-500"
                title="Secondary email"
              >
                <Mail size={12} className="text-zinc-300" />
                <span>{c.secondary_email}</span>
              </div>
            )}
            {c.phone && (
              <div className="flex items-center gap-1.5">
                <Phone size={13} className="text-zinc-400" />
                <span>{c.phone}</span>
              </div>
            )}
          </div>
          {locationLabel && (
            <div
              className="flex items-center gap-1.5 text-sm text-zinc-600 mb-3"
              title="Current location"
            >
              <MapPin size={13} className="text-zinc-400" />
              <span>{locationLabel}</span>
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            {c.category_names.map((cat) => (
              <Tag
                key={cat}
                tone={cat === "Current Board Member" ? "maroon" : "neutral"}
              >
                {cat}
              </Tag>
            ))}
          </div>
        </div>
        <button
          onClick={onEdit}
          className="px-3 py-1.5 rounded-md text-xs font-medium border border-zinc-200 text-zinc-700 bg-white hover:bg-zinc-50 transition-colors"
        >
          Edit
        </button>
      </div>
      {c.notes && (
        <div className="mt-5 p-3 rounded-md text-sm text-zinc-700 leading-relaxed bg-zinc-50 border border-zinc-100">
          <RichTextDisplay html={c.notes} />
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Each section has an "Add" affordance via the action prop on <Section>.
// =============================================================================

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 text-xs px-2 py-1 rounded-md text-zinc-600 hover:text-maroon-700 hover:bg-maroon-50 transition-colors"
    >
      <Plus size={12} />
      {label}
    </button>
  );
}

function OfficerTermsSection({
  contact,
  onAdd,
}: {
  contact: ContactDetailType;
  onAdd: () => void;
}) {
  const terms = contact.officer_terms;
  return (
    <Section
      title="Officer Terms"
      count={terms.length}
      action={<AddButton label="Add term" onClick={onAdd} />}
    >
      {terms.length === 0 ? (
        <EmptyState>No officer terms recorded.</EmptyState>
      ) : (
        <div className="space-y-2">
          {terms.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between px-3 py-2.5 rounded-md bg-white border border-zinc-200"
            >
              <div className="flex items-center gap-3">
                <Award size={14} className="text-maroon-700" />
                <span className="text-sm font-medium text-zinc-900">
                  {formatOfficerType(t.officer_type)}
                </span>
              </div>
              <span className="text-xs text-zinc-500">
                {formatDate(t.start_date)} –{" "}
                {t.end_date ? formatDate(t.end_date) : "present"}
              </span>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

function BoardTermsSection({
  contact,
  onAdd,
}: {
  contact: ContactDetailType;
  onAdd: () => void;
}) {
  const terms = contact.board_terms;
  return (
    <Section
      title="Board Terms"
      count={terms.length}
      action={<AddButton label="Add term" onClick={onAdd} />}
    >
      {terms.length === 0 ? (
        <EmptyState>No board terms on file.</EmptyState>
      ) : (
        <div className="space-y-2">
          {terms.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between px-3 py-2.5 rounded-md bg-white border border-zinc-200"
            >
              <div className="flex items-center gap-3">
                <Briefcase size={14} className="text-zinc-500" />
                <span className="text-sm font-medium text-zinc-900">
                  {formatTermType(t.term_type)}
                </span>
                <span className="text-xs text-zinc-500">
                  Class of {t.election_year}
                </span>
              </div>
              <span className="text-xs text-zinc-500">
                {formatDate(t.start_date)} –{" "}
                {t.end_date ? formatDate(t.end_date) : "present"}
              </span>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

function CommitteeAssignmentsSection({
  contact,
  onAdd,
}: {
  contact: ContactDetailType;
  onAdd: () => void;
}) {
  const navigate = useNavigate();
  const { data: committees } = useCommitteesLookup();
  const committeeById = useMemo(
    () => new Map((committees ?? []).map((c) => [c.id, c])),
    [committees],
  );

  const assignments = contact.committee_assignments;
  return (
    <Section
      title="Committee Assignments"
      count={assignments.length}
      action={<AddButton label="Add assignment" onClick={onAdd} />}
    >
      {assignments.length === 0 ? (
        <EmptyState>No committee assignments.</EmptyState>
      ) : (
        <div className="space-y-2">
          {assignments.map((a) => {
            const committee = committeeById.get(a.committee_id);
            return (
              <button
                key={a.id}
                onClick={() => navigate(`/committees/${a.committee_id}`)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-md text-left bg-white border border-zinc-200 hover:bg-zinc-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-zinc-900">
                    {committee?.name ?? "(deleted committee)"}
                  </span>
                  <Tag tone={/chair/i.test(a.position) ? "maroon" : "neutral"}>
                    {a.position}
                  </Tag>
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

function ProgramAffiliationsSection({
  contact,
  onAdd,
}: {
  contact: ContactDetailType;
  onAdd: () => void;
}) {
  const navigate = useNavigate();
  const { data: programs } = useProgramsLookup();
  const programById = useMemo(
    () => new Map((programs ?? []).map((p) => [p.id, p])),
    [programs],
  );

  const affs = contact.program_affiliations;
  return (
    <Section
      title="Program Affiliations"
      count={affs.length}
      action={<AddButton label="Add affiliation" onClick={onAdd} />}
    >
      {affs.length === 0 ? (
        <EmptyState>No program affiliations.</EmptyState>
      ) : (
        <div className="space-y-2">
          {affs.map((a) => {
            const prog = programById.get(a.program_id);
            return (
              <button
                key={a.id}
                onClick={() => navigate(`/programs/${a.program_id}`)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-md text-left bg-white border border-zinc-200 hover:bg-zinc-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <GraduationCap size={14} className="text-zinc-500" />
                  <span className="text-sm font-medium text-zinc-900">
                    {prog?.name ?? "(deleted program)"}
                  </span>
                  {prog && (
                    <span className="text-xs text-zinc-500">
                      {prog.city}, {prog.state}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2.5">
                  <Tag tone="neutral">
                    {formatAffiliationType(a.affiliation_type)}
                  </Tag>
                  <span className="text-xs text-zinc-500">
                    {formatYearRange(a.start_year, a.end_year)}
                  </span>
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

function Sidebar({ contact }: { contact: ContactDetailType }) {
  return (
    <div className="text-sm space-y-6">
      <div>
        <h3 className="text-[11px] font-semibold tracking-wide uppercase text-zinc-500 mb-2.5">
          At a glance
        </h3>
        <dl className="text-sm space-y-2.5">
          <Stat label="Officer terms" value={contact.officer_terms.length} />
          <Stat label="Board terms" value={contact.board_terms.length} />
          <Stat
            label="Committee assignments"
            value={contact.committee_assignments.length}
          />
          <Stat
            label="Program affiliations"
            value={contact.program_affiliations.length}
          />
        </dl>
      </div>

      <ProfileLinkSection
        contactId={contact.id}
        contactFirstName={contact.first_name}
        contactEmail={contact.email}
      />

      <div className="text-xs text-zinc-500 leading-relaxed">
        <p>
          A global search across all contacts, projects, events, and
          interactions ships in Phase 4f.
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="font-medium text-zinc-900">{value}</dd>
    </div>
  );
}

function EventsStaffingSection({ contactId }: { contactId: string }) {
  const navigate = useNavigate();
  const { data: events } = useEventsForContact(contactId);

  return (
    <Section title="Events" count={events?.length ?? 0}>
      {!events || events.length === 0 ? (
        <EmptyState>
          Not staffing any events. Event assignments are added from each
          event's detail page.
        </EmptyState>
      ) : (
        <div className="space-y-2">
          {events.map((e) => (
            <button
              key={e.id}
              onClick={() => navigate(`/events/${e.id}`)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-md text-left bg-white border border-zinc-200 hover:bg-zinc-50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-8 h-8 rounded-md shrink-0"
                  style={{
                    background:
                      e.photo_banner_gradient ??
                      "linear-gradient(135deg, #70172a, #a82d4a)",
                  }}
                />
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium text-zinc-900 truncate">
                    {e.name}
                  </span>
                  <span className="text-xs text-zinc-500 inline-flex items-center gap-1">
                    <Calendar size={11} className="text-zinc-400" />
                    {formatDate(e.start_date)}
                  </span>
                </div>
              </div>
              <ChevronRight size={13} className="text-zinc-300 shrink-0 ml-3" />
            </button>
          ))}
        </div>
      )}
    </Section>
  );
}

function taskStatusIcon(s: Task["status"]) {
  if (s === "done")
    return <CheckSquare size={14} className="text-green-600" />;
  if (s === "in_progress")
    return <CircleDashed size={14} className="text-maroon-700" />;
  if (s === "blocked")
    return <AlertCircle size={14} className="text-amber-600" />;
  return <Square size={14} className="text-zinc-400" />;
}

function TasksSection({
  contactId,
  onAdd,
  onEditTask,
}: {
  contactId: string;
  onAdd: () => void;
  onEditTask: (t: Task) => void;
}) {
  const { data: tasks } = useTasksForContact(contactId);
  return (
    <Section
      title="Tasks assigned"
      count={tasks?.length ?? 0}
      action={
        <button
          onClick={onAdd}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded-md text-zinc-600 hover:text-maroon-700 hover:bg-maroon-50 transition-colors"
        >
          <Plus size={12} />
          New task
        </button>
      }
    >
      {!tasks || tasks.length === 0 ? (
        <EmptyState>No tasks assigned to this contact.</EmptyState>
      ) : (
        <div className="space-y-2">
          {tasks.map((t) => (
            <button
              key={t.id}
              onClick={() => onEditTask(t)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-md text-left bg-white border border-zinc-200 hover:bg-zinc-50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                {taskStatusIcon(t.status)}
                <span
                  className={
                    "text-sm truncate " +
                    (t.status === "done"
                      ? "text-zinc-400 line-through"
                      : "text-zinc-900 font-medium")
                  }
                >
                  {t.title}
                </span>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                {t.priority === "high" && <Tag tone="warn">High</Tag>}
                {t.due_date && (
                  <span className="text-xs text-zinc-500">
                    {formatDate(t.due_date)}
                  </span>
                )}
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
  contactId,
  onAdd,
}: {
  contactId: string;
  onAdd: () => void;
}) {
  const navigate = useNavigate();
  const { data: interactions } = useInteractionsForContact(contactId);
  return (
    <Section
      title="Recent interactions"
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
          No interactions logged with this contact yet.
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

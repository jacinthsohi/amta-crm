import { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  Briefcase,
  Plus,
  Layers,
  FolderKanban,
} from "lucide-react";
import {
  useCommittee,
  type CommitteeWithRelations,
} from "./hooks";
import { useProjectsForCommittee } from "@/features/projects/hooks";
import { useInteractionsForCommittee } from "@/features/interactions/hooks";
import { Avatar } from "@/components/Avatar";
import { Tag } from "@/components/Tag";
import { Section } from "@/components/Section";
import { RichTextDisplay } from "@/components/RichTextDisplay";
import { LoadingState, ErrorState, EmptyState } from "@/components/states";
import { formatDate } from "@/lib/format";
import { CommitteeForm } from "./CommitteeForm";
import { CommitteeAssignmentForm } from "@/features/contacts/CommitteeAssignmentForm";
import { ProjectForm } from "@/features/projects/ProjectForm";
import { InteractionForm } from "@/features/interactions/InteractionForm";

export default function CommitteeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: committee, isLoading, error, refetch } = useCommittee(id);

  const [editOpen, setEditOpen] = useState(false);
  const [addAssignmentOpen, setAddAssignmentOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [interactionOpen, setInteractionOpen] = useState(false);

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!committee) {
    return (
      <div className="px-8 py-9">
        <p className="text-sm text-zinc-600">
          That committee could not be found. It may have been deleted.
        </p>
        <Link
          to="/committees"
          className="text-xs text-maroon-700 hover:underline"
        >
          ← Back to committees
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <div className="px-8 py-3 flex items-center gap-2 text-sm border-b border-zinc-200">
        <button
          onClick={() => navigate("/committees")}
          className="flex items-center gap-1 text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          <ChevronLeft size={15} />
          <span>Committees</span>
        </button>
        <ChevronRight size={13} className="text-zinc-300" />
        {committee.parent && (
          <>
            <button
              onClick={() => navigate(`/committees/${committee.parent!.id}`)}
              className="text-zinc-500 hover:text-zinc-900 transition-colors"
            >
              {committee.parent.name}
            </button>
            <ChevronRight size={13} className="text-zinc-300" />
          </>
        )}
        <span className="text-zinc-900 font-medium">{committee.name}</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        <Hero committee={committee} onEdit={() => setEditOpen(true)} />
        <div className="px-8 py-7">
          <MembersSection
            committee={committee}
            onAdd={() => setAddAssignmentOpen(true)}
          />
          {committee.subcommittees.length > 0 && (
            <SubcommitteesSection committee={committee} />
          )}
          <ProjectsSection
            committeeId={committee.id}
            onAdd={() => setProjectOpen(true)}
          />
          <InteractionsSection
            committeeId={committee.id}
            onAdd={() => setInteractionOpen(true)}
          />
        </div>
      </div>

      <CommitteeForm
        open={editOpen}
        onClose={() => setEditOpen(false)}
        initialCommittee={committee}
      />
      <CommitteeAssignmentForm
        open={addAssignmentOpen}
        onClose={() => setAddAssignmentOpen(false)}
        committeeId={committee.id}
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
  committee: c,
  onEdit,
}: {
  committee: CommitteeWithRelations;
  onEdit: () => void;
}) {
  return (
    <div className="px-8 pt-8 pb-6 border-b border-zinc-200">
      <div className="flex items-start gap-5">
        <div className="flex items-center justify-center w-16 h-16 rounded-xl bg-maroon-50 border border-maroon-100 shrink-0">
          <Briefcase size={26} className="text-maroon-700" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <h1 className="text-[24px] font-semibold tracking-tight text-zinc-900">
              {c.name}
            </h1>
            {c.is_executive && <Tag tone="maroon">Executive</Tag>}
            {c.status === "active" ? (
              <Tag tone="success">Active</Tag>
            ) : (
              <Tag tone="muted">Inactive</Tag>
            )}
          </div>
          {c.parent && (
            <div className="text-sm text-zinc-500">
              Subcommittee of{" "}
              <span className="text-zinc-700">{c.parent.name}</span>
            </div>
          )}
        </div>
        <button
          onClick={onEdit}
          className="px-3 py-1.5 rounded-md text-xs font-medium border border-zinc-200 text-zinc-700 bg-white hover:bg-zinc-50 transition-colors"
        >
          Edit
        </button>
      </div>
      {c.description && (
        <div className="mt-5 p-3 rounded-md text-sm text-zinc-700 leading-relaxed bg-zinc-50 border border-zinc-100">
          <RichTextDisplay html={c.description} />
        </div>
      )}
    </div>
  );
}

function MembersSection({
  committee,
  onAdd,
}: {
  committee: CommitteeWithRelations;
  onAdd: () => void;
}) {
  const navigate = useNavigate();
  const assignments = committee.assignments;

  // Sort: chairs first, then alphabetical by last name
  const sorted = [...assignments].sort((a, b) => {
    const aIsChair = /chair/i.test(a.position);
    const bIsChair = /chair/i.test(b.position);
    if (aIsChair && !bIsChair) return -1;
    if (!aIsChair && bIsChair) return 1;
    const aName = a.contact ? a.contact.last_name : "";
    const bName = b.contact ? b.contact.last_name : "";
    return aName.localeCompare(bName);
  });

  return (
    <Section
      title="Members"
      count={assignments.length}
      action={
        <button
          onClick={onAdd}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded-md text-zinc-600 hover:text-maroon-700 hover:bg-maroon-50 transition-colors"
        >
          <Plus size={12} />
          Add member
        </button>
      }
    >
      {assignments.length === 0 ? (
        <EmptyState>No members on this committee yet.</EmptyState>
      ) : (
        <div className="space-y-2">
          {sorted.map((a) => {
            const c = a.contact;
            if (!c) return null;
            return (
              <button
                key={a.id}
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
                  <Tag tone={/chair/i.test(a.position) ? "maroon" : "neutral"}>
                    {a.position}
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

function SubcommitteesSection({
  committee,
}: {
  committee: CommitteeWithRelations;
}) {
  const navigate = useNavigate();
  const subs = committee.subcommittees;

  return (
    <Section title="Subcommittees" count={subs.length}>
      <div className="space-y-2">
        {subs.map((s) => (
          <button
            key={s.id}
            onClick={() => navigate(`/committees/${s.id}`)}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-md text-left bg-white border border-zinc-200 hover:bg-zinc-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Layers size={14} className="text-zinc-500" />
              <span className="text-sm font-medium text-zinc-900">
                {s.name}
              </span>
              {s.status === "inactive" && <Tag tone="muted">Inactive</Tag>}
            </div>
            <ChevronRight size={13} className="text-zinc-300" />
          </button>
        ))}
      </div>
    </Section>
  );
}

function ProjectsSection({
  committeeId,
  onAdd,
}: {
  committeeId: string;
  onAdd: () => void;
}) {
  const navigate = useNavigate();
  const { data: projects } = useProjectsForCommittee(committeeId);
  return (
    <Section
      title="Projects"
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
        <EmptyState>
          No projects sponsored by this committee yet.
        </EmptyState>
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
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium text-zinc-900 truncate">
                    {p.name}
                  </span>
                </div>
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
  committeeId,
  onAdd,
}: {
  committeeId: string;
  onAdd: () => void;
}) {
  const navigate = useNavigate();
  const { data: interactions } = useInteractionsForCommittee(committeeId);
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
        <EmptyState>No interactions logged yet.</EmptyState>
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

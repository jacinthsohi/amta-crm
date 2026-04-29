import { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Plus,
  CheckSquare,
  Square,
  AlertCircle,
  CircleDashed,
  FolderKanban,
} from "lucide-react";
import { useProject, type ProjectWithRelations } from "./hooks";
import { useInteractionsForProject } from "@/features/interactions/hooks";
import { Avatar } from "@/components/Avatar";
import { Tag } from "@/components/Tag";
import { Section } from "@/components/Section";
import { RichTextDisplay } from "@/components/RichTextDisplay";
import { LoadingState, ErrorState, EmptyState } from "@/components/states";
import { formatDate } from "@/lib/format";
import { ProjectForm } from "./ProjectForm";
import { TaskForm } from "@/features/tasks/TaskForm";
import { InteractionForm } from "@/features/interactions/InteractionForm";
import type { Task } from "@/lib/database.types";

function statusTone(s: ProjectWithRelations["status"]) {
  if (s === "active") return "maroon" as const;
  if (s === "completed") return "success" as const;
  if (s === "on_hold") return "warn" as const;
  return "muted" as const;
}

function statusLabel(s: ProjectWithRelations["status"]) {
  if (s === "on_hold") return "On hold";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: project, isLoading, error, refetch } = useProject(id);

  const [editOpen, setEditOpen] = useState(false);
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>();
  const [interactionOpen, setInteractionOpen] = useState(false);

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!project) {
    return (
      <div className="px-8 py-9">
        <p className="text-sm text-zinc-600">
          That project could not be found.
        </p>
        <Link to="/projects" className="text-xs text-maroon-700 hover:underline">
          ← Back to projects
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <div className="px-8 py-3 flex items-center gap-2 text-sm border-b border-zinc-200">
        <button
          onClick={() => navigate("/projects")}
          className="flex items-center gap-1 text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          <ChevronLeft size={15} />
          <span>Projects</span>
        </button>
        <ChevronRight size={13} className="text-zinc-300" />
        <span className="text-zinc-900 font-medium">{project.name}</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        <Hero project={project} onEdit={() => setEditOpen(true)} />
        <div className="px-8 py-7">
          <TasksSection
            project={project}
            onAdd={() => {
              setEditingTask(undefined);
              setTaskFormOpen(true);
            }}
            onEditTask={(t) => {
              setEditingTask(t);
              setTaskFormOpen(true);
            }}
          />
          <InteractionsSection
            projectId={project.id}
            onAdd={() => setInteractionOpen(true)}
          />
        </div>
      </div>

      <ProjectForm
        open={editOpen}
        onClose={() => setEditOpen(false)}
        initialProject={project}
      />
      <TaskForm
        open={taskFormOpen}
        onClose={() => {
          setTaskFormOpen(false);
          setEditingTask(undefined);
        }}
        initialTask={editingTask}
        defaultProjectId={project.id}
      />
      <InteractionForm
        open={interactionOpen}
        onClose={() => setInteractionOpen(false)}
      />
    </div>
  );
}

function Hero({
  project: p,
  onEdit,
}: {
  project: ProjectWithRelations;
  onEdit: () => void;
}) {
  const navigate = useNavigate();
  return (
    <div className="px-8 pt-8 pb-6 border-b border-zinc-200">
      <div className="flex items-start gap-5">
        <div className="flex items-center justify-center w-16 h-16 rounded-xl bg-maroon-50 border border-maroon-100 shrink-0">
          <FolderKanban size={26} className="text-maroon-700" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <h1 className="text-[24px] font-semibold tracking-tight text-zinc-900">
              {p.name}
            </h1>
            <Tag tone={statusTone(p.status)}>{statusLabel(p.status)}</Tag>
            {p.priority === "high" && <Tag tone="warn">High priority</Tag>}
          </div>
          <div className="flex items-center gap-5 text-sm text-zinc-600 flex-wrap">
            {p.owner && (
              <button
                onClick={() => navigate(`/contacts/${p.owner!.id}`)}
                className="inline-flex items-center gap-1.5 hover:text-maroon-700 transition-colors"
              >
                <Avatar contact={p.owner} size={18} />
                <span>
                  {p.owner.first_name} {p.owner.last_name}
                </span>
                <span className="text-xs text-zinc-400">owner</span>
              </button>
            )}
            {p.committee && (
              <button
                onClick={() => navigate(`/committees/${p.committee!.id}`)}
                className="inline-flex items-center gap-1.5 hover:text-maroon-700 transition-colors"
              >
                <span className="text-xs text-zinc-400">Committee:</span>
                <span>{p.committee.name}</span>
              </button>
            )}
            {p.event && (
              <button
                onClick={() => navigate(`/events/${p.event!.id}`)}
                className="inline-flex items-center gap-1.5 hover:text-maroon-700 transition-colors"
              >
                <span className="text-xs text-zinc-400">Event:</span>
                <span>{p.event.name}</span>
              </button>
            )}
            {p.target_completion_date && (
              <span className="inline-flex items-center gap-1.5">
                <Calendar size={13} className="text-zinc-400" />
                Target {formatDate(p.target_completion_date)}
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
      {p.description && (
        <div className="mt-5 p-3 rounded-md text-sm text-zinc-700 leading-relaxed bg-zinc-50 border border-zinc-100">
          <RichTextDisplay html={p.description} />
        </div>
      )}
    </div>
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
  project,
  onAdd,
  onEditTask,
}: {
  project: ProjectWithRelations;
  onAdd: () => void;
  onEditTask: (t: Task) => void;
}) {
  const tasks = project.tasks;
  return (
    <Section
      title="Tasks"
      count={tasks.length}
      action={
        <button
          onClick={onAdd}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded-md text-zinc-600 hover:text-maroon-700 hover:bg-maroon-50 transition-colors"
        >
          <Plus size={12} />
          Add task
        </button>
      }
    >
      {tasks.length === 0 ? (
        <EmptyState>No tasks yet. Add the first one.</EmptyState>
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
  projectId,
  onAdd,
}: {
  projectId: string;
  onAdd: () => void;
}) {
  const navigate = useNavigate();
  const { data: interactions } = useInteractionsForProject(projectId);
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
          No interactions logged for this project yet.
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

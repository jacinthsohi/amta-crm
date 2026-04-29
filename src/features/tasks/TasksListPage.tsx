import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Search,
  CheckSquare,
  Square,
  AlertCircle,
  CircleDashed,
} from "lucide-react";
import { useTasks, type TaskWithRelations } from "./hooks";
import { useAuth } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";
import { Tag } from "@/components/Tag";
import { LoadingState, ErrorState, EmptyState } from "@/components/states";
import { PrimaryButton } from "@/components/Buttons";
import { TaskForm } from "./TaskForm";
import { formatDate } from "@/lib/format";
import type { Task } from "@/lib/database.types";

type AssigneeFilter = "all" | "me";
type StatusFilter = "all" | "todo" | "in_progress" | "blocked" | "done";

const ASSIGNEE_FILTERS: { id: AssigneeFilter; label: string }[] = [
  { id: "me", label: "Mine" },
  { id: "all", label: "Everyone" },
];

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "todo", label: "To do" },
  { id: "in_progress", label: "In progress" },
  { id: "blocked", label: "Blocked" },
  { id: "done", label: "Done" },
];

function statusIcon(s: Task["status"]) {
  if (s === "done")
    return <CheckSquare size={14} className="text-green-600" />;
  if (s === "in_progress")
    return <CircleDashed size={14} className="text-maroon-700" />;
  if (s === "blocked")
    return <AlertCircle size={14} className="text-amber-600" />;
  return <Square size={14} className="text-zinc-400" />;
}

function priorityTone(p: Task["priority"]) {
  if (p === "high") return "warn" as const;
  if (p === "low") return "muted" as const;
  return "neutral" as const;
}

export default function TasksListPage() {
  const navigate = useNavigate();
  const { contact } = useAuth();
  const { data: tasks, isLoading, error, refetch } = useTasks();

  const [assignee, setAssignee] = useState<AssigneeFilter>("me");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>();

  const filtered = useMemo(() => {
    if (!tasks) return [];
    let result = tasks;
    if (assignee === "me" && contact) {
      result = result.filter((t) => t.assigned_to === contact.id);
    }
    if (status !== "all") {
      result = result.filter((t) => t.status === status);
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter((t) => t.title.toLowerCase().includes(q));
    }
    return result;
  }, [tasks, assignee, status, query, contact]);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <div className="px-8 pt-7 pb-5 border-b border-zinc-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight text-zinc-900">
              Tasks
            </h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              What's on your plate, and what the team is working on.
            </p>
          </div>
          <PrimaryButton
            onClick={() => {
              setEditingTask(undefined);
              setFormOpen(true);
            }}
          >
            <span className="inline-flex items-center gap-1.5">
              <Plus size={14} />
              New task
            </span>
          </PrimaryButton>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm flex-1 max-w-md bg-white border border-zinc-200">
            <Search size={14} className="text-zinc-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="flex-1 outline-none bg-transparent text-zinc-800 placeholder:text-zinc-400"
            />
          </div>
          <div className="flex items-center gap-1">
            {ASSIGNEE_FILTERS.map((f) => {
              const active = assignee === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setAssignee(f.id)}
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
          <div className="flex items-center gap-1">
            {STATUS_FILTERS.map((f) => {
              const active = status === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setStatus(f.id)}
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
          <EmptyState>No tasks match these filters.</EmptyState>
        ) : (
          <div className="divide-y divide-zinc-100">
            {filtered.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                onClick={() => {
                  setEditingTask(t);
                  setFormOpen(true);
                }}
                onProjectClick={(projectId) =>
                  navigate(`/projects/${projectId}`)
                }
                onContactClick={(contactId) =>
                  navigate(`/contacts/${contactId}`)
                }
              />
            ))}
          </div>
        )}
      </div>

      <TaskForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingTask(undefined);
        }}
        initialTask={editingTask}
      />
    </div>
  );
}

function TaskRow({
  task: t,
  onClick,
  onProjectClick,
  onContactClick,
}: {
  task: TaskWithRelations;
  onClick: () => void;
  onProjectClick: (id: string) => void;
  onContactClick: (id: string) => void;
}) {
  return (
    <div
      onClick={onClick}
      className="flex items-center justify-between px-8 py-3 hover:bg-zinc-50 cursor-pointer transition-colors group"
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {statusIcon(t.status)}
        <div className="flex flex-col min-w-0">
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
          {t.project && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onProjectClick(t.project!.id);
              }}
              className="text-xs text-zinc-500 hover:text-maroon-700 transition-colors text-left truncate"
            >
              in {t.project.name}
            </button>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <Tag tone={priorityTone(t.priority)}>
          {t.priority.charAt(0).toUpperCase() + t.priority.slice(1)}
        </Tag>
        {t.due_date && (
          <span className="text-xs text-zinc-500">{formatDate(t.due_date)}</span>
        )}
        {t.assignee ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onContactClick(t.assignee!.id);
            }}
            className="hover:opacity-80 transition-opacity"
            title={`${t.assignee.first_name} ${t.assignee.last_name}`}
          >
            <Avatar contact={t.assignee} size={24} />
          </button>
        ) : (
          <span className="text-xs text-zinc-400 italic">Unassigned</span>
        )}
      </div>
    </div>
  );
}

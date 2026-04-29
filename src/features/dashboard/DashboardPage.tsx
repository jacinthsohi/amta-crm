import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckSquare,
  Square,
  AlertCircle,
  CircleDashed,
  Calendar,
  FolderKanban,
  MessagesSquare,
  ChevronRight,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useContacts } from "@/features/contacts/hooks";
import { useEvents } from "@/features/events/hooks";
import { useProjects } from "@/features/projects/hooks";
import { useTasks, type TaskWithRelations } from "@/features/tasks/hooks";
import { useInteractions } from "@/features/interactions/hooks";
import { Avatar } from "@/components/Avatar";
import { Tag } from "@/components/Tag";
import { formatDate } from "@/lib/format";
import type { Task, Project, Event, Contact } from "@/lib/database.types";

function greetingForTime(): string {
  const h = new Date().getHours();
  if (h < 5) return "Up late";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Working late";
}

function isOverdue(due: string | null | undefined): boolean {
  if (!due) return false;
  return new Date(due) < new Date(new Date().toDateString());
}

function isCurrentBoard(c: Contact & { category_names?: string[] }): boolean {
  return (c.category_names ?? []).includes("Current Board Member");
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { contact } = useAuth();

  const { data: contacts } = useContacts();
  const { data: events } = useEvents();
  const { data: projects } = useProjects();
  const { data: tasks } = useTasks();
  const { data: interactions } = useInteractions();

  // ---- Stats
  const stats = useMemo(() => {
    return {
      contacts: contacts?.length ?? 0,
      currentBoard: contacts?.filter(isCurrentBoard).length ?? 0,
      activeProjects:
        projects?.filter((p) => p.status === "active").length ?? 0,
      upcomingEvents:
        events?.filter((e) => e.status === "upcoming").length ?? 0,
    };
  }, [contacts, events, projects]);

  // ---- My tasks: open tasks assigned to me, overdue first then by due date
  const myTasks = useMemo(() => {
    if (!tasks) return [];
    const myId = contact?.id;
    const open = tasks.filter(
      (t) =>
        (t.status === "todo" || t.status === "in_progress" || t.status === "blocked") &&
        (!myId || t.assigned_to === myId),
    );
    open.sort((a, b) => {
      const aOver = isOverdue(a.due_date);
      const bOver = isOverdue(b.due_date);
      if (aOver !== bOver) return aOver ? -1 : 1;
      // Sort by due date asc; null due dates go last
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date.localeCompare(b.due_date);
    });
    return open.slice(0, 5);
  }, [tasks, contact]);

  // ---- Upcoming events
  const upcomingEvents = useMemo(() => {
    if (!events) return [];
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = events.filter(
      (e) => e.start_date >= today && e.status !== "cancelled",
    );
    upcoming.sort((a, b) => a.start_date.localeCompare(b.start_date));
    return upcoming.slice(0, 4);
  }, [events]);

  // ---- Active projects (mine, with fallback to org-wide if mine is empty)
  const activeProjects = useMemo(() => {
    if (!projects) return [];
    const myId = contact?.id;
    let active = projects.filter(
      (p) => p.status === "active" || p.status === "planning",
    );
    if (myId) {
      const mine = active.filter((p) => p.owner_id === myId);
      if (mine.length > 0) active = mine;
    }
    active.sort((a, b) => {
      if (!a.target_completion_date && !b.target_completion_date) return 0;
      if (!a.target_completion_date) return 1;
      if (!b.target_completion_date) return -1;
      return a.target_completion_date.localeCompare(b.target_completion_date);
    });
    return active.slice(0, 4);
  }, [projects, contact]);

  // ---- Recent interactions
  const recentInteractions = useMemo(() => {
    if (!interactions) return [];
    return interactions.slice(0, 5);
  }, [interactions]);

  return (
    <div className="px-8 py-8 overflow-y-auto h-screen">
      <div className="max-w-5xl">
        {/* Greeting */}
        <div className="mb-6">
          <h1 className="text-[26px] font-semibold tracking-tight text-zinc-900">
            {greetingForTime()}
            {contact ? `, ${contact.first_name}` : ""}.
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-4 gap-3 mb-8">
          <StatCard
            label="Contacts"
            value={stats.contacts}
            onClick={() => navigate("/contacts")}
          />
          <StatCard
            label="Current board"
            value={stats.currentBoard}
            onClick={() => navigate("/contacts")}
          />
          <StatCard
            label="Active projects"
            value={stats.activeProjects}
            onClick={() => navigate("/projects")}
          />
          <StatCard
            label="Upcoming events"
            value={stats.upcomingEvents}
            onClick={() => navigate("/events")}
          />
        </div>

        {/* Two-column card grid */}
        <div className="grid grid-cols-2 gap-5">
          <MyTasksCard tasks={myTasks} hasAuthContact={Boolean(contact)} />
          <UpcomingEventsCard events={upcomingEvents} />
          <ActiveProjectsCard projects={activeProjects} />
          <RecentInteractionsCard interactions={recentInteractions} />
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  onClick,
}: {
  label: string;
  value: number | string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-md p-3 bg-white border border-zinc-200 text-left hover:bg-zinc-50 hover:border-zinc-300 transition-colors group"
    >
      <div className="text-[11px] uppercase tracking-wider text-zinc-500 mb-0.5">
        {label}
      </div>
      <div className="flex items-end justify-between">
        <div className="text-xl font-semibold text-zinc-900">{value}</div>
        <ArrowRight
          size={13}
          className="text-zinc-300 group-hover:text-maroon-700 transition-colors"
        />
      </div>
    </button>
  );
}

// =============================================================================
// Cards
// =============================================================================

function Card({
  title,
  ctaLabel,
  ctaHref,
  children,
}: {
  title: string;
  ctaLabel: string;
  ctaHref: string;
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-100">
        <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
        <button
          onClick={() => navigate(ctaHref)}
          className="text-xs text-zinc-500 hover:text-maroon-700 transition-colors inline-flex items-center gap-0.5"
        >
          {ctaLabel}
          <ChevronRight size={12} />
        </button>
      </div>
      <div className="px-1.5 py-1.5">{children}</div>
    </div>
  );
}

function CardEmpty({
  message,
  ctaLabel,
  ctaHref,
}: {
  message: string;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  const navigate = useNavigate();
  return (
    <div className="px-3 py-7 text-center">
      <div className="text-xs text-zinc-500">{message}</div>
      {ctaLabel && ctaHref && (
        <button
          onClick={() => navigate(ctaHref)}
          className="mt-2 text-xs text-maroon-700 hover:underline"
        >
          {ctaLabel} →
        </button>
      )}
    </div>
  );
}

function taskStatusIcon(s: Task["status"]) {
  if (s === "done")
    return <CheckSquare size={14} className="text-green-600 shrink-0" />;
  if (s === "in_progress")
    return <CircleDashed size={14} className="text-maroon-700 shrink-0" />;
  if (s === "blocked")
    return <AlertCircle size={14} className="text-amber-600 shrink-0" />;
  return <Square size={14} className="text-zinc-400 shrink-0" />;
}

function MyTasksCard({
  tasks,
  hasAuthContact,
}: {
  tasks: TaskWithRelations[];
  hasAuthContact: boolean;
}) {
  const navigate = useNavigate();
  return (
    <Card title="My tasks" ctaLabel="All tasks" ctaHref="/tasks">
      {tasks.length === 0 ? (
        <CardEmpty
          message={
            hasAuthContact
              ? "Nothing on your plate. Nicely done."
              : "No open tasks. Create one to get started."
          }
          ctaLabel={hasAuthContact ? undefined : "Go to tasks"}
          ctaHref={hasAuthContact ? undefined : "/tasks"}
        />
      ) : (
        <div className="divide-y divide-zinc-100">
          {tasks.map((t) => {
            const overdue = isOverdue(t.due_date);
            const target = t.project_id ? `/projects/${t.project_id}` : "/tasks";
            return (
              <button
                key={t.id}
                onClick={() => navigate(target)}
                className="w-full flex items-center justify-between px-2.5 py-2 hover:bg-zinc-50 transition-colors text-left rounded"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {taskStatusIcon(t.status)}
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm text-zinc-900 truncate">
                      {t.title}
                    </span>
                    {t.project && (
                      <span className="text-xs text-zinc-500 truncate">
                        in {t.project.name}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  {t.priority === "high" && <Tag tone="warn">High</Tag>}
                  {t.due_date && (
                    <span
                      className={
                        "text-xs " + (overdue ? "text-red-600 font-medium" : "text-zinc-500")
                      }
                    >
                      {overdue ? "Overdue " : ""}
                      {formatDate(t.due_date)}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function UpcomingEventsCard({ events }: { events: Event[] }) {
  const navigate = useNavigate();
  return (
    <Card title="Upcoming events" ctaLabel="All events" ctaHref="/events">
      {events.length === 0 ? (
        <CardEmpty
          message="Nothing coming up. Plan a tournament?"
          ctaLabel="Go to events"
          ctaHref="/events"
        />
      ) : (
        <div className="divide-y divide-zinc-100">
          {events.map((e) => (
            <button
              key={e.id}
              onClick={() => navigate(`/events/${e.id}`)}
              className="w-full flex items-center justify-between px-2.5 py-2 hover:bg-zinc-50 transition-colors text-left rounded"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-7 h-7 rounded-md shrink-0"
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
                    <Calendar size={10} className="text-zinc-400" />
                    {formatDate(e.start_date)}
                    {e.location_city ? ` · ${e.location_city}` : ""}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

function ActiveProjectsCard({ projects }: { projects: Project[] }) {
  const navigate = useNavigate();
  return (
    <Card title="Active projects" ctaLabel="All projects" ctaHref="/projects">
      {projects.length === 0 ? (
        <CardEmpty
          message="No active projects. Start something?"
          ctaLabel="Go to projects"
          ctaHref="/projects"
        />
      ) : (
        <div className="divide-y divide-zinc-100">
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => navigate(`/projects/${p.id}`)}
              className="w-full flex items-center justify-between px-2.5 py-2 hover:bg-zinc-50 transition-colors text-left rounded"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <FolderKanban size={14} className="text-zinc-500 shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium text-zinc-900 truncate">
                    {p.name}
                  </span>
                  {p.target_completion_date && (
                    <span className="text-xs text-zinc-500">
                      Target {formatDate(p.target_completion_date)}
                    </span>
                  )}
                </div>
              </div>
              <div className="shrink-0 ml-2">
                {p.priority === "high" && <Tag tone="warn">High</Tag>}
              </div>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

function RecentInteractionsCard({
  interactions,
}: {
  interactions: { id: string; subject: string; type: string; occurred_at: string; participants: { contact: Contact | null }[] }[];
}) {
  const navigate = useNavigate();
  return (
    <Card
      title="Recent interactions"
      ctaLabel="All interactions"
      ctaHref="/interactions"
    >
      {interactions.length === 0 ? (
        <CardEmpty
          message="No interactions logged yet. Log your first?"
          ctaLabel="Go to interactions"
          ctaHref="/interactions"
        />
      ) : (
        <div className="divide-y divide-zinc-100">
          {interactions.map((i) => {
            const participantContacts = i.participants
              .map((p) => p.contact)
              .filter((c): c is NonNullable<typeof c> => Boolean(c))
              .slice(0, 3);
            return (
              <button
                key={i.id}
                onClick={() => navigate(`/interactions/${i.id}`)}
                className="w-full flex items-center justify-between px-2.5 py-2 hover:bg-zinc-50 transition-colors text-left rounded"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <MessagesSquare
                    size={14}
                    className="text-zinc-500 shrink-0"
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium text-zinc-900 truncate">
                      {i.subject}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {i.type} · {formatDate(i.occurred_at)}
                    </span>
                  </div>
                </div>
                {participantContacts.length > 0 && (
                  <div className="flex -space-x-1 shrink-0 ml-2">
                    {participantContacts.map((c) => (
                      <Avatar key={c.id} contact={c} size={20} />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
}

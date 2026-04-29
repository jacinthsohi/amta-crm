import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, ChevronRight, FolderKanban } from "lucide-react";
import { useProjects } from "./hooks";
import { Tag } from "@/components/Tag";
import { LoadingState, ErrorState, EmptyState } from "@/components/states";
import { PrimaryButton } from "@/components/Buttons";
import { ProjectForm } from "./ProjectForm";
import { formatDate, htmlToPlainText } from "@/lib/format";
import type { Project } from "@/lib/database.types";

type StatusFilter = "all" | "planning" | "active" | "on_hold" | "completed";

const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "planning", label: "Planning" },
  { id: "on_hold", label: "On hold" },
  { id: "completed", label: "Completed" },
];

function statusTone(s: Project["status"]) {
  if (s === "active") return "maroon" as const;
  if (s === "planning") return "neutral" as const;
  if (s === "completed") return "success" as const;
  return "muted" as const;
}

function statusLabel(s: Project["status"]) {
  if (s === "on_hold") return "On hold";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function priorityTone(p: Project["priority"]) {
  if (p === "high") return "warn" as const;
  if (p === "medium") return "neutral" as const;
  return "muted" as const;
}

export default function ProjectsListPage() {
  const navigate = useNavigate();
  const { data: projects, isLoading, error, refetch } = useProjects();

  const [filter, setFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!projects) return [];
    let result = projects;
    if (filter !== "all") result = result.filter((p) => p.status === filter);
    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter((p) => p.name.toLowerCase().includes(q));
    }
    return result;
  }, [projects, filter, query]);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <div className="px-8 pt-7 pb-5 border-b border-zinc-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight text-zinc-900">
              Projects
            </h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              Initiatives and priorities the board is working on.
            </p>
          </div>
          <PrimaryButton onClick={() => setFormOpen(true)}>
            <span className="inline-flex items-center gap-1.5">
              <Plus size={14} />
              New project
            </span>
          </PrimaryButton>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm flex-1 max-w-md bg-white border border-zinc-200">
            <Search size={14} className="text-zinc-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name…"
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
          <EmptyState>No projects match these filters.</EmptyState>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-200">
                <th className="text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500 px-8 py-2.5">
                  Name
                </th>
                <th className="text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500 py-2.5">
                  Status
                </th>
                <th className="text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500 py-2.5">
                  Priority
                </th>
                <th className="text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500 py-2.5">
                  Target
                </th>
                <th className="px-8"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => navigate(`/projects/${p.id}`)}
                  className="cursor-pointer transition-colors group border-b border-zinc-100 hover:bg-zinc-50"
                >
                  <td className="px-8 py-3">
                    <div className="flex items-center gap-3">
                      <FolderKanban size={15} className="text-zinc-500" />
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-zinc-900">
                          {p.name}
                        </span>
                        {p.description && (
                          <span className="text-xs text-zinc-500 truncate max-w-md">
                            {htmlToPlainText(p.description)}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-3">
                    <Tag tone={statusTone(p.status)}>{statusLabel(p.status)}</Tag>
                  </td>
                  <td className="py-3">
                    <Tag tone={priorityTone(p.priority)}>
                      {p.priority.charAt(0).toUpperCase() + p.priority.slice(1)}
                    </Tag>
                  </td>
                  <td className="py-3 text-sm text-zinc-600">
                    {p.target_completion_date ? (
                      formatDate(p.target_completion_date)
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="px-8 py-3">
                    <ChevronRight
                      size={15}
                      className="text-zinc-300 group-hover:text-zinc-500 transition-colors"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ProjectForm open={formOpen} onClose={() => setFormOpen(false)} />
    </div>
  );
}

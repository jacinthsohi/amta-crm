import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, ChevronRight, ExternalLink } from "lucide-react";
import { usePrograms } from "./hooks";
import { Tag } from "@/components/Tag";
import { LoadingState, ErrorState, EmptyState } from "@/components/states";
import { PrimaryButton } from "@/components/Buttons";
import { ProgramForm } from "./ProgramForm";
import type { Program } from "@/lib/database.types";

type FilterId = "all" | "active" | "inactive";

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "inactive", label: "Inactive" },
];

export default function ProgramsListPage() {
  const navigate = useNavigate();
  const { data: programs, isLoading, error, refetch } = usePrograms();

  const [filter, setFilter] = useState<FilterId>("all");
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!programs) return [];
    let result = programs;
    if (filter !== "all") result = result.filter((p) => p.status === filter);
    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.short_name.toLowerCase().includes(q) ||
          (p.city ?? "").toLowerCase().includes(q),
      );
    }
    return result;
  }, [programs, filter, query]);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <div className="px-8 pt-7 pb-5 border-b border-zinc-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight text-zinc-900">
              Programs
            </h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              Member institutions — schools that compete in AMTA tournaments.
            </p>
          </div>
          <PrimaryButton onClick={() => setFormOpen(true)}>
            <span className="inline-flex items-center gap-1.5">
              <Plus size={14} />
              New program
            </span>
          </PrimaryButton>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm flex-1 max-w-md bg-white border border-zinc-200">
            <Search size={14} className="text-zinc-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or city…"
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
        ) : (
          <ProgramsTable
            rows={filtered}
            onSelect={(id) => navigate(`/programs/${id}`)}
          />
        )}
      </div>

      <ProgramForm open={formOpen} onClose={() => setFormOpen(false)} />
    </div>
  );
}

function ProgramsTable({
  rows,
  onSelect,
}: {
  rows: Program[];
  onSelect: (id: string) => void;
}) {
  if (rows.length === 0) {
    return <EmptyState>No programs match these filters.</EmptyState>;
  }
  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-zinc-200">
          <th className="text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500 px-8 py-2.5">
            Name
          </th>
          <th className="text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500 py-2.5">
            Short
          </th>
          <th className="text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500 py-2.5">
            Location
          </th>
          <th className="text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500 py-2.5">
            Joined
          </th>
          <th className="text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500 py-2.5">
            Status
          </th>
          <th className="px-8"></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((p) => (
          <tr
            key={p.id}
            onClick={() => onSelect(p.id)}
            className="cursor-pointer transition-colors group border-b border-zinc-100 hover:bg-zinc-50"
          >
            <td className="px-8 py-3">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-zinc-900">
                  {p.name}
                </span>
                {p.website && (
                  <a
                    href={
                      p.website.startsWith("http")
                        ? p.website
                        : `https://${p.website}`
                    }
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-maroon-700"
                  >
                    {p.website}
                    <ExternalLink size={10} />
                  </a>
                )}
              </div>
            </td>
            <td className="py-3 text-sm text-zinc-600">{p.short_name}</td>
            <td className="py-3 text-sm text-zinc-600">
              {p.city && p.state ? (
                <span>
                  {p.city}, {p.state}
                </span>
              ) : (
                <span className="text-zinc-400">—</span>
              )}
            </td>
            <td className="py-3 text-sm text-zinc-600">
              {p.joined_year ?? <span className="text-zinc-400">—</span>}
            </td>
            <td className="py-3">
              {p.status === "active" ? (
                <Tag tone="success">Active</Tag>
              ) : (
                <Tag tone="muted">Inactive</Tag>
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
  );
}

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, ChevronRight, ExternalLink } from "lucide-react";
import {
  useInfinitePrograms,
  useAllPrograms,
  PROGRAMS_PAGE_SIZE,
} from "./hooks";
import { Tag } from "@/components/Tag";
import { LoadingState, ErrorState, EmptyState } from "@/components/states";
import { PrimaryButton } from "@/components/Buttons";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import type { CsvColumnDef } from "@/lib/csv";
import { ProgramForm } from "./ProgramForm";
import type { Program } from "@/lib/database.types";

type FilterId = "all" | "active" | "inactive";

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "inactive", label: "Inactive" },
];

// =============================================================================
// CSV columns
// =============================================================================
const PROGRAM_EXPORT_COLUMNS: CsvColumnDef<Program>[] = [
  { key: "name", label: "Name", value: (p) => p.name },
  { key: "short_name", label: "Short Name", value: (p) => p.short_name },
  { key: "city", label: "City", value: (p) => p.city },
  { key: "state", label: "State", value: (p) => p.state },
  { key: "website", label: "Website", value: (p) => p.website },
  { key: "joined_year", label: "Joined Year", value: (p) => p.joined_year },
  { key: "status", label: "Status", value: (p) => p.status },
  { key: "id", label: "Program ID", value: (p) => p.id },
  { key: "created_at", label: "Created At", value: (p) => formatDate(p.created_at) },
  { key: "updated_at", label: "Last Updated", value: (p) => formatDate(p.updated_at) },
];

const PROGRAM_DEFAULT_KEYS = [
  "name",
  "short_name",
  "city",
  "state",
  "website",
  "joined_year",
  "status",
];

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toISOString().slice(0, 10);
}

// =============================================================================
// Page
// =============================================================================
export default function ProgramsListPage() {
  const navigate = useNavigate();

  const [filter, setFilter] = useState<FilterId>("all");
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);

  // The user is "actively narrowing" if they have search text or a non-default
  // filter applied. In that mode we need ALL programs loaded so the filter
  // searches across the whole dataset — paginated browsing is only for the
  // unfiltered "show me all programs" case.
  const isNarrowing = filter !== "all" || query.trim().length > 0;

  // Two queries running in parallel:
  // - Infinite query for the default browse experience (paginated)
  // - All-rows query that activates only when we need it (narrowing OR exporting)
  const infinite = useInfinitePrograms();
  const all = useAllPrograms(isNarrowing);

  const isLoading = isNarrowing ? all.isLoading : infinite.isLoading;
  const error = isNarrowing ? all.error : infinite.error;
  const refetch = isNarrowing ? all.refetch : infinite.refetch;

  // Flatten paginated pages into a single list, capping each page at PAGE_SIZE
  // (each fetched page actually has PAGE_SIZE+1 rows; the +1 is just a peek for
  // the next-page detection logic).
  const paginatedRows: Program[] = useMemo(() => {
    if (!infinite.data) return [];
    return infinite.data.pages.flatMap((page) =>
      page.slice(0, PROGRAMS_PAGE_SIZE),
    );
  }, [infinite.data]);

  const sourceRows: Program[] = isNarrowing ? all.data ?? [] : paginatedRows;

  const filtered = useMemo(() => {
    let result = sourceRows;
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
  }, [sourceRows, filter, query]);

  // For export: use the all-rows result if we have it; otherwise fall back to
  // the paginated rows. The button below also asks the all-rows query to run
  // when exporting so we always get the complete set.
  const exportRows = all.data ?? filtered;
  const exportPending = all.isFetching && !all.data;

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
          <div className="flex items-center gap-2">
            <ExportCsvButton
              rows={exportRows}
              columns={PROGRAM_EXPORT_COLUMNS}
              filenamePrefix="amta-programs"
              defaultSelectedKeys={PROGRAM_DEFAULT_KEYS}
              disabled={isLoading || exportPending}
            />
            <PrimaryButton onClick={() => setFormOpen(true)}>
              <span className="inline-flex items-center gap-1.5">
                <Plus size={14} />
                New program
              </span>
            </PrimaryButton>
          </div>
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
          <>
            <ProgramsTable
              rows={filtered}
              onSelect={(id) => navigate(`/programs/${id}`)}
            />

            {/* Load-more footer — only shown when in browse mode (no filter/search) */}
            {!isNarrowing && (
              <div className="px-8 py-5 flex flex-col items-center gap-2 border-t border-zinc-100">
                {infinite.hasNextPage ? (
                  <button
                    onClick={() => infinite.fetchNextPage()}
                    disabled={infinite.isFetchingNextPage}
                    className="px-4 py-1.5 rounded-md text-xs font-medium border border-zinc-200 text-zinc-700 hover:bg-zinc-50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                  >
                    {infinite.isFetchingNextPage
                      ? "Loading…"
                      : `Load more (${paginatedRows.length} loaded)`}
                  </button>
                ) : paginatedRows.length > 0 ? (
                  <span className="text-xs text-zinc-400">
                    All {paginatedRows.length} programs loaded
                  </span>
                ) : null}
              </div>
            )}
          </>
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

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, ChevronRight, Calendar, MapPin } from "lucide-react";
import { useEvents } from "./hooks";
import { Tag } from "@/components/Tag";
import { LoadingState, ErrorState, EmptyState } from "@/components/states";
import { PrimaryButton } from "@/components/Buttons";
import { EventForm } from "./EventForm";
import { formatDate } from "@/lib/format";
import type { Event } from "@/lib/database.types";

type TypeFilter = "all" | "tournament" | "board_meeting";
type StatusFilter = "all" | "upcoming" | "in_progress" | "completed";

const TYPE_FILTERS: { id: TypeFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "tournament", label: "Tournaments" },
  { id: "board_meeting", label: "Board meetings" },
];

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All status" },
  { id: "upcoming", label: "Upcoming" },
  { id: "in_progress", label: "In progress" },
  { id: "completed", label: "Completed" },
];

function statusTone(s: Event["status"]) {
  if (s === "upcoming") return "success" as const;
  if (s === "in_progress") return "maroon" as const;
  if (s === "completed") return "muted" as const;
  return "muted" as const;
}

function statusLabel(s: Event["status"]) {
  if (s === "in_progress") return "In progress";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function eventDateRange(e: Event) {
  if (!e.end_date || e.end_date === e.start_date) return formatDate(e.start_date);
  return `${formatDate(e.start_date)} – ${formatDate(e.end_date)}`;
}

export default function EventsListPage() {
  const navigate = useNavigate();
  const { data: events, isLoading, error, refetch } = useEvents();

  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!events) return [];
    let result = events;
    if (typeFilter !== "all")
      result = result.filter((e) => e.event_type === typeFilter);
    if (statusFilter !== "all")
      result = result.filter((e) => e.status === statusFilter);
    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          (e.location_city ?? "").toLowerCase().includes(q),
      );
    }
    return result;
  }, [events, typeFilter, statusFilter, query]);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <div className="px-8 pt-7 pb-5 border-b border-zinc-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight text-zinc-900">
              Events
            </h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              Tournaments, board meetings, and other AMTA gatherings.
            </p>
          </div>
          <PrimaryButton onClick={() => setFormOpen(true)}>
            <span className="inline-flex items-center gap-1.5">
              <Plus size={14} />
              New event
            </span>
          </PrimaryButton>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
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
            {TYPE_FILTERS.map((f) => {
              const active = typeFilter === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setTypeFilter(f.id)}
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
              const active = statusFilter === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setStatusFilter(f.id)}
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
          <EmptyState>No events match these filters.</EmptyState>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-200">
                <th className="text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500 px-8 py-2.5">
                  Event
                </th>
                <th className="text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500 py-2.5">
                  Type
                </th>
                <th className="text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500 py-2.5">
                  Dates
                </th>
                <th className="text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500 py-2.5">
                  Location
                </th>
                <th className="text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500 py-2.5">
                  Status
                </th>
                <th className="px-8"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr
                  key={e.id}
                  onClick={() => navigate(`/events/${e.id}`)}
                  className="cursor-pointer transition-colors group border-b border-zinc-100 hover:bg-zinc-50"
                >
                  <td className="px-8 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-md shrink-0"
                        style={{
                          background:
                            e.photo_banner_gradient ??
                            "linear-gradient(135deg, #70172a, #a82d4a)",
                        }}
                      />
                      <span className="text-sm font-medium text-zinc-900">
                        {e.name}
                      </span>
                    </div>
                  </td>
                  <td className="py-3">
                    {e.event_type === "tournament" ? (
                      <Tag tone="maroon">
                        {e.tournament_type
                          ? e.tournament_type.toUpperCase()
                          : "Tournament"}
                      </Tag>
                    ) : (
                      <Tag tone="neutral">Board meeting</Tag>
                    )}
                  </td>
                  <td className="py-3 text-sm text-zinc-600">
                    <div className="inline-flex items-center gap-1.5">
                      <Calendar size={12} className="text-zinc-400" />
                      {eventDateRange(e)}
                    </div>
                  </td>
                  <td className="py-3 text-sm text-zinc-600">
                    {e.location_city ? (
                      <div className="inline-flex items-center gap-1.5">
                        <MapPin size={12} className="text-zinc-400" />
                        {e.location_city}
                        {e.location_state ? `, ${e.location_state}` : ""}
                      </div>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="py-3">
                    <Tag tone={statusTone(e.status)}>{statusLabel(e.status)}</Tag>
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

      <EventForm open={formOpen} onClose={() => setFormOpen(false)} />
    </div>
  );
}

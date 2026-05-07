import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, ChevronRight } from "lucide-react";
import { useContacts, type ContactWithCategories } from "./hooks";
import { useProgramsLookup } from "@/lib/lookups";
import { Avatar } from "@/components/Avatar";
import { Tag } from "@/components/Tag";
import { LoadingState, ErrorState, EmptyState } from "@/components/states";
import { PrimaryButton } from "@/components/Buttons";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import type { CsvColumnDef } from "@/lib/csv";
import { useProgramAffiliationsByContact } from "./hooks-affiliations";
import { ContactForm } from "./ContactForm";

type FilterId = "all" | "current_board" | "alumni" | "donors" | "judges" | "coaches";

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "current_board", label: "Current Board" },
  { id: "alumni", label: "Alumni" },
  { id: "donors", label: "Donors" },
  { id: "judges", label: "Judges" },
  { id: "coaches", label: "Coaches" },
];

function isCurrentBoard(c: ContactWithCategories): boolean {
  return c.category_names.includes("Current Board Member");
}

// =============================================================================
// CSV columns. Order here is the order they appear in the picker AND in the
// exported CSV. `defaultSelectedKeys` below picks which are checked initially.
// =============================================================================
const CONTACT_EXPORT_COLUMNS: CsvColumnDef<ContactWithCategories>[] = [
  { key: "first_name", label: "First Name", value: (c) => c.first_name },
  { key: "last_name", label: "Last Name", value: (c) => c.last_name },
  { key: "pronouns", label: "Pronouns", value: (c) => c.pronouns },
  { key: "email", label: "Email", value: (c) => c.email },
  { key: "phone", label: "Phone", value: (c) => c.phone },
  { key: "categories", label: "Categories", value: (c) => c.category_names },
  { key: "standing", label: "Board Standing", value: (c) => c.standing },
  { key: "has_board_history", label: "Has Board History", value: (c) => c.has_board_history ? "Yes" : "No" },
  { key: "notes", label: "Notes (HTML stripped)", value: (c) => stripHtml(c.notes) },
  { key: "ai_summary", label: "AI Summary", value: (c) => c.ai_summary },
  { key: "ai_summary_generated_at", label: "AI Summary Generated", value: (c) => formatDate(c.ai_summary_generated_at) },
  { key: "id", label: "Contact ID", value: (c) => c.id },
  { key: "created_at", label: "Created At", value: (c) => formatDate(c.created_at) },
  { key: "updated_at", label: "Last Updated", value: (c) => formatDate(c.updated_at) },
];

// Default columns — the most common ones for mail merge / sharing
const CONTACT_DEFAULT_KEYS = [
  "first_name",
  "last_name",
  "pronouns",
  "email",
  "phone",
  "categories",
];

function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  // Strip tags, collapse whitespace. Good enough for export — original is
  // preserved in the DB for the in-app rich display.
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toISOString().slice(0, 10); // YYYY-MM-DD
}

export default function ContactsListPage() {
  const navigate = useNavigate();
  const { data: contacts, isLoading, error, refetch } = useContacts();

  const [filter, setFilter] = useState<FilterId>("all");
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!contacts) return [];
    let result = contacts;

    if (filter === "current_board") result = result.filter(isCurrentBoard);
    else if (filter === "alumni")
      result = result.filter((c) => c.category_names.includes("Alumni"));
    else if (filter === "donors")
      result = result.filter((c) => c.category_names.includes("Donor"));
    else if (filter === "judges")
      result = result.filter((c) => c.category_names.includes("Judge"));
    else if (filter === "coaches")
      result = result.filter((c) => c.category_names.includes("Coach"));

    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(
        (c) =>
          `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
          (c.email ?? "").toLowerCase().includes(q),
      );
    }
    return result;
  }, [contacts, filter, query]);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="px-8 pt-7 pb-5 border-b border-zinc-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight text-zinc-900">
              Contacts
            </h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              Board members, alumni, coaches, donors, and volunteers.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ExportCsvButton
              rows={filtered}
              columns={CONTACT_EXPORT_COLUMNS}
              filenamePrefix="amta-contacts"
              defaultSelectedKeys={CONTACT_DEFAULT_KEYS}
              disabled={isLoading}
            />
            <PrimaryButton onClick={() => setFormOpen(true)}>
              <span className="inline-flex items-center gap-1.5">
                <Plus size={14} />
                New contact
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
              placeholder="Search by name or email…"
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

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : (
          <ContactsTable
            rows={filtered}
            onSelect={(id) => navigate(`/contacts/${id}`)}
          />
        )}
      </div>

      <ContactForm open={formOpen} onClose={() => setFormOpen(false)} />
    </div>
  );
}

function ContactsTable({
  rows,
  onSelect,
}: {
  rows: ContactWithCategories[];
  onSelect: (id: string) => void;
}) {
  const { byContactId } = useProgramAffiliationsByContact();
  const { data: programs } = useProgramsLookup();
  const programById = useMemo(
    () => new Map((programs ?? []).map((p) => [p.id, p])),
    [programs],
  );

  if (rows.length === 0) {
    return <EmptyState>No contacts match these filters.</EmptyState>;
  }

  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-zinc-200">
          <th className="text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500 px-8 py-2.5">
            Name
          </th>
          <th className="text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500 py-2.5">
            Categories
          </th>
          <th className="text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500 py-2.5">
            Affiliation
          </th>
          <th className="text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500 py-2.5">
            Status
          </th>
          <th className="px-8"></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((c) => {
          const primaryAff = byContactId.get(c.id)?.[0];
          const program = primaryAff
            ? programById.get(primaryAff.program_id)
            : null;
          return (
            <tr
              key={c.id}
              onClick={() => onSelect(c.id)}
              className="cursor-pointer transition-colors group border-b border-zinc-100 hover:bg-zinc-50"
            >
              <td className="px-8 py-3">
                <div className="flex items-center gap-3">
                  <Avatar contact={c} size={32} />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-zinc-900">
                      {c.first_name} {c.last_name}
                    </span>
                    <span className="text-xs text-zinc-500">{c.email}</span>
                  </div>
                </div>
              </td>
              <td className="py-3">
                <div className="flex flex-wrap gap-1">
                  {c.category_names.slice(0, 3).map((cat) => (
                    <Tag
                      key={cat}
                      tone={cat === "Current Board Member" ? "maroon" : "neutral"}
                    >
                      {cat}
                    </Tag>
                  ))}
                </div>
              </td>
              <td className="py-3 text-sm text-zinc-600">
                {program ? (
                  <span>{program.short_name}</span>
                ) : (
                  <span className="text-zinc-400">—</span>
                )}
              </td>
              <td className="py-3">
                {isCurrentBoard(c) ? (
                  <Tag tone="success">Active board</Tag>
                ) : c.standing === "inactive" ? (
                  <Tag tone="muted">Former board</Tag>
                ) : (
                  <span className="text-xs text-zinc-400">—</span>
                )}
              </td>
              <td className="px-8 py-3">
                <ChevronRight
                  size={15}
                  className="text-zinc-300 group-hover:text-zinc-500 transition-colors"
                />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

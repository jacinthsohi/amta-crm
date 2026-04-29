import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, ChevronRight, Briefcase } from "lucide-react";
import { useCommittees } from "./hooks";
import { Tag } from "@/components/Tag";
import { LoadingState, ErrorState, EmptyState } from "@/components/states";
import { PrimaryButton } from "@/components/Buttons";
import { CommitteeForm } from "./CommitteeForm";
import type { Committee } from "@/lib/database.types";

export default function CommitteesListPage() {
  const navigate = useNavigate();
  const { data: committees, isLoading, error, refetch } = useCommittees();

  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);

  // Build a tree: top-level committees with their subcommittees nested
  const tree = useMemo(() => {
    if (!committees) return [];
    const all = query.trim()
      ? committees.filter((c) =>
          c.name.toLowerCase().includes(query.toLowerCase()),
        )
      : committees;
    const topLevel = all.filter((c) => !c.parent_committee_id);
    return topLevel.map((parent) => ({
      ...parent,
      subs: all.filter((c) => c.parent_committee_id === parent.id),
    }));
  }, [committees, query]);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <div className="px-8 pt-7 pb-5 border-b border-zinc-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight text-zinc-900">
              Committees
            </h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              The board's working groups, including subcommittees nested under
              their parents.
            </p>
          </div>
          <PrimaryButton onClick={() => setFormOpen(true)}>
            <span className="inline-flex items-center gap-1.5">
              <Plus size={14} />
              New committee
            </span>
          </PrimaryButton>
        </div>

        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm max-w-md bg-white border border-zinc-200">
          <Search size={14} className="text-zinc-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name…"
            className="flex-1 outline-none bg-transparent text-zinc-800 placeholder:text-zinc-400"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {isLoading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : tree.length === 0 ? (
          <EmptyState>No committees match your search.</EmptyState>
        ) : (
          <CommitteeTree
            tree={tree}
            onSelect={(id) => navigate(`/committees/${id}`)}
          />
        )}
      </div>

      <CommitteeForm open={formOpen} onClose={() => setFormOpen(false)} />
    </div>
  );
}

type TreeNode = Committee & { subs: Committee[] };

function CommitteeTree({
  tree,
  onSelect,
}: {
  tree: TreeNode[];
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      {tree.map((parent) => (
        <div
          key={parent.id}
          className="rounded-lg overflow-hidden border border-zinc-200"
        >
          <CommitteeRow
            committee={parent}
            isParent
            onSelect={onSelect}
          />
          {parent.subs.length > 0 && (
            <div className="bg-zinc-50">
              {parent.subs.map((sub) => (
                <CommitteeRow
                  key={sub.id}
                  committee={sub}
                  isSub
                  onSelect={onSelect}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function CommitteeRow({
  committee: c,
  isParent,
  isSub,
  onSelect,
}: {
  committee: Committee;
  isParent?: boolean;
  isSub?: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      onClick={() => onSelect(c.id)}
      className={
        "w-full flex items-center justify-between px-4 py-3 text-left transition-colors group hover:bg-zinc-100 " +
        (isSub ? "pl-12" : "bg-white") +
        (isParent && !isSub ? " border-b border-zinc-200" : "") +
        (!isParent && !isSub ? " border-b border-zinc-200 last:border-b-0" : "") +
        (isSub ? " border-b border-zinc-200 last:border-b-0" : "")
      }
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <Briefcase
          size={isSub ? 13 : 15}
          className={isParent ? "text-maroon-700" : "text-zinc-500"}
        />
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={
                "text-zinc-900 truncate " +
                (isParent ? "text-sm font-semibold" : "text-sm font-medium")
              }
            >
              {c.name}
            </span>
            {c.is_executive && <Tag tone="maroon">Executive</Tag>}
            {c.status === "inactive" && <Tag tone="muted">Inactive</Tag>}
          </div>
          {c.description && (
            <span className="text-xs text-zinc-500 truncate">
              {c.description}
            </span>
          )}
        </div>
      </div>
      <ChevronRight
        size={14}
        className="text-zinc-300 group-hover:text-zinc-500 transition-colors shrink-0 ml-3"
      />
    </button>
  );
}

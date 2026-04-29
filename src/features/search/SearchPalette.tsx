import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Users,
  GraduationCap,
  Briefcase,
  Calendar,
  FolderKanban,
  CheckSquare,
  MessagesSquare,
} from "lucide-react";
import {
  useSearchableEntities,
  type SearchableEntity,
  type SearchEntityKind,
} from "./useSearchableEntities";

/**
 * Order in which entity types appear in the palette.
 * Both for "everything visible" empty state and for ranking ties.
 */
const KIND_ORDER: SearchEntityKind[] = [
  "contact",
  "program",
  "committee",
  "event",
  "project",
  "task",
  "interaction",
];

const KIND_LABELS: Record<SearchEntityKind, string> = {
  contact: "Contacts",
  program: "Programs",
  committee: "Committees",
  event: "Events",
  project: "Projects",
  task: "Tasks",
  interaction: "Interactions",
};

const KIND_ICONS: Record<
  SearchEntityKind,
  React.ComponentType<{ size?: number; className?: string }>
> = {
  contact: Users,
  program: GraduationCap,
  committee: Briefcase,
  event: Calendar,
  project: FolderKanban,
  task: CheckSquare,
  interaction: MessagesSquare,
};

/**
 * Score an entity against a query.
 *
 * Higher = better. 0 = no match (excluded from results).
 *
 * Tiers:
 *   1000 — label starts with the query (prefix match)
 *    500 — query is a whole-word match in label
 *    100 — query is a substring of the label
 *     10 — query is a substring of the haystack (sublabel, content, etc)
 */
function scoreMatch(entity: SearchableEntity, q: string): number {
  if (!q) return 0;
  const label = entity.label.toLowerCase();
  const haystack = entity.haystack;

  if (label.startsWith(q)) return 1000;

  // Whole-word match — query bounded by start, end, or non-word chars
  // We do this with a regex but escape the query first to be safe
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const wordRe = new RegExp(`(^|\\s)${escaped}`, "i");
  if (wordRe.test(label)) return 500;

  if (label.includes(q)) return 100;
  if (haystack.includes(q)) return 10;
  return 0;
}

export function SearchPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const { entities, isLoading } = useSearchableEntities();

  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset state when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      // Focus the input after the modal renders
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Filter + rank
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      // Empty query: show a sample of recent items grouped by kind
      // We don't track "recently viewed" yet, so just pick the first ~3 of each
      const out: SearchableEntity[] = [];
      for (const kind of KIND_ORDER) {
        const ofKind = entities.filter((e) => e.kind === kind).slice(0, 3);
        out.push(...ofKind);
      }
      return out;
    }

    const scored = entities
      .map((e) => ({ entity: e, score: scoreMatch(e, q) }))
      .filter((s) => s.score > 0);

    // Sort: score desc, then kind order asc, then label asc
    scored.sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      const aKind = KIND_ORDER.indexOf(a.entity.kind);
      const bKind = KIND_ORDER.indexOf(b.entity.kind);
      if (aKind !== bKind) return aKind - bKind;
      return a.entity.label.localeCompare(b.entity.label);
    });

    return scored.slice(0, 50).map((s) => s.entity);
  }, [entities, query]);

  // Keep activeIndex in bounds when results change
  useEffect(() => {
    if (activeIndex >= results.length) setActiveIndex(0);
  }, [results.length, activeIndex]);

  // Keyboard nav
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, results.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const target = results[activeIndex];
        if (target) {
          navigate(target.href);
          onClose();
        }
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, results, activeIndex, navigate, onClose]);

  // Scroll active item into view as user navigates
  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.querySelector<HTMLElement>(
      `[data-search-index="${activeIndex}"]`,
    );
    activeEl?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (!open) return null;

  // Group results by kind for display headers when query is empty
  const showGroups = query.trim() === "";

  // Build a flat list with optional group separators when showing groups
  const renderItems: Array<
    { type: "header"; kind: SearchEntityKind } | { type: "result"; entity: SearchableEntity; index: number }
  > = [];

  if (showGroups) {
    let resultIndex = 0;
    for (const kind of KIND_ORDER) {
      const items = results.filter((r) => r.kind === kind);
      if (items.length === 0) continue;
      renderItems.push({ type: "header", kind });
      for (const e of items) {
        renderItems.push({ type: "result", entity: e, index: resultIndex });
        resultIndex++;
      }
    }
  } else {
    results.forEach((entity, index) => {
      renderItems.push({ type: "result", entity, index });
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] bg-zinc-900/30 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl mx-4 bg-white rounded-lg border border-zinc-200 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-zinc-100">
          <Search size={16} className="text-zinc-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search contacts, programs, events…"
            className="flex-1 bg-transparent outline-none text-sm text-zinc-900 placeholder:text-zinc-400"
          />
          <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500 font-medium">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          className="max-h-[60vh] overflow-y-auto py-1.5"
        >
          {isLoading && entities.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-zinc-500">
              Loading…
            </div>
          ) : results.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-zinc-500">
              No matches.{" "}
              <span className="text-zinc-400">Try a different query?</span>
            </div>
          ) : (
            renderItems.map((item, idx) => {
              if (item.type === "header") {
                return (
                  <div
                    key={`h-${item.kind}-${idx}`}
                    className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400"
                  >
                    {KIND_LABELS[item.kind]}
                  </div>
                );
              }
              const Icon = KIND_ICONS[item.entity.kind];
              const isActive = item.index === activeIndex;
              return (
                <button
                  key={`${item.entity.kind}-${item.entity.id}`}
                  data-search-index={item.index}
                  onClick={() => {
                    navigate(item.entity.href);
                    onClose();
                  }}
                  onMouseEnter={() => setActiveIndex(item.index)}
                  className={
                    "w-full flex items-center gap-3 px-4 py-2 text-left transition-colors " +
                    (isActive
                      ? "bg-maroon-50 text-maroon-700"
                      : "hover:bg-zinc-50 text-zinc-800")
                  }
                >
                  <Icon
                    size={14}
                    className={isActive ? "text-maroon-700" : "text-zinc-500"}
                  />
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-sm font-medium truncate">
                      {item.entity.label}
                    </span>
                    {item.entity.sublabel && (
                      <span
                        className={
                          "text-xs truncate " +
                          (isActive ? "text-maroon-700/70" : "text-zinc-500")
                        }
                      >
                        {item.entity.sublabel}
                      </span>
                    )}
                  </div>
                  {!showGroups && (
                    <span
                      className={
                        "text-[10px] uppercase tracking-wider " +
                        (isActive ? "text-maroon-700/70" : "text-zinc-400")
                      }
                    >
                      {KIND_LABELS[item.entity.kind].slice(0, -1)}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer with keyboard hints */}
        <div className="flex items-center justify-between gap-3 px-4 py-2 border-t border-zinc-100 bg-zinc-50/50 text-[11px] text-zinc-500">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-zinc-200 font-medium">
                ↑↓
              </kbd>
              navigate
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-zinc-200 font-medium">
                ↵
              </kbd>
              jump
            </span>
          </div>
          <div className="text-zinc-400">
            {query
              ? `${results.length} ${results.length === 1 ? "result" : "results"}`
              : `${entities.length} total`}
          </div>
        </div>
      </div>
    </div>
  );
}

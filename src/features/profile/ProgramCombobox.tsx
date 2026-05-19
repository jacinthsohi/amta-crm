import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Check, ChevronDown } from "lucide-react";
import { supabase } from "@/lib/supabase";

export type ProgramOption = {
  id: string;
  name: string;
  short_name: string | null;
  city: string | null;
  state: string | null;
  status: "active" | "inactive";
};

/**
 * Searchable dropdown for picking one of the ~483 AMTA programs.
 *
 * - Type to filter; debounced ~200ms.
 * - Keyboard: ArrowUp/Down to navigate, Enter to select, Esc to close.
 * - Empty query shows top 20 programs so users see what's available.
 * - Backed by the search_programs_public RPC (anon-safe).
 *
 * Used in:
 *   - Profile self-service affiliation editor (Chunk 4)
 *   - (planned) /alumni-signup form to replace whatever picker is there
 */
export function ProgramCombobox({
  value,
  onChange,
  selectedLabel,
  placeholder = "Search programs…",
}: {
  /** The currently selected program id (or null). */
  value: string | null;
  /** Called when the user picks a program. */
  onChange: (program: ProgramOption) => void;
  /** Optional pre-known label for the selected program, used when rendering
   *  the closed-state input value (e.g. when editing an existing affiliation
   *  and we already have the program name in hand). */
  selectedLabel?: string | null;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce the search query so we don't hammer the RPC on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(t);
  }, [query]);

  // Fetch matches. Empty string is a valid query (returns top 20 alphabetical).
  const { data: programs, isLoading } = useQuery({
    queryKey: ["program-search", debouncedQuery],
    queryFn: async (): Promise<ProgramOption[]> => {
      const { data, error } = await supabase.rpc("search_programs_public", {
        p_query: debouncedQuery,
      });
      if (error) throw error;
      return (data ?? []) as ProgramOption[];
    },
    enabled: open, // only fetch when the dropdown is actually visible
    staleTime: 30_000,
  });

  const items = programs ?? [];

  // Click-outside-to-close.
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  // Reset active index when items change so we don't have an out-of-range
  // highlight after filtering.
  useEffect(() => {
    setActiveIndex(0);
  }, [items.length]);

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => Math.min(items.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      if (open && items[activeIndex]) {
        e.preventDefault();
        select(items[activeIndex]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  function select(p: ProgramOption) {
    onChange(p);
    setOpen(false);
    setQuery("");
  }

  // Display value when the dropdown is closed: prefer the caller-provided
  // selectedLabel, otherwise the user's typed query.
  const displayValue = useMemo(() => {
    if (open) return query;
    return selectedLabel ?? "";
  }, [open, query, selectedLabel]);

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400" />
        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={handleKey}
          placeholder={value && !open ? "" : placeholder}
          className="w-full rounded-md border border-stone-300 bg-white py-2 pl-9 pr-8 text-sm text-stone-900 placeholder:text-stone-400 focus:border-[#70172a] focus:outline-none focus:ring-1 focus:ring-[#70172a]"
        />
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400" />
      </div>

      {open && (
        <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-stone-200 bg-white shadow-lg">
          {isLoading && (
            <div className="px-3 py-2 text-xs text-stone-400">Searching…</div>
          )}
          {!isLoading && items.length === 0 && (
            <div className="px-3 py-3 text-sm text-stone-500">
              No programs match "{debouncedQuery}". Try a different search.
            </div>
          )}
          {!isLoading &&
            items.map((p, i) => {
              const isSelected = p.id === value;
              const isActive = i === activeIndex;
              return (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => select(p)}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={`flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition-colors ${
                    isActive ? "bg-stone-50" : "bg-white"
                  }`}
                >
                  <Check
                    className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                      isSelected ? "text-[#70172a]" : "text-transparent"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-stone-900">
                      {p.name}
                      {p.status === "inactive" && (
                        <span className="ml-1.5 text-xs font-normal text-stone-400">
                          (inactive)
                        </span>
                      )}
                    </div>
                    {(p.city || p.state) && (
                      <div className="truncate text-xs text-stone-500">
                        {[p.city, p.state].filter(Boolean).join(", ")}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
        </div>
      )}
    </div>
  );
}

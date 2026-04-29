import { useState } from "react";
import { Plus, X } from "lucide-react";

/**
 * Multi-select tag input. Used for contact categories (and could be reused
 * for any "pick one or more from a list, optionally create new ones" field).
 *
 * Behaviors:
 *  - Selected tags appear as maroon pills inside the input
 *  - Type to filter the dropdown
 *  - Click a dropdown row or press Enter to add the top match
 *  - Backspace at the start of the field removes the last selected tag
 *  - If allowCreate=true and the typed query doesn't match anything, a
 *    "Create '...'" option appears at the bottom
 */
export function TagsField({
  value,
  onChange,
  options,
  allowCreate = false,
  onCreate,
  placeholder = "Add…",
}: {
  value: string[];
  onChange: (next: string[]) => void;
  options: string[];
  allowCreate?: boolean;
  onCreate?: (name: string) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const remaining = options.filter(
    (opt) =>
      !value.includes(opt) &&
      opt.toLowerCase().includes(query.toLowerCase()),
  );

  const handleAdd = (cat: string) => {
    if (!value.includes(cat)) onChange([...value, cat]);
    setQuery("");
    setOpen(false);
  };

  const handleRemove = (cat: string) => onChange(value.filter((v) => v !== cat));

  const handleCreate = () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    if (onCreate) onCreate(trimmed);
    handleAdd(trimmed);
  };

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-md min-h-[36px] bg-white border border-zinc-200">
        {value.map((cat) => (
          <span
            key={cat}
            className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-maroon-50 text-maroon-700 border border-maroon-100"
          >
            {cat}
            <button
              type="button"
              onClick={() => handleRemove(cat)}
              className="ml-0.5 text-maroon-700 hover:text-maroon-900"
            >
              <X size={10} />
            </button>
          </span>
        ))}
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (remaining.length > 0) {
                handleAdd(remaining[0]);
              } else if (allowCreate && query.trim()) {
                handleCreate();
              }
            } else if (e.key === "Backspace" && !query && value.length > 0) {
              onChange(value.slice(0, -1));
            }
          }}
          placeholder={value.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[80px] text-[13px] outline-none px-1 py-0.5 bg-transparent"
        />
      </div>

      {open && (remaining.length > 0 || (allowCreate && query.trim())) && (
        <div className="absolute left-0 right-0 mt-1 max-h-56 overflow-y-auto rounded-md shadow-lg z-10 bg-white border border-zinc-200">
          {remaining.map((opt) => (
            <button
              key={opt}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleAdd(opt)}
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-zinc-50"
            >
              {opt}
            </button>
          ))}
          {allowCreate && query.trim() && !options.includes(query.trim()) && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleCreate}
              className={`w-full text-left px-3 py-1.5 text-sm hover:bg-zinc-50 flex items-center gap-1.5 text-maroon-700 ${remaining.length > 0 ? "border-t border-zinc-100" : ""}`}
            >
              <Plus size={12} />
              Create "{query.trim()}"
            </button>
          )}
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { X } from "lucide-react";
import { Avatar } from "./Avatar";
import { cn } from "@/lib/cn";

type PickerContact = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
};

/**
 * Single-select contact picker with type-to-filter dropdown.
 */
export function ContactPicker({
  value,
  onChange,
  contacts,
  placeholder = "Choose a contact…",
  error,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  contacts: PickerContact[];
  placeholder?: string;
  error?: string | null;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const selected = value ? contacts.find((c) => c.id === value) : null;
  const filtered = contacts
    .filter((c) =>
      `${c.first_name} ${c.last_name}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
    .slice(0, 30);

  // If something's selected and we're not actively editing, show the chip
  if (selected && !open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors bg-white border h-[36px]",
          error ? "border-red-500" : "border-zinc-200",
        )}
      >
        <Avatar contact={selected} size={22} />
        <span className="text-sm text-zinc-900 flex-1 truncate">
          {selected.first_name} {selected.last_name}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onChange(null);
          }}
          className="text-zinc-400 hover:text-zinc-700"
        >
          <X size={13} />
        </button>
      </button>
    );
  }

  return (
    <div className="relative">
      <input
        autoFocus={open}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className={cn(
          "w-full px-2.5 py-1.5 text-[13px] rounded-md border outline-none transition-colors bg-white",
          error ? "border-red-500" : "border-zinc-200 focus:border-maroon-700",
        )}
      />
      {open && filtered.length > 0 && (
        <div className="absolute left-0 right-0 mt-1 max-h-72 overflow-y-auto rounded-md shadow-lg z-10 bg-white border border-zinc-200">
          {filtered.map((c) => (
            <button
              key={c.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(c.id);
                setQuery("");
                setOpen(false);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left hover:bg-zinc-50"
            >
              <Avatar contact={c} size={22} />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-zinc-900 truncate">
                  {c.first_name} {c.last_name}
                </div>
                {c.email && (
                  <div className="text-xs text-zinc-500 truncate">{c.email}</div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Multi-select contact picker. Selected contacts appear as chips inside the
 * input; type to add more.
 */
export function ContactsMultiPicker({
  value,
  onChange,
  contacts,
  placeholder = "Add a contact…",
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  contacts: PickerContact[];
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const selected = value
    .map((id) => contacts.find((c) => c.id === id))
    .filter((c): c is PickerContact => Boolean(c));
  const filtered = contacts
    .filter(
      (c) =>
        !value.includes(c.id) &&
        `${c.first_name} ${c.last_name}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .slice(0, 30);

  const handleAdd = (id: string) => {
    onChange([...value, id]);
    setQuery("");
    setOpen(false);
  };
  const handleRemove = (id: string) => onChange(value.filter((v) => v !== id));

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-md min-h-[36px] bg-white border border-zinc-200">
        {selected.map((c) => (
          <span
            key={c.id}
            className="inline-flex items-center gap-1.5 text-xs pl-1 pr-2 py-0.5 rounded bg-maroon-50 text-maroon-700 border border-maroon-100"
          >
            <Avatar contact={c} size={16} />
            {c.first_name} {c.last_name}
            <button
              type="button"
              onClick={() => handleRemove(c.id)}
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
          placeholder={selected.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[100px] text-[13px] outline-none px-1 py-0.5 bg-transparent"
        />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto rounded-md shadow-lg z-10 bg-white border border-zinc-200">
          {filtered.map((c) => (
            <button
              key={c.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleAdd(c.id)}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left hover:bg-zinc-50"
            >
              <Avatar contact={c} size={22} />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-zinc-900 truncate">
                  {c.first_name} {c.last_name}
                </div>
                {c.email && (
                  <div className="text-xs text-zinc-500 truncate">{c.email}</div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

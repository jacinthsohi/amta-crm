// src/components/ExportCsvButton.tsx
// =============================================================================
// Reusable "Export CSV" button + column picker modal.
// =============================================================================
// Pass it the current filtered rows and a list of available columns. It
// renders a button that opens a modal with column checkboxes; the user picks
// which columns to include and clicks Download.
//
// Usage:
//   <ExportCsvButton
//     rows={filteredContacts}
//     columns={CONTACT_EXPORT_COLUMNS}
//     filenamePrefix="amta-contacts"
//     defaultSelectedKeys={["first_name","last_name","email"]}
//   />
// =============================================================================

import { useEffect, useMemo, useState } from "react";
import { Download, X } from "lucide-react";
import {
  rowsToCsv,
  downloadCsv,
  timestampedFilename,
  type CsvColumnDef,
} from "@/lib/csv";

interface Props<T> {
  rows: T[];
  columns: CsvColumnDef<T>[];
  filenamePrefix: string;
  /**
   * Column keys selected by default when the picker opens. Defaults to all.
   */
  defaultSelectedKeys?: string[];
  /** Optional override for the button label */
  label?: string;
  /** Disabled state (e.g. while parent is still loading) */
  disabled?: boolean;
}

export function ExportCsvButton<T>({
  rows,
  columns,
  filenamePrefix,
  defaultSelectedKeys,
  label = "Export CSV",
  disabled = false,
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const allKeys = useMemo(() => columns.map((c) => c.key), [columns]);
  const initialKeys = defaultSelectedKeys ?? allKeys;
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initialKeys),
  );

  // Reset to defaults whenever the modal re-opens
  useEffect(() => {
    if (open) setSelected(new Set(initialKeys));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(allKeys));
  }

  function selectNone() {
    setSelected(new Set());
  }

  function handleDownload() {
    const chosen = columns.filter((c) => selected.has(c.key));
    if (chosen.length === 0) return;
    const csv = rowsToCsv(rows, chosen);
    downloadCsv(timestampedFilename(filenamePrefix), csv);
    setOpen(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <Download size={14} />
        {label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/30 px-4"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-lg shadow-xl border border-zinc-200 max-h-[80vh] flex flex-col"
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-zinc-200 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-zinc-900">
                  Export CSV
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {rows.length} {rows.length === 1 ? "row" : "rows"} will be
                  exported.
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            {/* Select all / none */}
            <div className="px-5 py-2 border-b border-zinc-100 flex items-center justify-between text-xs">
              <span className="text-zinc-500">
                {selected.size} of {columns.length} columns selected
              </span>
              <div className="flex gap-3">
                <button
                  onClick={selectAll}
                  className="text-maroon-700 hover:underline"
                >
                  Select all
                </button>
                <button
                  onClick={selectNone}
                  className="text-zinc-500 hover:underline"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Column checkboxes */}
            <div className="flex-1 overflow-y-auto px-5 py-3">
              <div className="space-y-1">
                {columns.map((col) => {
                  const isOn = selected.has(col.key);
                  return (
                    <label
                      key={col.key}
                      className="flex items-center gap-2.5 px-2 py-1.5 rounded-md cursor-pointer hover:bg-zinc-50"
                    >
                      <input
                        type="checkbox"
                        checked={isOn}
                        onChange={() => toggle(col.key)}
                        className="w-3.5 h-3.5 rounded border-zinc-300 text-maroon-700 focus:ring-1 focus:ring-maroon-700"
                      />
                      <span className="text-sm text-zinc-800">{col.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-zinc-200 flex items-center justify-end gap-2">
              <button
                onClick={() => setOpen(false)}
                className="px-3 py-1.5 rounded-md text-sm text-zinc-700 hover:bg-zinc-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDownload}
                disabled={selected.size === 0 || rows.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-white bg-maroon-700 hover:bg-maroon-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Download size={13} />
                Download
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

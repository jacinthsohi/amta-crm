// src/lib/csv.ts
// =============================================================================
// CSV serialization utilities
// =============================================================================
// Pure functions for converting arbitrary row data to a CSV string and
// triggering a browser download. Handles RFC 4180 escaping correctly:
//   - values containing commas, quotes, or newlines get wrapped in quotes
//   - quotes inside quoted values get doubled ("" inside "")
//   - null/undefined become empty strings
//   - arrays become "; "-joined strings (single cell, semicolon-separated)
//   - objects/dates get JSON.stringify'd (rare; user-defined columns should
//     pre-format these via the `value` extractor on ColumnDef).
// =============================================================================

/**
 * A column definition for export.
 *
 * `key` is a stable identifier (used in checkbox state, not displayed).
 * `label` is the column header in the CSV.
 * `value` extracts the cell value from a row. Returning a primitive is best;
 *   arrays get joined with "; "; null/undefined become empty.
 */
export interface CsvColumnDef<T> {
  key: string;
  label: string;
  value: (row: T) => unknown;
}

/**
 * Format a single cell for CSV output. Handles escaping per RFC 4180.
 */
function formatCell(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  let s: string;
  if (Array.isArray(raw)) {
    s = raw.map((x) => (x == null ? "" : String(x))).join("; ");
  } else if (raw instanceof Date) {
    s = raw.toISOString();
  } else if (typeof raw === "object") {
    s = JSON.stringify(raw);
  } else {
    s = String(raw);
  }

  // Escape if needed: contains comma, quote, newline, or carriage return.
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Convert an array of rows + column defs into a CSV string with a header row.
 */
export function rowsToCsv<T>(rows: T[], columns: CsvColumnDef<T>[]): string {
  const lines: string[] = [];
  lines.push(columns.map((c) => formatCell(c.label)).join(","));
  for (const row of rows) {
    lines.push(columns.map((c) => formatCell(c.value(row))).join(","));
  }
  // CRLF is the RFC 4180 line ending; works in Excel, Sheets, Numbers.
  return lines.join("\r\n");
}

/**
 * Trigger a browser download of the given CSV string.
 *
 * Adds a UTF-8 BOM so Excel-on-Windows correctly interprets non-ASCII
 * characters (accented names, em-dashes from notes, etc.).
 */
export function downloadCsv(filename: string, csv: string): void {
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke after a tick so the click handler has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Build a sensible filename like "amta-contacts-2026-05-07.csv".
 */
export function timestampedFilename(prefix: string): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${prefix}-${yyyy}-${mm}-${dd}.csv`;
}

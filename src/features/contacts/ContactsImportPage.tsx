// src/features/contacts/ContactsImportPage.tsx
// =============================================================================
// /contacts/import — bulk CSV import for contacts
// =============================================================================
//
// Multi-step flow:
//   Step 1: Upload — drag/drop or click to pick a CSV file. Parses with
//           papaparse. Validates row count (max 500). Advances to step 2.
//   Step 2: Map columns + bulk options — admin maps CSV columns to contact
//           fields, picks categories to tag rows with, optionally picks
//           an event to add rows to. Preview table shows first 5 rows.
//   Step 3: Processing — TODO (next commit)
//   Step 4: Result — TODO (next commit)
//
// Spec: docs/specs/contacts-csv-import-mvp.md
// =============================================================================

import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, AlertCircle, ArrowLeft } from "lucide-react";
import Papa from "papaparse";
import { supabase } from "@/lib/supabase";

const MAX_ROWS = 500;
const EVENT_LOOKBACK_DAYS = 180;

// Shape of the parsed CSV that we hand to step 2.
export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
  fileName: string;
}

// Column mapping: admin maps each contact field to a CSV header (or "none").
type ContactField =
  | "first_name"
  | "last_name"
  | "email"
  | "phone"
  | "notes";
type Mapping = Record<ContactField, string | null>; // null = "none"

const FIELD_LABELS: Record<ContactField, string> = {
  first_name: "First name",
  last_name: "Last name",
  email: "Email",
  phone: "Phone",
  notes: "Notes",
};

const REQUIRED_FIELDS: ContactField[] = ["first_name", "last_name", "email"];

interface CategoryRow {
  id: string;
  name: string;
}
interface EventRow {
  id: string;
  name: string;
  start_date: string | null;
}

type Step = "upload" | "map" | "processing" | "result";

export default function ContactsImportPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("upload");
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // -----------------------------------------------------------------------
  // CSV parsing
  // -----------------------------------------------------------------------
  function handleFile(file: File) {
    setParseError(null);

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setParseError("Please upload a .csv file.");
      return;
    }

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      complete: (results) => {
        if (results.errors.length > 0) {
          const first = results.errors[0];
          setParseError(
            `Couldn't parse the CSV: ${first.message} (row ${first.row ?? "?"})`,
          );
          return;
        }

        const rows = results.data;
        const headers = results.meta.fields ?? [];

        if (headers.length === 0) {
          setParseError(
            "The CSV doesn't have a header row. Add column headers (like 'first_name', 'email') and try again.",
          );
          return;
        }
        if (rows.length === 0) {
          setParseError("The CSV doesn't have any data rows.");
          return;
        }
        if (rows.length > MAX_ROWS) {
          setParseError(
            `That file has ${rows.length} rows. Please split it into batches of ${MAX_ROWS} or fewer.`,
          );
          return;
        }

        setParsed({ headers, rows, fileName: file.name });
        setStep("map");
      },
      error: (err) => {
        setParseError(`Failed to read the file: ${err.message}`);
      },
    });
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }
  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <button
        type="button"
        onClick={() => navigate("/contacts")}
        className="mb-4 inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700"
      >
        <ArrowLeft size={12} />
        Back to contacts
      </button>

      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-900">
          Import contacts from CSV
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Upload a CSV to bulk-add contacts. Max {MAX_ROWS} rows per file.
        </p>
      </header>

      <StepIndicator currentStep={step} />

      {step === "upload" && (
        <section className="mt-6">
          <UploadZone
            isDragging={isDragging}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onFile={handleFile}
          />
          {parseError && (
            <div className="mt-4 flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              <span>{parseError}</span>
            </div>
          )}
          <p className="mt-4 text-xs text-zinc-500">
            CSV should have a header row. Columns can be in any order —
            you'll map them in the next step.
          </p>
        </section>
      )}

      {step === "map" && parsed && (
        <MapStep
          parsed={parsed}
          onBack={() => {
            setParsed(null);
            setStep("upload");
          }}
          onSubmit={() => setStep("processing")}
        />
      )}

      {step === "processing" && (
        <section className="mt-6 rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-4 py-12 text-center text-sm text-zinc-500">
          Processing step coming in the next commit.
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setStep("map")}
              className="text-xs text-zinc-500 hover:text-zinc-700"
            >
              ← Back to mapping
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

// =============================================================================
// MapStep — column mapping + bulk options + preview
// =============================================================================
function MapStep({
  parsed,
  onBack,
  onSubmit,
}: {
  parsed: ParsedCsv;
  onBack: () => void;
  onSubmit: () => void;
}) {
  // ----- Mapping state -----
  // Auto-suggest mappings by slugged exact match between header and field.
  // E.g. "First Name" → slug "first_name" → matches field "first_name".
  const initialMapping: Mapping = useMemo(() => {
    const slug = (s: string) =>
      s.toLowerCase().trim().replace(/[\s-]+/g, "_");
    const headerSlugs = new Map(parsed.headers.map((h) => [slug(h), h]));
    return {
      first_name: headerSlugs.get("first_name") ?? null,
      last_name: headerSlugs.get("last_name") ?? null,
      email: headerSlugs.get("email") ?? null,
      phone: headerSlugs.get("phone") ?? null,
      notes: headerSlugs.get("notes") ?? null,
    };
  }, [parsed.headers]);
  const [mapping, setMapping] = useState<Mapping>(initialMapping);

  // ----- Bulk options state -----
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(
    new Set(),
  );
  const [addToEvent, setAddToEvent] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [eventPosition, setEventPosition] = useState("Judge");

  // ----- Lookup data (categories, events) -----
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [lookupError, setLookupError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const lookbackIso = new Date(
        Date.now() - EVENT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
      )
        .toISOString()
        .slice(0, 10);
      const [catsRes, eventsRes] = await Promise.all([
        supabase
          .from("active_contact_categories")
          .select("id, name")
          .order("name"),
        supabase
          .from("active_events")
          .select("id, name, start_date")
          .gte("start_date", lookbackIso)
          .order("start_date", { ascending: false }),
      ]);
      if (cancelled) return;
      if (catsRes.error || eventsRes.error) {
        // Log specific errors so we can debug from the console if something
        // breaks; user gets a generic message.
        if (catsRes.error) console.error("Categories lookup failed:", catsRes.error);
        if (eventsRes.error) console.error("Events lookup failed:", eventsRes.error);
        setLookupError(
          "Couldn't load categories or events. Refresh and try again.",
        );
        return;
      }
      setCategories(catsRes.data ?? []);
      setEvents((eventsRes.data ?? []) as EventRow[]);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ----- Validation -----
  const missingRequired = REQUIRED_FIELDS.filter((f) => !mapping[f]);
  const canSubmit =
    missingRequired.length === 0 && (!addToEvent || selectedEventId !== "");

  function toggleCategory(id: string) {
    setSelectedCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <section className="mt-6 space-y-6">
      {/* Source file summary */}
      <div className="rounded-md border border-zinc-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-900">
              {parsed.fileName}
            </p>
            <p className="text-xs text-zinc-500">
              {parsed.rows.length} rows · {parsed.headers.length} columns
            </p>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="text-xs text-zinc-500 hover:text-zinc-700"
          >
            ← Pick a different file
          </button>
        </div>
      </div>

      {lookupError && (
        <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
          <span>{lookupError}</span>
        </div>
      )}

      {/* Column mapping */}
      <div className="rounded-lg border border-zinc-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-zinc-900">
          Map CSV columns to contact fields
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Pick which CSV column should fill each field. Required fields are
          marked with *.
        </p>
        <div className="mt-4 space-y-3">
          {(Object.keys(FIELD_LABELS) as ContactField[]).map((field) => {
            const isRequired = REQUIRED_FIELDS.includes(field);
            return (
              <div
                key={field}
                className="grid grid-cols-[140px_1fr] items-center gap-3"
              >
                <label
                  htmlFor={`map-${field}`}
                  className="text-xs font-medium text-zinc-700"
                >
                  {FIELD_LABELS[field]}
                  {isRequired && (
                    <span className="text-maroon-700 ml-0.5">*</span>
                  )}
                </label>
                <select
                  id={`map-${field}`}
                  value={mapping[field] ?? ""}
                  onChange={(e) =>
                    setMapping((m) => ({
                      ...m,
                      [field]: e.target.value === "" ? null : e.target.value,
                    }))
                  }
                  className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm focus:border-maroon-700 focus:outline-none focus:ring-1 focus:ring-maroon-700"
                >
                  <option value="">— None —</option>
                  {parsed.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bulk options */}
      <div className="rounded-lg border border-zinc-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-zinc-900">
          Apply to all imported contacts
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Categories will be added to each row. If a row matches an existing
          contact by email, the categories and event will be added to that
          existing contact instead of creating a duplicate.
        </p>

        {/* Category multi-select */}
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-zinc-700">
            Tag as category (optional)
          </p>
          <div className="flex flex-wrap gap-1.5">
            {categories.length === 0 ? (
              <p className="text-xs text-zinc-400">Loading categories…</p>
            ) : (
              categories.map((c) => {
                const selected = selectedCategoryIds.has(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleCategory(c.id)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      selected
                        ? "border-maroon-700 bg-maroon-700 text-white"
                        : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                    }`}
                  >
                    {c.name}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Event toggle + dropdown */}
        <div className="mt-5 border-t border-zinc-100 pt-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={addToEvent}
              onChange={(e) => setAddToEvent(e.target.checked)}
              className="rounded text-maroon-700 focus:ring-maroon-700"
            />
            <span>Also add all contacts to an event</span>
          </label>

          {addToEvent && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="event-select"
                  className="mb-1 block text-xs font-medium text-zinc-700"
                >
                  Event
                </label>
                <select
                  id="event-select"
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm focus:border-maroon-700 focus:outline-none focus:ring-1 focus:ring-maroon-700"
                >
                  <option value="">Select an event…</option>
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.name}
                      {ev.start_date
                        ? ` (${new Date(ev.start_date).toLocaleDateString()})`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="event-position"
                  className="mb-1 block text-xs font-medium text-zinc-700"
                >
                  Position
                </label>
                <input
                  id="event-position"
                  type="text"
                  value={eventPosition}
                  onChange={(e) => setEventPosition(e.target.value)}
                  placeholder="Judge"
                  className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm focus:border-maroon-700 focus:outline-none focus:ring-1 focus:ring-maroon-700"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Preview */}
      <div className="rounded-lg border border-zinc-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-zinc-900">
          Preview (first 5 rows)
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Confirm your mapping looks right before importing.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-zinc-50 text-left text-zinc-500">
              <tr>
                {(Object.keys(FIELD_LABELS) as ContactField[]).map((field) => (
                  <th key={field} className="px-2 py-1.5 font-medium">
                    {FIELD_LABELS[field]}
                    {REQUIRED_FIELDS.includes(field) && (
                      <span className="text-maroon-700">*</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {parsed.rows.slice(0, 5).map((row, i) => (
                <tr key={i}>
                  {(Object.keys(FIELD_LABELS) as ContactField[]).map((field) => {
                    const csvCol = mapping[field];
                    const value = csvCol ? row[csvCol] ?? "" : "";
                    return (
                      <td
                        key={field}
                        className={`px-2 py-1.5 ${
                          !csvCol ? "text-zinc-300" : "text-zinc-900"
                        }`}
                      >
                        {csvCol ? value || "—" : "(not mapped)"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action row */}
      <div className="flex items-center justify-between border-t border-zinc-200 pt-4">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border border-zinc-300 px-3.5 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
        >
          Back
        </button>
        <div className="flex flex-col items-end gap-1">
          {missingRequired.length > 0 && (
            <p className="text-xs text-rose-600">
              Map required fields:{" "}
              {missingRequired.map((f) => FIELD_LABELS[f]).join(", ")}
            </p>
          )}
          {addToEvent && selectedEventId === "" && (
            <p className="text-xs text-rose-600">Pick an event or uncheck.</p>
          )}
          <button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit}
            className="rounded-md bg-maroon-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-maroon-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Import {parsed.rows.length} contact
            {parsed.rows.length === 1 ? "" : "s"}
          </button>
        </div>
      </div>
    </section>
  );
}

// =============================================================================
// Shared UI helpers
// =============================================================================
function UploadZone({
  isDragging,
  onDragOver,
  onDragLeave,
  onDrop,
  onFile,
}: {
  isDragging: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onFile: (file: File) => void;
}) {
  return (
    <label
      className={`block cursor-pointer rounded-lg border-2 border-dashed px-6 py-12 text-center transition-colors ${
        isDragging
          ? "border-maroon-500 bg-maroon-50"
          : "border-zinc-300 bg-white hover:border-zinc-400"
      }`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <Upload className="mx-auto mb-3 text-zinc-400" size={32} />
      <p className="text-sm font-medium text-zinc-900">
        Drop your CSV here, or click to pick a file
      </p>
      <p className="mt-1 text-xs text-zinc-500">
        Accepts .csv files up to 500 rows
      </p>
      <input
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
        }}
      />
    </label>
  );
}

function StepIndicator({ currentStep }: { currentStep: Step }) {
  const steps: { id: Step; label: string }[] = [
    { id: "upload", label: "Upload" },
    { id: "map", label: "Map & options" },
    { id: "processing", label: "Processing" },
    { id: "result", label: "Done" },
  ];
  const currentIndex = steps.findIndex((s) => s.id === currentStep);

  return (
    <div className="flex items-center gap-2 text-xs">
      {steps.map((s, i) => {
        const isPast = i < currentIndex;
        const isCurrent = i === currentIndex;
        return (
          <div key={s.id} className="flex items-center gap-2">
            <div
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-medium ${
                isCurrent
                  ? "bg-maroon-700 text-white"
                  : isPast
                  ? "bg-maroon-100 text-maroon-700"
                  : "bg-zinc-200 text-zinc-500"
              }`}
            >
              {i + 1}
            </div>
            <span
              className={
                isCurrent
                  ? "font-medium text-zinc-900"
                  : isPast
                  ? "text-zinc-600"
                  : "text-zinc-400"
              }
            >
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <span className="mx-1 text-zinc-300">→</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

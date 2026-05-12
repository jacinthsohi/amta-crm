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
//   Step 3: Processing — runs the import row-by-row. Dupe check by email,
//           insert contact (or update existing), add categories, add to
//           event. Shows progress, collects per-row errors.
//   Step 4: Result — imported / updated / errored counts with details.
//
// Deep-linking: when arriving from an Event detail page's "Add judges"
// button, the URL contains ?eventId=xyz. In that "add judges" mode we:
//   - Show a contextual page header ("Add judges to [Event Name]")
//   - Auto-check "Add all contacts to an event" with the event pre-selected
//   - Pre-select the "Judge" category chip
//   - Default the event_staff position to "Judge"
// The admin can override any of these on the Map step.
//
// Spec: docs/specs/contacts-csv-import-mvp.md
// =============================================================================

import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Upload,
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
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

// -----------------------------------------------------------------------------
// Header aliases for auto-mapping
// -----------------------------------------------------------------------------
// Each ContactField has a list of slugged header variants we'll auto-detect.
// The matcher iterates CSV headers in their original order and assigns each
// to the first field whose aliases include the slugged header — so if a CSV
// has both "Preferred Email Address" and "Email Address", whichever appears
// first in the CSV wins.
//
// Slugging rule: lowercase, trim, replace spaces / hyphens / question marks
// with underscores. Apostrophes, ampersands, and other punctuation get
// dropped. Keeps the alias list short and human-readable.
//
// Tournament hosts send CSVs with their own conventions — the aliases catch
// the obvious cases (First Name, Last Name, Preferred Email Address, Cell
// phone), but manual mapping is the expected workflow for unusual headers,
// not a fallback. The auto-map is a head start, not a guarantee.
// -----------------------------------------------------------------------------
const HEADER_ALIASES: Record<ContactField, string[]> = {
  first_name: ["first_name", "firstname", "given_name", "fname"],
  last_name: ["last_name", "lastname", "surname", "family_name", "lname"],
  email: [
    "email",
    "email_address",
    "preferred_email",
    "preferred_email_address",
    "e_mail",
    "e_mail_address",
    "mail",
  ],
  phone: [
    "phone",
    "phone_number",
    "phone_no",
    "cell",
    "cell_phone",
    "cell_phone_number",
    "mobile",
    "mobile_phone",
    "mobile_number",
    "telephone",
    "tel",
  ],
  notes: ["notes", "note", "comments", "comment", "description"],
};

function slugHeader(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[\s\-?]+/g, "_") // spaces, hyphens, question marks → underscore
    .replace(/[^a-z0-9_]/g, ""); // strip anything else (apostrophes, &, etc.)
}

// Given a list of CSV headers in their original order, produces a Mapping
// by iterating headers and assigning each to the first matching ContactField
// that's not already filled. First-in-CSV-order wins for ambiguous cases.
function buildAutoMapping(headers: string[]): Mapping {
  const result: Mapping = {
    first_name: null,
    last_name: null,
    email: null,
    phone: null,
    notes: null,
  };
  const fields = Object.keys(HEADER_ALIASES) as ContactField[];
  for (const header of headers) {
    const slug = slugHeader(header);
    for (const field of fields) {
      if (result[field] !== null) continue; // already filled
      if (HEADER_ALIASES[field].includes(slug)) {
        result[field] = header;
        break;
      }
    }
  }
  return result;
}

interface CategoryRow {
  id: string;
  name: string;
}
interface EventRow {
  id: string;
  name: string;
  start_date: string | null;
}

// Submission configuration passed from MapStep into ProcessingStep.
interface ImportConfig {
  parsed: ParsedCsv;
  mapping: Mapping;
  categoryIds: string[];
  eventId: string | null;
  eventPosition: string;
}

// Result of a single row's processing.
type RowOutcome =
  | { kind: "imported"; rowIndex: number; name: string }
  | { kind: "updated"; rowIndex: number; name: string }
  | { kind: "errored"; rowIndex: number; name: string; reason: string };

interface ImportResult {
  outcomes: RowOutcome[];
  imported: number;
  updated: number;
  errored: number;
}

type Step = "upload" | "map" | "processing" | "result";

export default function ContactsImportPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Pre-selected event from the URL (deep-link from Event detail page).
  // Null if not present. We don't validate the UUID format here — if the
  // eventId doesn't match any event in the lookback window, MapStep
  // silently falls back to no preselect.
  const preselectedEventId = searchParams.get("eventId");

  const [step, setStep] = useState<Step>("upload");
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [importConfig, setImportConfig] = useState<ImportConfig | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // The contextual page header needs the resolved event name. We fetch it
  // here at the page level (in addition to the events lookup inside MapStep)
  // so the header renders correctly during the Upload step BEFORE the
  // admin has loaded a CSV.
  const [pageHeaderEvent, setPageHeaderEvent] = useState<EventRow | null>(null);

  useEffect(() => {
    if (!preselectedEventId) return;
    let cancelled = false;
    (async () => {
      const lookbackIso = new Date(
        Date.now() - EVENT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
      )
        .toISOString()
        .slice(0, 10);
      const { data, error } = await supabase
        .from("active_events")
        .select("id, name, start_date")
        .eq("id", preselectedEventId)
        .gte("start_date", lookbackIso)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        // Silent fallback: stale or invalid eventId → just don't customize
        // the header. The maroon banner inside MapStep also won't render
        // in this case, so the experience stays consistent.
        return;
      }
      setPageHeaderEvent(data as EventRow);
    })();
    return () => {
      cancelled = true;
    };
  }, [preselectedEventId]);

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

  function resetAll() {
    setParsed(null);
    setImportConfig(null);
    setImportResult(null);
    setParseError(null);
    setStep("upload");
  }

  // Contextual page header — when arriving via "Add judges" deep link with
  // a valid event, the page reframes around that workflow.
  const isAddJudgesMode = Boolean(pageHeaderEvent);
  const pageTitle = isAddJudgesMode
    ? `Add judges to ${pageHeaderEvent!.name}`
    : "Import contacts from CSV";
  const pageSubtitle = isAddJudgesMode
    ? `Upload a CSV of judges. They'll be tagged as Judge and added to the event automatically.`
    : `Upload a CSV to bulk-add contacts. Max ${MAX_ROWS} rows per file.`;

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <button
        type="button"
        onClick={() =>
          isAddJudgesMode
            ? navigate(`/events/${pageHeaderEvent!.id}`)
            : navigate("/contacts")
        }
        className="mb-4 inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700"
      >
        <ArrowLeft size={12} />
        {isAddJudgesMode
          ? `Back to ${pageHeaderEvent!.name}`
          : "Back to contacts"}
      </button>

      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-900">{pageTitle}</h1>
        <p className="mt-1 text-sm text-zinc-600">{pageSubtitle}</p>
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
          preselectedEventId={preselectedEventId}
          isAddJudgesMode={isAddJudgesMode}
          onBack={() => {
            setParsed(null);
            setStep("upload");
          }}
          onSubmit={(config) => {
            setImportConfig(config);
            setStep("processing");
          }}
        />
      )}

      {step === "processing" && importConfig && (
        <ProcessingStep
          config={importConfig}
          onComplete={(result) => {
            setImportResult(result);
            setStep("result");
          }}
        />
      )}

      {step === "result" && importResult && (
        <ResultStep
          result={importResult}
          isAddJudgesMode={isAddJudgesMode}
          eventForReturn={pageHeaderEvent}
          onDone={() =>
            isAddJudgesMode
              ? navigate(`/events/${pageHeaderEvent!.id}`)
              : navigate("/contacts")
          }
          onImportAnother={resetAll}
        />
      )}
    </div>
  );
}

// =============================================================================
// MapStep — column mapping + bulk options + preview
// =============================================================================
function MapStep({
  parsed,
  preselectedEventId,
  isAddJudgesMode,
  onBack,
  onSubmit,
}: {
  parsed: ParsedCsv;
  preselectedEventId: string | null;
  isAddJudgesMode: boolean;
  onBack: () => void;
  onSubmit: (config: ImportConfig) => void;
}) {
  // ----- Mapping state -----
  // Auto-map CSV columns to contact fields using the alias list. See
  // HEADER_ALIASES at the top of this file for the matching rules.
  const initialMapping: Mapping = useMemo(
    () => buildAutoMapping(parsed.headers),
    [parsed.headers],
  );
  const [mapping, setMapping] = useState<Mapping>(initialMapping);

  // ----- Bulk options state -----
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(
    new Set(),
  );
  // If we arrived here via a deep link from an Event page, auto-enable the
  // "Add all contacts to an event" toggle and preselect the event. Admin
  // can still uncheck or change their mind.
  const [addToEvent, setAddToEvent] = useState(Boolean(preselectedEventId));
  const [selectedEventId, setSelectedEventId] = useState<string>(
    preselectedEventId ?? "",
  );
  const [eventPosition, setEventPosition] = useState("Judge");

  // ----- Lookup data -----
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
        if (catsRes.error) console.error("Categories lookup failed:", catsRes.error);
        if (eventsRes.error) console.error("Events lookup failed:", eventsRes.error);
        setLookupError(
          "Couldn't load categories or events. Refresh and try again.",
        );
        return;
      }
      const loadedCategories = catsRes.data ?? [];
      const loadedEvents = (eventsRes.data ?? []) as EventRow[];
      setCategories(loadedCategories);
      setEvents(loadedEvents);

      // If the URL preselected an event that ISN'T in the lookback window
      // (e.g. an old event the admin clicked from), silently un-preselect
      // rather than leaving the UI in a broken state with a phantom value.
      if (
        preselectedEventId &&
        !loadedEvents.some((ev) => ev.id === preselectedEventId)
      ) {
        setSelectedEventId("");
        setAddToEvent(false);
      }

      // If we're in add-judges mode and there's a "Judge" category, pre-
      // select it. Find it case-insensitively in case casing drifts.
      if (isAddJudgesMode) {
        const judgeCategory = loadedCategories.find(
          (c) => c.name.toLowerCase() === "judge",
        );
        if (judgeCategory) {
          setSelectedCategoryIds(new Set([judgeCategory.id]));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  function handleSubmit() {
    onSubmit({
      parsed,
      mapping,
      categoryIds: Array.from(selectedCategoryIds),
      eventId: addToEvent ? selectedEventId : null,
      eventPosition: eventPosition.trim() || "Judge",
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
              // grid-cols-[140px_minmax(0,1fr)] is the fix for tournament-host
              // CSVs with very long column names (e.g. 200-char Google Form
              // questions). Default `1fr` lets the track expand to fit the
              // widest dropdown option, breaking the card layout. `minmax(0,
              // 1fr)` explicitly allows the track to shrink to 0, and the
              // select inside uses w-full + min-w-0 to fill the now-bounded
              // track without bursting out of it.
              <div
                key={field}
                className="grid grid-cols-[140px_minmax(0,1fr)] items-center gap-3"
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
                  className="w-full min-w-0 rounded-md border border-zinc-300 px-2 py-1.5 text-sm focus:border-maroon-700 focus:outline-none focus:ring-1 focus:ring-maroon-700"
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
              <div className="min-w-0">
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
                  className="w-full min-w-0 rounded-md border border-zinc-300 px-2 py-1.5 text-sm focus:border-maroon-700 focus:outline-none focus:ring-1 focus:ring-maroon-700"
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
              <div className="min-w-0">
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
                  className="w-full min-w-0 rounded-md border border-zinc-300 px-2 py-1.5 text-sm focus:border-maroon-700 focus:outline-none focus:ring-1 focus:ring-maroon-700"
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
            onClick={handleSubmit}
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
// ProcessingStep — the actual import work
// =============================================================================
//
// Note on StrictMode: in development, React 18 mounts components twice to help
// surface bugs. We guard against re-running the import via startedRef. We
// intentionally do NOT have a cleanup that flips a `cancelled` flag — earlier
// versions did, and the cleanup fired between StrictMode's two mounts and
// permanently marked the import as cancelled, which suppressed the onComplete
// call once the work actually finished. The startedRef alone is the right
// guard; the work is single-shot per mount.
// =============================================================================
function ProcessingStep({
  config,
  onComplete,
}: {
  config: ImportConfig;
  onComplete: (result: ImportResult) => void;
}) {
  const [progress, setProgress] = useState(0);
  const total = config.parsed.rows.length;
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    (async () => {
      const result = await runImport(config, (n) => setProgress(n));
      onComplete(result);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pct = total === 0 ? 0 : Math.round((progress / total) * 100);

  return (
    <section className="mt-6 rounded-lg border border-zinc-200 bg-white p-8">
      <div className="flex flex-col items-center text-center">
        <RefreshCw className="mb-4 animate-spin text-maroon-700" size={28} />
        <p className="text-sm font-medium text-zinc-900">
          Importing… {progress} of {total}
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          This shouldn't take long. Please don't close this tab.
        </p>
        <div className="mt-4 h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-zinc-100">
          <div
            className="h-full bg-maroon-700 transition-all duration-200"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </section>
  );
}

// -----------------------------------------------------------------------------
// runImport — the actual processing engine
// -----------------------------------------------------------------------------
async function runImport(
  config: ImportConfig,
  onProgress: (n: number) => void,
): Promise<ImportResult> {
  const { parsed, mapping, categoryIds, eventId, eventPosition } = config;
  const outcomes: RowOutcome[] = [];
  const seenInThisImport = new Set<string>();

  for (let i = 0; i < parsed.rows.length; i++) {
    const row = parsed.rows[i];
    const csvRowNumber = i + 2;

    const firstName = mapping.first_name ? row[mapping.first_name]?.trim() : "";
    const lastName = mapping.last_name ? row[mapping.last_name]?.trim() : "";
    const email = mapping.email
      ? row[mapping.email]?.trim().toLowerCase()
      : "";
    const phone = mapping.phone ? row[mapping.phone]?.trim() : "";
    const notes = mapping.notes ? row[mapping.notes]?.trim() : "";

    const displayName =
      [firstName, lastName].filter(Boolean).join(" ") || `Row ${csvRowNumber}`;

    if (!firstName) {
      outcomes.push({
        kind: "errored",
        rowIndex: csvRowNumber,
        name: displayName,
        reason: "Missing first name",
      });
      onProgress(i + 1);
      continue;
    }
    if (!lastName) {
      outcomes.push({
        kind: "errored",
        rowIndex: csvRowNumber,
        name: displayName,
        reason: "Missing last name",
      });
      onProgress(i + 1);
      continue;
    }
    if (!email) {
      outcomes.push({
        kind: "errored",
        rowIndex: csvRowNumber,
        name: displayName,
        reason: "Missing email",
      });
      onProgress(i + 1);
      continue;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      outcomes.push({
        kind: "errored",
        rowIndex: csvRowNumber,
        name: displayName,
        reason: `Invalid email format: ${email}`,
      });
      onProgress(i + 1);
      continue;
    }

    if (seenInThisImport.has(email)) {
      outcomes.push({
        kind: "errored",
        rowIndex: csvRowNumber,
        name: displayName,
        reason: `Duplicate email in this CSV: ${email}`,
      });
      onProgress(i + 1);
      continue;
    }
    seenInThisImport.add(email);

    const { data: existing, error: lookupErr } = await supabase
      .from("contacts")
      .select("id")
      .ilike("email", email)
      .is("deleted_at", null)
      .maybeSingle();

    if (lookupErr) {
      outcomes.push({
        kind: "errored",
        rowIndex: csvRowNumber,
        name: displayName,
        reason: `Lookup failed: ${lookupErr.message}`,
      });
      onProgress(i + 1);
      continue;
    }

    if (existing) {
      const addError = await addAssociations({
        contactId: existing.id,
        categoryIds,
        eventId,
        eventPosition,
      });
      if (addError) {
        outcomes.push({
          kind: "errored",
          rowIndex: csvRowNumber,
          name: displayName,
          reason: addError,
        });
      } else {
        outcomes.push({
          kind: "updated",
          rowIndex: csvRowNumber,
          name: displayName,
        });
      }
      onProgress(i + 1);
      continue;
    }

    const { data: inserted, error: insertErr } = await supabase
      .from("contacts")
      .insert({
        first_name: firstName,
        last_name: lastName,
        email,
        phone: phone || null,
        notes: notes || null,
      })
      .select("id")
      .single();

    if (insertErr || !inserted) {
      outcomes.push({
        kind: "errored",
        rowIndex: csvRowNumber,
        name: displayName,
        reason: insertErr?.message ?? "Insert failed (no row returned)",
      });
      onProgress(i + 1);
      continue;
    }

    const addError = await addAssociations({
      contactId: inserted.id,
      categoryIds,
      eventId,
      eventPosition,
    });
    if (addError) {
      outcomes.push({
        kind: "errored",
        rowIndex: csvRowNumber,
        name: displayName,
        reason: `Contact created but associations failed: ${addError}`,
      });
    } else {
      outcomes.push({
        kind: "imported",
        rowIndex: csvRowNumber,
        name: displayName,
      });
    }
    onProgress(i + 1);
  }

  return {
    outcomes,
    imported: outcomes.filter((o) => o.kind === "imported").length,
    updated: outcomes.filter((o) => o.kind === "updated").length,
    errored: outcomes.filter((o) => o.kind === "errored").length,
  };
}

// -----------------------------------------------------------------------------
// addAssociations — add categories + event_staff to a contact, idempotently
// -----------------------------------------------------------------------------
async function addAssociations({
  contactId,
  categoryIds,
  eventId,
  eventPosition,
}: {
  contactId: string;
  categoryIds: string[];
  eventId: string | null;
  eventPosition: string;
}): Promise<string | null> {
  if (categoryIds.length > 0) {
    const { data: existing, error: lookupErr } = await supabase
      .from("contact_category_assignments")
      .select("category_id")
      .eq("contact_id", contactId)
      .is("deleted_at", null);
    if (lookupErr) {
      return `Failed to check existing categories: ${lookupErr.message}`;
    }
    const existingIds = new Set(
      (existing ?? []).map((a) => a.category_id as string),
    );
    const toInsert = categoryIds
      .filter((id) => !existingIds.has(id))
      .map((id) => ({ contact_id: contactId, category_id: id }));
    if (toInsert.length > 0) {
      const { error: insertErr } = await supabase
        .from("contact_category_assignments")
        .insert(toInsert);
      if (insertErr) {
        return `Failed to add categories: ${insertErr.message}`;
      }
    }
  }

  if (eventId) {
    const { data: existing, error: lookupErr } = await supabase
      .from("event_staff")
      .select("id")
      .eq("contact_id", contactId)
      .eq("event_id", eventId)
      .is("deleted_at", null)
      .maybeSingle();
    if (lookupErr) {
      return `Failed to check existing event assignment: ${lookupErr.message}`;
    }
    if (!existing) {
      const { error: insertErr } = await supabase.from("event_staff").insert({
        contact_id: contactId,
        event_id: eventId,
        position: eventPosition,
      });
      if (insertErr) {
        return `Failed to add to event: ${insertErr.message}`;
      }
    }
  }

  return null;
}

// =============================================================================
// ResultStep — imported / updated / errored summary
// =============================================================================
function ResultStep({
  result,
  isAddJudgesMode,
  eventForReturn,
  onDone,
  onImportAnother,
}: {
  result: ImportResult;
  isAddJudgesMode: boolean;
  eventForReturn: EventRow | null;
  onDone: () => void;
  onImportAnother: () => void;
}) {
  const errors = result.outcomes.filter(
    (o): o is Extract<RowOutcome, { kind: "errored" }> => o.kind === "errored",
  );

  const doneLabel =
    isAddJudgesMode && eventForReturn
      ? `Done — back to ${eventForReturn.name}`
      : "Done — back to contacts";

  return (
    <section className="mt-6 space-y-6">
      <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
        <CheckCircle2
          className="mt-0.5 flex-shrink-0 text-emerald-600"
          size={20}
        />
        <div>
          <p className="text-sm font-medium text-emerald-900">
            Import complete
          </p>
          <p className="mt-0.5 text-xs text-emerald-700">
            {result.imported + result.updated} of {result.outcomes.length}{" "}
            rows processed successfully.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="Imported as new"
          value={result.imported}
          tone="emerald"
        />
        <StatCard
          label="Updated existing"
          value={result.updated}
          tone="blue"
        />
        <StatCard label="Errored" value={result.errored} tone="rose" />
      </div>

      {errors.length > 0 && (
        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-zinc-900">
            Errors ({errors.length})
          </h3>
          <p className="mt-1 text-xs text-zinc-500">
            These rows weren't imported. You can fix the issues and re-run
            the import with just those rows.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-zinc-50 text-left text-zinc-500">
                <tr>
                  <th className="px-2 py-1.5 font-medium">Row</th>
                  <th className="px-2 py-1.5 font-medium">Name</th>
                  <th className="px-2 py-1.5 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {errors.map((e) => (
                  <tr key={e.rowIndex}>
                    <td className="px-2 py-1.5 text-zinc-500">
                      {e.rowIndex}
                    </td>
                    <td className="px-2 py-1.5 text-zinc-900">{e.name}</td>
                    <td className="px-2 py-1.5 text-rose-700">{e.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex items-center justify-end gap-2 border-t border-zinc-200 pt-4">
        <button
          type="button"
          onClick={onImportAnother}
          className="rounded-md border border-zinc-300 px-3.5 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
        >
          Import another file
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-md bg-maroon-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-maroon-800"
        >
          {doneLabel}
        </button>
      </div>
    </section>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "emerald" | "blue" | "rose";
}) {
  const toneClasses: Record<typeof tone, string> = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
  };
  return (
    <div
      className={`rounded-lg border ${toneClasses[tone]} px-4 py-3 text-center`}
    >
      <p className="text-2xl font-semibold">{value}</p>
      <p className="mt-0.5 text-xs">{label}</p>
    </div>
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

// src/features/contacts/ContactsImportPage.tsx
// =============================================================================
// /contacts/import — bulk CSV import for contacts
// =============================================================================
//
// Multi-step flow:
//   Step 1: Upload — drag/drop or click to pick a CSV file. Parses with
//           papaparse. Validates row count (max 500). Advances to step 2
//           on success.
//   Step 2: Map columns + bulk options — TODO (next commit)
//   Step 3: Processing — TODO (next commit)
//   Step 4: Result — TODO (next commit)
//
// Spec: docs/specs/contacts-csv-import-mvp.md
// =============================================================================

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, AlertCircle, ArrowLeft } from "lucide-react";
import Papa from "papaparse";

const MAX_ROWS = 500;

// Shape of the parsed CSV that we hand to step 2.
export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
  fileName: string;
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
          // Surface the first parse error in user-friendly form. Most
          // common: malformed quoting, unclosed strings.
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

        setParsed({
          headers,
          rows,
          fileName: file.name,
        });
        setStep("map");
      },
      error: (err) => {
        setParseError(`Failed to read the file: ${err.message}`);
      },
    });
  }

  // -----------------------------------------------------------------------
  // Drag-and-drop handlers
  // -----------------------------------------------------------------------
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

  // =======================================================================
  // Render
  // =======================================================================
  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      {/* Back link */}
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

      {/* Step indicator */}
      <StepIndicator currentStep={step} />

      {/* Step 1: Upload */}
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

      {/* Step 2: Map columns — placeholder for next commit */}
      {step === "map" && parsed && (
        <section className="mt-6 rounded-lg border border-zinc-200 bg-white p-6">
          <p className="text-sm text-zinc-900 font-medium">
            Parsed: {parsed.fileName}
          </p>
          <p className="mt-1 text-sm text-zinc-600">
            {parsed.rows.length} rows, {parsed.headers.length} columns
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Columns found: {parsed.headers.join(", ")}
          </p>

          <div className="mt-4 rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-500">
            Column mapping UI coming in the next commit.
          </div>

          <button
            type="button"
            onClick={() => {
              setParsed(null);
              setStep("upload");
            }}
            className="mt-4 text-xs text-zinc-500 hover:text-zinc-700"
          >
            ← Pick a different file
          </button>
        </section>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// UploadZone — drag-and-drop + click-to-pick file input
// -----------------------------------------------------------------------------
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

// -----------------------------------------------------------------------------
// StepIndicator — visual breadcrumb for the multi-step flow
// -----------------------------------------------------------------------------
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

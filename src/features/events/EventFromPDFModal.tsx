import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  X,
  Upload,
  Loader2,
  FileText,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/cn";

/**
 * Modal flow for creating an event from a PDF tournament packet.
 *
 * Three states:
 *   1. Upload — empty modal with drag-and-drop / file picker
 *   2. Extracting — Claude is reading the PDF
 *   3. Review — side-by-side PDF preview + extracted form. User can edit
 *      any field, then clicks Create. We:
 *        a) Insert event row
 *        b) Upload PDF to event-documents bucket
 *        c) Insert event_documents row pointing to the PDF
 *        d) Navigate to the new event detail page
 *
 * Confidence indicators: each field shows a color-coded icon based on
 * Claude's self-reported confidence. This drives user attention — they
 * skim high-confidence fields, focus on yellow/red ones.
 */

type ConfidenceLevel = "high" | "medium" | "low";

type ExtractedData = {
  name: string | null;
  start_date: string | null;
  end_date: string | null;
  location_city: string | null;
  location_state: string | null;
  location_venue: string | null;
  host_program_name: string | null;
  description: string | null;
  registration_deadline: string | null;
  max_teams: number | null;
  fee_per_team: number | null;
  tournament_director: string | null;
  confidence: Record<string, ConfidenceLevel>;
  extraction_notes: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
};

type Stage = "upload" | "extracting" | "review";

export function EventFromPDFModal({ open, onClose }: Props) {
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [extracted, setExtracted] = useState<ExtractedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Reset everything when modal closes
  useEffect(() => {
    if (!open) {
      setStage("upload");
      setFile(null);
      setExtracted(null);
      setError(null);
      setCreating(false);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
        <Header stage={stage} onClose={onClose} />
        <div className="flex-1 overflow-hidden">
          {stage === "upload" && (
            <UploadStage
              onFileSelected={async (f) => {
                setFile(f);
                setStage("extracting");
                setError(null);
                try {
                  const data = await extractFromPDF(f);
                  setExtracted(data);
                  setStage("review");
                } catch (e) {
                  setError((e as Error).message);
                  setStage("upload");
                  setFile(null);
                }
              }}
              error={error}
            />
          )}
          {stage === "extracting" && file && <ExtractingStage filename={file.name} />}
          {stage === "review" && extracted && file && (
            <ReviewStage
              extracted={extracted}
              file={file}
              creating={creating}
              error={error}
              onSubmit={async (final) => {
                setCreating(true);
                setError(null);
                try {
                  const eventId = await createEventFromExtraction(file, final);
                  onClose();
                  navigate(`/events/${eventId}`);
                } catch (e) {
                  setError((e as Error).message);
                  setCreating(false);
                }
              }}
              onBack={() => setStage("upload")}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Header
// =============================================================================

function Header({ stage, onClose }: { stage: Stage; onClose: () => void }) {
  const titles: Record<Stage, string> = {
    upload: "Create event from PDF",
    extracting: "Reading your packet...",
    review: "Review extracted details",
  };
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
      <div className="flex items-center gap-2">
        <Sparkles size={16} className="text-maroon-700" />
        <h2 className="text-base font-semibold text-zinc-900">{titles[stage]}</h2>
      </div>
      <button
        onClick={onClose}
        className="text-zinc-400 hover:text-zinc-700 transition-colors"
      >
        <X size={18} />
      </button>
    </div>
  );
}

// =============================================================================
// Upload stage — drop zone or file picker
// =============================================================================

function UploadStage({
  onFileSelected,
  error,
}: {
  onFileSelected: (f: File) => void;
  error: string | null;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(
    (file: File) => {
      if (file.type !== "application/pdf") {
        alert("Please upload a PDF file.");
        return;
      }
      onFileSelected(file);
    },
    [onFileSelected],
  );

  return (
    <div className="p-8">
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 flex items-start gap-2">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <div>
            <div className="font-medium mb-0.5">Couldn't extract data</div>
            <div className="text-red-800 text-xs">{error}</div>
          </div>
        </div>
      )}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files[0];
          if (f) handleFile(f);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors",
          dragOver
            ? "border-maroon-500 bg-maroon-50/50"
            : "border-zinc-300 hover:border-maroon-400 hover:bg-zinc-50",
        )}
      >
        <Upload size={28} className="mx-auto text-zinc-400 mb-3" />
        <div className="text-sm font-medium text-zinc-800 mb-1">
          Drop a tournament packet PDF here, or click to choose
        </div>
        <div className="text-xs text-zinc-500">
          AI will extract event details for you to review. Maximum 20MB.
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
      </div>
      <div className="mt-4 text-xs text-zinc-500 text-center">
        Works best with packets that include dates, location, host school,
        and registration details.
      </div>
    </div>
  );
}

// =============================================================================
// Extracting stage — shown while Claude is reading the PDF
// =============================================================================

function ExtractingStage({ filename }: { filename: string }) {
  return (
    <div className="p-12 flex flex-col items-center text-center">
      <div className="relative mb-6">
        <FileText size={40} className="text-maroon-700" />
        <Loader2
          size={20}
          className="absolute -top-1 -right-2 text-maroon-700 animate-spin"
        />
      </div>
      <div className="text-base font-medium text-zinc-900 mb-1">
        Reading {filename}
      </div>
      <div className="text-sm text-zinc-500 max-w-md">
        AI is extracting tournament details. This usually takes 5–15 seconds
        depending on the length of the document.
      </div>
    </div>
  );
}

// =============================================================================
// Review stage — side-by-side PDF preview + editable form
// =============================================================================

function ReviewStage({
  extracted,
  file,
  creating,
  error,
  onSubmit,
  onBack,
}: {
  extracted: ExtractedData;
  file: File;
  creating: boolean;
  error: string | null;
  onSubmit: (final: ExtractedData) => Promise<void>;
  onBack: () => void;
}) {
  const [data, setData] = useState<ExtractedData>(extracted);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  // Create a blob URL for the PDF preview. Cleanup on unmount.
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPdfUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function update<K extends keyof ExtractedData>(key: K, value: ExtractedData[K]) {
    setData((d) => ({ ...d, [key]: value }));
  }

  return (
    <div className="flex h-[70vh]">
      {/* PDF preview */}
      <div className="w-1/2 border-r border-zinc-200 bg-zinc-50">
        {pdfUrl ? (
          <iframe
            src={pdfUrl}
            title="Tournament packet preview"
            className="w-full h-full border-0"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-zinc-500">
            Loading preview...
          </div>
        )}
      </div>

      {/* Editable form */}
      <div className="w-1/2 flex flex-col">
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {extracted.extraction_notes && (
            <div className="mb-4 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-900">
              <span className="font-medium">AI notes:</span>{" "}
              {extracted.extraction_notes}
            </div>
          )}

          <Field
            label="Event name"
            confidence={data.confidence?.name}
            required
          >
            <input
              type="text"
              value={data.name ?? ""}
              onChange={(e) => update("name", e.target.value || null)}
              className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-md focus:border-maroon-500 focus:outline-none"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Start date"
              confidence={data.confidence?.start_date}
              required
            >
              <input
                type="date"
                value={data.start_date ?? ""}
                onChange={(e) => update("start_date", e.target.value || null)}
                className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-md focus:border-maroon-500 focus:outline-none"
              />
            </Field>
            <Field label="End date" confidence={data.confidence?.end_date}>
              <input
                type="date"
                value={data.end_date ?? ""}
                onChange={(e) => update("end_date", e.target.value || null)}
                className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-md focus:border-maroon-500 focus:outline-none"
              />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="City" confidence={data.confidence?.location_city}>
              <input
                type="text"
                value={data.location_city ?? ""}
                onChange={(e) => update("location_city", e.target.value || null)}
                className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-md focus:border-maroon-500 focus:outline-none"
              />
            </Field>
            <Field label="State" confidence={data.confidence?.location_state}>
              <input
                type="text"
                value={data.location_state ?? ""}
                onChange={(e) => update("location_state", e.target.value || null)}
                placeholder="2-letter"
                maxLength={2}
                className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-md focus:border-maroon-500 focus:outline-none uppercase"
              />
            </Field>
            <Field label="Venue" confidence={data.confidence?.location_venue}>
              <input
                type="text"
                value={data.location_venue ?? ""}
                onChange={(e) => update("location_venue", e.target.value || null)}
                className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-md focus:border-maroon-500 focus:outline-none"
              />
            </Field>
          </div>

          <Field
            label="Host program"
            confidence={data.confidence?.host_program_name}
            help="If matched to an existing program, will be linked automatically."
          >
            <input
              type="text"
              value={data.host_program_name ?? ""}
              onChange={(e) => update("host_program_name", e.target.value || null)}
              className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-md focus:border-maroon-500 focus:outline-none"
            />
          </Field>

          <Field label="Description" confidence={data.confidence?.description}>
            <textarea
              value={data.description ?? ""}
              onChange={(e) => update("description", e.target.value || null)}
              rows={3}
              className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-md focus:border-maroon-500 focus:outline-none resize-none"
            />
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field
              label="Reg. deadline"
              confidence={data.confidence?.registration_deadline}
            >
              <input
                type="date"
                value={data.registration_deadline ?? ""}
                onChange={(e) =>
                  update("registration_deadline", e.target.value || null)
                }
                className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-md focus:border-maroon-500 focus:outline-none"
              />
            </Field>
            <Field label="Max teams" confidence={data.confidence?.max_teams}>
              <input
                type="number"
                value={data.max_teams ?? ""}
                onChange={(e) =>
                  update("max_teams", e.target.value ? Number(e.target.value) : null)
                }
                className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-md focus:border-maroon-500 focus:outline-none"
              />
            </Field>
            <Field
              label="Fee per team ($)"
              confidence={data.confidence?.fee_per_team}
            >
              <input
                type="number"
                value={data.fee_per_team ?? ""}
                onChange={(e) =>
                  update(
                    "fee_per_team",
                    e.target.value ? Number(e.target.value) : null,
                  )
                }
                className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-md focus:border-maroon-500 focus:outline-none"
              />
            </Field>
          </div>

          <Field
            label="Tournament Director"
            confidence={data.confidence?.tournament_director}
          >
            <input
              type="text"
              value={data.tournament_director ?? ""}
              onChange={(e) =>
                update("tournament_director", e.target.value || null)
              }
              className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-md focus:border-maroon-500 focus:outline-none"
            />
          </Field>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">
              {error}
            </div>
          )}
        </div>

        {/* Footer with confirm/back */}
        <div className="border-t border-zinc-200 px-6 py-3 flex items-center justify-between gap-3">
          <button
            onClick={onBack}
            disabled={creating}
            className="text-sm text-zinc-600 hover:text-zinc-900 disabled:opacity-50"
          >
            ← Choose a different file
          </button>
          <button
            onClick={() => onSubmit(data)}
            disabled={creating || !data.name || !data.start_date}
            className="px-4 py-2 rounded-md bg-maroon-700 text-white text-sm font-medium hover:bg-maroon-800 disabled:bg-zinc-300 transition-colors flex items-center gap-2"
          >
            {creating && <Loader2 size={14} className="animate-spin" />}
            <span>{creating ? "Creating..." : "Create event"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Confidence-marked form field
// =============================================================================

function Field({
  label,
  confidence,
  required,
  help,
  children,
}: {
  label: string;
  confidence?: ConfidenceLevel;
  required?: boolean;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-medium text-zinc-700 flex items-center gap-1">
          {label}
          {required && <span className="text-red-600">*</span>}
        </label>
        {confidence && <ConfidenceBadge level={confidence} />}
      </div>
      {children}
      {help && <div className="text-[11px] text-zinc-500 mt-1">{help}</div>}
    </div>
  );
}

function ConfidenceBadge({ level }: { level: ConfidenceLevel }) {
  if (level === "high") {
    return (
      <span
        className="text-[11px] flex items-center gap-1 text-green-700"
        title="High confidence — extracted directly from the document"
      >
        <CheckCircle2 size={11} />
      </span>
    );
  }
  if (level === "medium") {
    return (
      <span
        className="text-[11px] flex items-center gap-1 text-amber-700"
        title="Medium confidence — please verify"
      >
        <AlertTriangle size={11} />
        <span>verify</span>
      </span>
    );
  }
  return (
    <span
      className="text-[11px] flex items-center gap-1 text-red-700"
      title="Low confidence — likely guessed; please correct"
    >
      <AlertCircle size={11} />
      <span>uncertain</span>
    </span>
  );
}

// =============================================================================
// API + DB operations
// =============================================================================

async function extractFromPDF(file: File): Promise<ExtractedData> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Not signed in. Please refresh the page.");

  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/extract-event-pdf", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
    body: formData,
  });

  if (!res.ok) {
    let msg = `Extraction failed (${res.status})`;
    try {
      const errJson = await res.json();
      if (errJson?.error) msg = errJson.error;
    } catch {}
    throw new Error(msg);
  }

  const { extracted } = (await res.json()) as { extracted: ExtractedData };
  return extracted;
}

async function createEventFromExtraction(
  file: File,
  data: ExtractedData,
): Promise<string> {
  // 1. Look up host program by name (fuzzy match)
  let hostProgramId: string | null = null;
  if (data.host_program_name) {
    const { data: programs } = await supabase
      .from("active_programs")
      .select("id, name")
      .ilike("name", `%${data.host_program_name.split(" ")[0]}%`)
      .limit(5);
    // Best match: exact name match if available, else first result
    const exact = (programs ?? []).find(
      (p: any) =>
        p.name.toLowerCase() === data.host_program_name?.toLowerCase(),
    );
    hostProgramId = exact?.id ?? (programs?.[0] as any)?.id ?? null;
  }

  // 2. Build location string from city/state/venue
  const locationParts = [
    data.location_venue,
    data.location_city,
    data.location_state,
  ].filter(Boolean);
  const location = locationParts.length > 0 ? locationParts.join(", ") : null;

  // 3. Insert event row
  const { data: insertedEvent, error: eventErr } = await supabase
    .from("events")
    .insert({
      name: data.name,
      start_date: data.start_date,
      end_date: data.end_date,
      location,
      description: data.description,
      event_type: "tournament",
      status: "planned",
    })
    .select()
    .single();

  if (eventErr || !insertedEvent) {
    throw new Error("Failed to create event: " + (eventErr?.message ?? "unknown"));
  }
  const eventId = insertedEvent.id as string;

  // 4. Create event host link if program matched
  if (hostProgramId) {
    await supabase.from("event_hosts").insert({
      event_id: eventId,
      program_id: hostProgramId,
    });
  }

  // 5. Upload PDF to storage
  const filePath = `${eventId}/${Date.now()}-${sanitizeFilename(file.name)}`;
  const { error: uploadErr } = await supabase.storage
    .from("event-documents")
    .upload(filePath, file, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (uploadErr) {
    // Event is created but PDF upload failed. Surface the error but don't
    // delete the event — user has data they can still use.
    throw new Error(
      "Event created, but PDF upload failed: " +
        uploadErr.message +
        ". You can attach the file manually from the event page.",
    );
  }

  // 6. Get a signed URL (event-documents is private bucket).
  // We store this URL in event_documents; signed URLs expire, so we'll
  // need to refresh on display. For v1 we generate a long-lived URL (1 year).
  const { data: signedData } = await supabase.storage
    .from("event-documents")
    .createSignedUrl(filePath, 60 * 60 * 24 * 365); // 1 year

  const documentUrl = signedData?.signedUrl ?? filePath;

  // 7. Create event_documents row
  await supabase.from("event_documents").insert({
    event_id: eventId,
    document_type: "tournament_packet",
    title: file.name,
    url: documentUrl,
  });

  return eventId;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
}

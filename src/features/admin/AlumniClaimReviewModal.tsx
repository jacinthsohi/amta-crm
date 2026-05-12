// src/features/admin/AlumniClaimReviewModal.tsx
// =============================================================================
// Alumni claim review modal — steps 4, 5, 6 of the admin alumni claims flow
// =============================================================================
//
// State machine for this modal (mode):
//   - "review"  — read-only view of submitted claim + duplicate banner
//                 (step 4)
//   - "approve" — editable contact form pre-filled from the claim, calls
//                 useApproveClaimAndCreateContact on save
//                 (step 5)
//
// Reject (step 6) is a separate stacked modal triggered from the review view.
// =============================================================================

import { useEffect, useState } from "react";
import Modal from "@/components/Modal";
import {
  useFindDuplicateContact,
  useApproveClaimAndCreateContact,
  useRejectClaim,
  type AlumniClaimRow,
  type PossibleDuplicate,
} from "./alumni-claims-hooks";

type Mode = "review" | "approve";
type RejectReasonChoice = "spam" | "other";

interface AlumniClaimReviewModalProps {
  claim: AlumniClaimRow | null;
  onClose: () => void;
}

function formatSubmittedAt(iso: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `Submitted ${date} · ${time}`;
}

export default function AlumniClaimReviewModal({
  claim,
  onClose,
}: AlumniClaimReviewModalProps) {
  const [mode, setMode] = useState<Mode>("review");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);

  // Reset to review mode whenever a new claim is opened. Without this,
  // opening a second claim after the first would inherit stale mode state.
  useEffect(() => {
    if (claim) {
      setMode("review");
      setRejectDialogOpen(false);
    }
  }, [claim?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: duplicate, isLoading: duplicateLoading } =
    useFindDuplicateContact(claim);

  const reviewFooter = (
    <>
      <button
        type="button"
        onClick={() => setRejectDialogOpen(true)}
        className="rounded-md border border-zinc-300 px-3.5 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
      >
        Reject
      </button>
      <button
        type="button"
        onClick={() => setMode("approve")}
        className="rounded-md bg-maroon-700 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-maroon-800"
      >
        Approve
      </button>
    </>
  );

  return (
    <>
      <Modal
        open={claim !== null}
        onClose={onClose}
        title={
          mode === "approve" ? "Approve & create contact" : "Review alumni claim"
        }
        subtitle={claim ? formatSubmittedAt(claim.created_at) : undefined}
        size="xl"
        // Footer for review mode only — approve mode renders its own footer
        // inside the form so submit can hook into form state.
        footer={mode === "review" ? reviewFooter : undefined}
      >
        {claim && mode === "review" && (
          <ReviewBody
            claim={claim}
            duplicate={duplicate ?? null}
            duplicateLoading={duplicateLoading}
          />
        )}
        {claim && mode === "approve" && (
          <ApproveForm
            claim={claim}
            onCancel={() => setMode("review")}
            onSuccess={onClose}
          />
        )}
      </Modal>

      {/* Reject confirmation — stacked secondary modal */}
      {claim && (
        <RejectDialog
          open={rejectDialogOpen}
          claimId={claim.id}
          claimantName={`${claim.first_name} ${claim.last_name}`}
          onClose={() => setRejectDialogOpen(false)}
          onSuccess={() => {
            setRejectDialogOpen(false);
            onClose();
          }}
        />
      )}
    </>
  );
}

// =============================================================================
// ReviewBody — the read-only view (step 4)
// =============================================================================
function ReviewBody({
  claim,
  duplicate,
  duplicateLoading,
}: {
  claim: AlumniClaimRow;
  duplicate: PossibleDuplicate | null;
  duplicateLoading: boolean;
}) {
  return (
    <>
      {duplicateLoading ? (
        <p className="mb-5 text-xs text-zinc-500">Checking for duplicates…</p>
      ) : duplicate ? (
        <DuplicateBanner duplicate={duplicate} />
      ) : null}

      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Submitted claim
      </h3>
      <dl className="grid grid-cols-[120px_1fr] gap-x-4 gap-y-3 text-sm">
        <dt className="text-zinc-500">Name</dt>
        <dd className="text-zinc-900">
          {claim.first_name} {claim.last_name}
        </dd>

        <dt className="text-zinc-500">Email</dt>
        <dd className="text-zinc-900">{claim.email}</dd>

        <dt className="text-zinc-500">Phone</dt>
        <dd className="text-zinc-900">{claim.phone || "—"}</dd>

        <dt className="text-zinc-500">Program</dt>
        <dd className="text-zinc-900">{claim.program_name ?? "—"}</dd>

        <dt className="text-zinc-500">Grad. year</dt>
        <dd className="text-zinc-900">{claim.graduation_year}</dd>

        <dt className="text-zinc-500">Notes</dt>
        <dd className="whitespace-pre-wrap text-zinc-900">
          {claim.notes || "—"}
        </dd>
      </dl>
    </>
  );
}

// =============================================================================
// DuplicateBanner — maroon warning (Option C inline design)
// =============================================================================
function DuplicateBanner({ duplicate }: { duplicate: PossibleDuplicate }) {
  const matchTypeCopy =
    duplicate.match_type === "email"
      ? "Matched on email."
      : "Matched on name and program.";

  return (
    <div className="mb-5 border-l-[3px] border-maroon-700 bg-maroon-50 px-4 py-3">
      <div className="flex items-start gap-2.5">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mt-0.5 flex-shrink-0 text-maroon-700"
          aria-hidden="true"
        >
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>

        <div className="flex-1">
          <p className="text-sm font-medium text-maroon-800">
            Possible duplicate found
          </p>
          <p className="mt-0.5 text-xs text-maroon-700">
            {matchTypeCopy} Existing contact:
          </p>

          <div className="mt-2 rounded-md border border-maroon-200 bg-white px-3 py-2.5">
            <dl className="grid grid-cols-[70px_1fr] gap-x-3 gap-y-1 text-xs">
              <dt className="text-maroon-700/70">Name</dt>
              <dd className="font-medium text-maroon-900">
                {duplicate.display_name || "(no name)"}
              </dd>

              <dt className="text-maroon-700/70">Email</dt>
              <dd className="text-maroon-900">{duplicate.email ?? "—"}</dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// ApproveForm — step 5
// =============================================================================
// Pre-filled editable form. Admin can edit any field before save. Saving calls
// the composite hook which creates a contact + program_affiliation + marks the
// claim approved. On success the modal closes and the list refreshes (handled
// by the hook's invalidateQueries).
// =============================================================================
function ApproveForm({
  claim,
  onCancel,
  onSuccess,
}: {
  claim: AlumniClaimRow;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const [firstName, setFirstName] = useState(claim.first_name);
  const [lastName, setLastName] = useState(claim.last_name);
  const [email, setEmail] = useState(claim.email);
  const [phone, setPhone] = useState(claim.phone ?? "");
  const [pronouns, setPronouns] = useState("");
  const [notes, setNotes] = useState(claim.notes ?? "");
  const [gradYear, setGradYear] = useState<number>(claim.graduation_year);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const approveMutation = useApproveClaimAndCreateContact();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    if (!firstName.trim() || !lastName.trim()) {
      setSubmitError("First and last name are required.");
      return;
    }
    if (!email.trim()) {
      setSubmitError("Email is required.");
      return;
    }

    try {
      await approveMutation.mutateAsync({
        claim_id: claim.id,
        contact_data: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          pronouns: pronouns.trim() || null,
          notes: notes.trim() || null,
          is_admin: false,
        },
        program_affiliation: {
          program_id: claim.program_id,
          affiliation_type: "student_alumni",
          // Using graduation_year for both because the public form doesn't
          // capture program start year. Backlog item to add it.
          start_year: gradYear,
          end_year: gradYear,
        },
      });
      onSuccess();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to approve claim.";
      setSubmitError(msg);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <p className="mb-4 text-xs text-zinc-500">
        Edit these fields before saving. A new contact will be created and
        attached to the program. The claim will be marked approved.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <Field label="First name" required>
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className={inputClass}
            disabled={approveMutation.isPending}
          />
        </Field>
        <Field label="Last name" required>
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className={inputClass}
            disabled={approveMutation.isPending}
          />
        </Field>
        <Field label="Email" required>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            disabled={approveMutation.isPending}
          />
        </Field>
        <Field label="Phone">
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={inputClass}
            disabled={approveMutation.isPending}
          />
        </Field>
        <Field label="Pronouns">
          <input
            type="text"
            value={pronouns}
            onChange={(e) => setPronouns(e.target.value)}
            placeholder="e.g. she/her"
            className={inputClass}
            disabled={approveMutation.isPending}
          />
        </Field>
        <Field label="Grad. year">
          <input
            type="number"
            value={gradYear}
            onChange={(e) => setGradYear(Number(e.target.value))}
            min={1900}
            max={2100}
            className={inputClass}
            disabled={approveMutation.isPending}
          />
        </Field>
      </div>

      <div className="mt-3">
        <Field label="Notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className={`${inputClass} resize-y`}
            disabled={approveMutation.isPending}
          />
        </Field>
      </div>

      {/* Program is read-only — admin can't change which program this person
          belongs to (they chose it themselves on the public form). */}
      <div className="mt-3 rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
        <span className="font-medium text-zinc-700">Program:</span>{" "}
        {claim.program_name ?? "—"}{" "}
        <span className="text-zinc-400">
          (will be attached as student/alumni)
        </span>
      </div>

      {submitError && (
        <p className="mt-3 text-sm text-rose-700">{submitError}</p>
      )}

      {/* Form action row, styled like a modal footer */}
      <div className="-mx-6 -mb-5 mt-5 flex justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-6 py-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={approveMutation.isPending}
          className="rounded-md border border-zinc-300 px-3.5 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
        >
          Back
        </button>
        <button
          type="submit"
          disabled={approveMutation.isPending}
          className="rounded-md bg-maroon-700 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-maroon-800 disabled:opacity-50"
        >
          {approveMutation.isPending ? "Saving…" : "Save & approve"}
        </button>
      </div>
    </form>
  );
}

// =============================================================================
// RejectDialog — step 6
// =============================================================================
// Stacked modal with radio reason + optional "other" textarea. Stored in
// review_notes as "spam", "other: <text>", or just "other" if textarea empty.
// =============================================================================
function RejectDialog({
  open,
  claimId,
  claimantName,
  onClose,
  onSuccess,
}: {
  open: boolean;
  claimId: string;
  claimantName: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [reason, setReason] = useState<RejectReasonChoice>("spam");
  const [otherText, setOtherText] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const rejectMutation = useRejectClaim();

  // Reset state when the dialog opens.
  useEffect(() => {
    if (open) {
      setReason("spam");
      setOtherText("");
      setSubmitError(null);
    }
  }, [open, claimId]);

  async function handleConfirm() {
    setSubmitError(null);

    let storedReason: string;
    if (reason === "spam") {
      storedReason = "spam";
    } else {
      const trimmed = otherText.trim();
      storedReason = trimmed ? `other: ${trimmed}` : "other";
    }

    try {
      await rejectMutation.mutateAsync({
        claim_id: claimId,
        reason: storedReason,
      });
      onSuccess();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to reject claim.";
      setSubmitError(msg);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Reject claim"
      subtitle={claimantName}
      size="md"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={rejectMutation.isPending}
            className="rounded-md border border-zinc-300 px-3.5 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={rejectMutation.isPending}
            className="rounded-md bg-rose-700 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-rose-800 disabled:opacity-50"
          >
            {rejectMutation.isPending ? "Rejecting…" : "Confirm reject"}
          </button>
        </>
      }
    >
      <p className="mb-4 text-sm text-zinc-600">
        Why are you rejecting this claim? Stored for audit; the person who
        submitted it will not be notified.
      </p>

      <fieldset className="space-y-2.5">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="reject-reason"
            value="spam"
            checked={reason === "spam"}
            onChange={() => setReason("spam")}
            className="text-maroon-700 focus:ring-maroon-700"
            disabled={rejectMutation.isPending}
          />
          <span>Spam</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="reject-reason"
            value="other"
            checked={reason === "other"}
            onChange={() => setReason("other")}
            className="text-maroon-700 focus:ring-maroon-700"
            disabled={rejectMutation.isPending}
          />
          <span>Other (specify)</span>
        </label>
      </fieldset>

      {reason === "other" && (
        <textarea
          value={otherText}
          onChange={(e) => setOtherText(e.target.value)}
          placeholder="Optional — explain why."
          rows={3}
          className={`mt-3 ${inputClass} resize-y`}
          disabled={rejectMutation.isPending}
        />
      )}

      {submitError && (
        <p className="mt-3 text-sm text-rose-700">{submitError}</p>
      )}
    </Modal>
  );
}

// =============================================================================
// Small helpers
// =============================================================================
const inputClass =
  "w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-maroon-700 focus:outline-none focus:ring-1 focus:ring-maroon-700 disabled:bg-zinc-50";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-zinc-600">
        {label}
        {required && <span className="text-rose-600"> *</span>}
      </span>
      {children}
    </label>
  );
}

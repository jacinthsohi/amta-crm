// src/features/admin/AlumniClaimsPage.tsx
// =============================================================================
// /admin/alumni-claims
// =============================================================================
// View claims submitted via the public alumni signup form. Filter by status.
// Click a row to open the review modal.
//
// Step 4 wired up: clicking a row sets selectedClaim state, which opens the
// AlumniClaimReviewModal. Approve/Reject buttons inside the modal currently
// console.log — actual wiring is steps 5 and 6.
// =============================================================================

import { useState } from "react";
import {
  useAlumniClaims,
  type AlumniClaimRow,
  type AlumniClaimStatus,
} from "./alumni-claims-hooks";
import AlumniClaimReviewModal from "./AlumniClaimReviewModal";

type StatusFilter = AlumniClaimStatus | "all";

const STATUS_STYLES: Record<AlumniClaimStatus, string> = {
  pending: "bg-amber-50 text-amber-800 border-amber-200",
  approved: "bg-emerald-50 text-emerald-800 border-emerald-200",
  rejected: "bg-rose-50 text-rose-800 border-rose-200",
};

function StatusBadge({ status }: { status: AlumniClaimStatus }) {
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}

function relativeTime(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export default function AlumniClaimsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [selectedClaim, setSelectedClaim] = useState<AlumniClaimRow | null>(
    null,
  );
  const { data: claims, isLoading, error } = useAlumniClaims(statusFilter);

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-900">Alumni claims</h1>
        <p className="mt-1 text-sm text-zinc-600">
          People who filled out the public alumni signup form. Review each
          claim and approve (creates a contact) or reject.
        </p>
      </header>

      {/* Filter bar */}
      <section className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label
            htmlFor="status-filter"
            className="text-xs font-medium text-zinc-600"
          >
            Status:
          </label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="rounded-md border border-zinc-300 px-2 py-1 text-sm focus:border-maroon-700 focus:outline-none focus:ring-1 focus:ring-maroon-700"
          >
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="all">All</option>
          </select>
        </div>
        <div className="text-xs text-zinc-500">
          {claims ? `${claims.length} claim${claims.length === 1 ? "" : "s"}` : ""}
        </div>
      </section>

      {/* List */}
      <section>
        {error ? (
          <p className="text-sm text-rose-700">
            Couldn't load claims. {error instanceof Error ? error.message : ""}
          </p>
        ) : isLoading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : !claims || claims.length === 0 ? (
          <EmptyState statusFilter={statusFilter} />
        ) : (
          <ClaimsTable claims={claims} onSelect={setSelectedClaim} />
        )}
      </section>

      {/* Review modal — opens when a row is clicked */}
      <AlumniClaimReviewModal
        claim={selectedClaim}
        onClose={() => setSelectedClaim(null)}
      />
    </div>
  );
}

// -----------------------------------------------------------------------------
// ClaimsTable
// -----------------------------------------------------------------------------
function ClaimsTable({
  claims,
  onSelect,
}: {
  claims: AlumniClaimRow[];
  onSelect: (claim: AlumniClaimRow) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-4 py-2 font-medium">Submitted</th>
            <th className="px-4 py-2 font-medium">Name</th>
            <th className="px-4 py-2 font-medium">Email</th>
            <th className="px-4 py-2 font-medium">Program</th>
            <th className="px-4 py-2 font-medium">Grad. year</th>
            <th className="px-4 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {claims.map((claim) => (
            <tr
              key={claim.id}
              className="cursor-pointer hover:bg-zinc-50"
              onClick={() => onSelect(claim)}
            >
              <td className="px-4 py-3 text-zinc-600">
                {relativeTime(claim.created_at)}
              </td>
              <td className="px-4 py-3 text-zinc-900">
                {claim.first_name} {claim.last_name}
              </td>
              <td className="px-4 py-3 text-zinc-600">{claim.email}</td>
              <td className="px-4 py-3 text-zinc-600">
                {claim.program_name ?? "—"}
              </td>
              <td className="px-4 py-3 text-zinc-600">
                {claim.graduation_year}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={claim.status as AlumniClaimStatus} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// -----------------------------------------------------------------------------
// EmptyState — different copy based on which filter is active
// -----------------------------------------------------------------------------
function EmptyState({ statusFilter }: { statusFilter: StatusFilter }) {
  const copy: Record<StatusFilter, string> = {
    pending:
      "No claims awaiting review. New submissions from the public signup form will appear here.",
    approved: "No approved claims yet.",
    rejected: "No rejected claims yet.",
    all: "No claims yet. New submissions from the public signup form will appear here.",
  };
  return (
    <div className="rounded-lg border border-dashed border-zinc-200 bg-white p-8 text-center">
      <p className="text-sm text-zinc-500">{copy[statusFilter]}</p>
    </div>
  );
}

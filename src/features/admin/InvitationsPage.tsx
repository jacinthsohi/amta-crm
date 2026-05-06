// src/features/admin/InvitationsPage.tsx
// =============================================================================
// /admin/invitations
// =============================================================================
// Pick an existing contact (with email), send them an invitation. View pending,
// accepted, expired, and revoked invitations. Revoke or resend any of them.
// =============================================================================

import { useMemo, useState } from "react";
import {
  useInvitations,
  useInvitableContacts,
  useSendInvitation,
  useRevokeInvitation,
  useResendInvitation,
  type InvitationRow,
  type InvitationStatus,
} from "./hooks";

const STATUS_STYLES: Record<InvitationStatus, string> = {
  pending: "bg-amber-50 text-amber-800 border-amber-200",
  accepted: "bg-emerald-50 text-emerald-800 border-emerald-200",
  expired: "bg-zinc-100 text-zinc-600 border-zinc-200",
  revoked: "bg-rose-50 text-rose-800 border-rose-200",
};

function StatusBadge({ status }: { status: InvitationStatus }) {
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

export default function InvitationsPage() {
  const [search, setSearch] = useState("");
  const [selectedContactId, setSelectedContactId] = useState<string | null>(
    null,
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const { data: invitations, isLoading: invitesLoading } = useInvitations();
  const { data: invitableContacts, isLoading: contactsLoading } =
    useInvitableContacts();

  const sendMutation = useSendInvitation();
  const revokeMutation = useRevokeInvitation();
  const resendMutation = useResendInvitation();

  // Filter invitable contacts by search
  const filteredContacts = useMemo(() => {
    if (!invitableContacts) return [];
    const q = search.trim().toLowerCase();
    if (!q) return invitableContacts.slice(0, 50);
    return invitableContacts
      .filter((c) => {
        const name = `${c.first_name ?? ""} ${c.last_name ?? ""}`.toLowerCase();
        return (
          name.includes(q) ||
          c.email.toLowerCase().includes(q)
        );
      })
      .slice(0, 50);
  }, [invitableContacts, search]);

  const selectedContact = useMemo(
    () =>
      invitableContacts?.find((c) => c.id === selectedContactId) ?? null,
    [invitableContacts, selectedContactId],
  );

  async function handleSend() {
    setFormError(null);
    setFlash(null);
    if (!selectedContact) {
      setFormError("Pick a contact to invite.");
      return;
    }
    try {
      await sendMutation.mutateAsync({
        contact_id: selectedContact.id,
        email: selectedContact.email,
      });
      setFlash(
        `Invitation sent to ${selectedContact.first_name ?? ""} ${
          selectedContact.last_name ?? ""
        } (${selectedContact.email}).`,
      );
      setSelectedContactId(null);
      setSearch("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to send invitation.";
      setFormError(msg);
    }
  }

  async function handleRevoke(row: InvitationRow) {
    if (!confirm(`Revoke invitation for ${row.email}?`)) return;
    try {
      await revokeMutation.mutateAsync(row.id);
      setFlash(`Revoked invitation for ${row.email}.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to revoke.";
      setFormError(msg);
    }
  }

  async function handleResend(row: InvitationRow) {
    try {
      await resendMutation.mutateAsync(row.id);
      setFlash(`Refreshed invitation for ${row.email}. New expiry: 14 days.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to resend.";
      setFormError(msg);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-900">Invitations</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Invite people to the AMTA CRM. Only invited emails (or existing
          contacts) can sign in.
        </p>
      </header>

      {/* Send form */}
      <section className="mb-8 rounded-lg border border-zinc-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-medium text-zinc-900">
          Send a new invitation
        </h2>

        <p className="mb-3 text-xs text-zinc-500">
          Pick an existing contact to invite. They must have an email on file.
          To invite someone new, add them as a contact first.
        </p>

        {/* Contact picker */}
        <div className="mb-3">
          <input
            type="text"
            value={
              selectedContact
                ? `${selectedContact.first_name ?? ""} ${selectedContact.last_name ?? ""} (${selectedContact.email})`
                : search
            }
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedContactId(null);
            }}
            onFocus={() => {
              if (selectedContact) {
                setSelectedContactId(null);
                setSearch("");
              }
            }}
            placeholder={
              contactsLoading
                ? "Loading contacts…"
                : "Search by name or email…"
            }
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-maroon-700 focus:outline-none focus:ring-1 focus:ring-maroon-700"
            disabled={sendMutation.isPending}
          />

          {/* Dropdown of matching contacts */}
          {!selectedContact && search.length > 0 && (
            <div className="mt-1 max-h-64 overflow-y-auto rounded-md border border-zinc-200 bg-white shadow-sm">
              {filteredContacts.length === 0 ? (
                <div className="px-3 py-2 text-sm text-zinc-500">
                  No matching contacts with email on file.
                </div>
              ) : (
                filteredContacts.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setSelectedContactId(c.id);
                      setSearch("");
                    }}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-zinc-50"
                  >
                    <span className="font-medium text-zinc-900">
                      {c.first_name} {c.last_name}
                    </span>
                    <span className="text-xs text-zinc-500">{c.email}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSend}
            disabled={sendMutation.isPending || !selectedContact}
            className="rounded-md bg-maroon-700 px-4 py-2 text-sm font-medium text-white hover:bg-maroon-800 disabled:opacity-50"
          >
            {sendMutation.isPending ? "Sending…" : "Send invitation"}
          </button>
          {selectedContact && (
            <button
              type="button"
              onClick={() => {
                setSelectedContactId(null);
                setSearch("");
              }}
              className="text-xs text-zinc-500 hover:text-zinc-700"
            >
              Clear
            </button>
          )}
        </div>

        {formError && (
          <p className="mt-2 text-sm text-rose-700">{formError}</p>
        )}
        {flash && <p className="mt-2 text-sm text-emerald-700">{flash}</p>}
      </section>

      {/* List */}
      <section>
        <h2 className="mb-3 text-sm font-medium text-zinc-900">
          All invitations
        </h2>
        {invitesLoading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : !invitations || invitations.length === 0 ? (
          <p className="text-sm text-zinc-500">No invitations yet.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Email</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Sent</th>
                  <th className="px-4 py-2 font-medium">Expires</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {invitations.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3 text-zinc-900">{row.email}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={row.computed_status} />
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      {relativeTime(row.sent_at ?? row.created_at)}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      {row.computed_status === "accepted" || !row.expires_at
                        ? "—"
                        : new Date(row.expires_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {row.computed_status !== "accepted" && (
                          <button
                            onClick={() => handleResend(row)}
                            disabled={resendMutation.isPending}
                            className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                          >
                            Resend
                          </button>
                        )}
                        {row.computed_status === "pending" && (
                          <button
                            onClick={() => handleRevoke(row)}
                            disabled={revokeMutation.isPending}
                            className="rounded-md border border-rose-200 px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                          >
                            Revoke
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

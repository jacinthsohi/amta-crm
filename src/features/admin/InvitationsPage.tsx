// src/features/admin/InvitationsPage.tsx
// =============================================================================
// /admin/invitations
// =============================================================================
// Send a new invitation, view pending/expired/revoked, revoke, resend.
// =============================================================================

import { useState } from 'react'
import {
  useInvitations,
  useSendInvitation,
  useRevokeInvitation,
  useResendInvitation,
  type InvitationRow,
  type InvitationStatus,
} from './hooks'

const STATUS_STYLES: Record<InvitationStatus, string> = {
  pending: 'bg-amber-50 text-amber-800 border-amber-200',
  accepted: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  expired: 'bg-neutral-100 text-neutral-600 border-neutral-200',
  revoked: 'bg-rose-50 text-rose-800 border-rose-200',
}

function StatusBadge({ status }: { status: InvitationStatus }) {
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  )
}

function relativeTime(iso: string) {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days}d ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

export default function InvitationsPage() {
  const [email, setEmail] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)

  const { data: invitations, isLoading } = useInvitations()
  const sendMutation = useSendInvitation()
  const revokeMutation = useRevokeInvitation()
  const resendMutation = useResendInvitation()

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    setFlash(null)
    const trimmed = email.trim().toLowerCase()
    if (!trimmed || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
      setFormError('Please enter a valid email address.')
      return
    }
    // Client-side dedupe check (server enforces too via unique index, presumably)
    const existingPending = invitations?.find(
      i => i.email.toLowerCase() === trimmed && i.computed_status === 'pending'
    )
    if (existingPending) {
      setFormError('A pending invitation already exists for this email. Resend it instead.')
      return
    }
    try {
      await sendMutation.mutateAsync(trimmed)
      setEmail('')
      setFlash(`Invitation sent to ${trimmed}.`)
    } catch (err: any) {
      setFormError(err.message || 'Failed to send invitation.')
    }
  }

  async function handleRevoke(row: InvitationRow) {
    if (!confirm(`Revoke invitation for ${row.email}?`)) return
    try {
      await revokeMutation.mutateAsync(row.id)
      setFlash(`Revoked invitation for ${row.email}.`)
    } catch (err: any) {
      setFormError(err.message || 'Failed to revoke.')
    }
  }

  async function handleResend(row: InvitationRow) {
    try {
      await resendMutation.mutateAsync(row.id)
      setFlash(`Refreshed invitation for ${row.email}. New expiry: 14 days.`)
    } catch (err: any) {
      setFormError(err.message || 'Failed to resend.')
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-neutral-900">Invitations</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Invite people to the AMTA CRM. Only invited emails (or existing contacts)
          can sign in.
        </p>
      </header>

      {/* Send form */}
      <section className="mb-8 rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-medium text-neutral-900">Send a new invitation</h2>
        <form onSubmit={handleSend} className="flex flex-col gap-3 sm:flex-row">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="name@example.com"
            className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-[#70172a] focus:outline-none focus:ring-1 focus:ring-[#70172a]"
            disabled={sendMutation.isPending}
          />
          <button
            type="submit"
            disabled={sendMutation.isPending}
            className="rounded-md bg-[#70172a] px-4 py-2 text-sm font-medium text-white hover:bg-[#5a1222] disabled:opacity-50"
          >
            {sendMutation.isPending ? 'Sending…' : 'Send invitation'}
          </button>
        </form>
        {formError && <p className="mt-2 text-sm text-rose-700">{formError}</p>}
        {flash && <p className="mt-2 text-sm text-emerald-700">{flash}</p>}
      </section>

      {/* List */}
      <section>
        <h2 className="mb-3 text-sm font-medium text-neutral-900">All invitations</h2>
        {isLoading ? (
          <p className="text-sm text-neutral-500">Loading…</p>
        ) : !invitations || invitations.length === 0 ? (
          <p className="text-sm text-neutral-500">No invitations yet.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Email</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Sent</th>
                  <th className="px-4 py-2 font-medium">Expires</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {invitations.map(row => (
                  <tr key={row.id}>
                    <td className="px-4 py-3 text-neutral-900">{row.email}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={row.computed_status} />
                    </td>
                    <td className="px-4 py-3 text-neutral-600">
                      {relativeTime(row.created_at)}
                    </td>
                    <td className="px-4 py-3 text-neutral-600">
                      {row.computed_status === 'accepted'
                        ? '—'
                        : new Date(row.expires_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {row.computed_status !== 'accepted' && (
                          <button
                            onClick={() => handleResend(row)}
                            disabled={resendMutation.isPending}
                            className="rounded-md border border-neutral-300 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                          >
                            Resend
                          </button>
                        )}
                        {row.computed_status === 'pending' && (
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
  )
}

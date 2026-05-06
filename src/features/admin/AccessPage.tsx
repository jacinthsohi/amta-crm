// src/features/admin/AccessPage.tsx
// =============================================================================
// /admin/access
// =============================================================================
// Read-only list of who currently has access to the CRM. Combines:
//   - Active contacts (their email gets them in)
//   - Accepted-but-orphaned invitations (no contact row yet)
// =============================================================================

import { useMemo, useState } from 'react'
import { useAccessList } from './hooks'

export default function AccessPage() {
  const { data, isLoading } = useAccessList()
  const [filter, setFilter] = useState('')

  const filtered = useMemo(() => {
    if (!data) return []
    const q = filter.trim().toLowerCase()
    if (!q) return data
    return data.filter(
      e =>
        e.email.toLowerCase().includes(q) ||
        (e.name && e.name.toLowerCase().includes(q))
    )
  }, [data, filter])

  const adminCount = data?.filter(e => e.is_admin).length ?? 0
  const totalCount = data?.length ?? 0

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-neutral-900">Access</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Everyone who can currently sign in. {totalCount} total, {adminCount} admin
          {adminCount === 1 ? '' : 's'}.
        </p>
      </header>

      <div className="mb-4">
        <input
          type="search"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Filter by name or email…"
          className="w-full max-w-sm rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-[#70172a] focus:outline-none focus:ring-1 focus:ring-[#70172a]"
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-neutral-500">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-neutral-500">No matches.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Source</th>
                <th className="px-4 py-2 font-medium">Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filtered.map(entry => (
                <tr key={`${entry.source}-${entry.email}`}>
                  <td className="px-4 py-3 text-neutral-900">
                    {entry.name ?? <span className="text-neutral-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-neutral-700">{entry.email}</td>
                  <td className="px-4 py-3 text-neutral-600 capitalize">
                    {entry.source}
                  </td>
                  <td className="px-4 py-3">
                    {entry.is_admin ? (
                      <span className="inline-block rounded-full border border-[#70172a]/20 bg-[#70172a]/5 px-2 py-0.5 text-xs font-medium text-[#70172a]">
                        Admin
                      </span>
                    ) : (
                      <span className="text-xs text-neutral-500">Member</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

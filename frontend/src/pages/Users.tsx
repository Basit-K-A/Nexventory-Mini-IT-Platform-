import { useCallback, useEffect, useMemo, useState } from 'react'
import { listUsers, updateUserRole } from '../api/users'
import type { PaginationMeta } from '../api/types'
import { Card } from '../components/Card'
import { EmptyState } from '../components/EmptyState'
import { ErrorMessage } from '../components/ErrorMessage'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { Pagination } from '../components/Pagination'
import { useAuth } from '../hooks/useAuth'
import type { User } from '../types/user'
import { createRequestGuard } from '../utils/requestGuard'

const loadGuard = createRequestGuard()

const ROLE_OPTIONS = ['admin', 'analyst', 'technician', 'viewer']

export function UsersPage() {
  const { user, loading: authLoading, canViewUsers, canManageUsers } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [pagination, setPagination] = useState<PaginationMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [savingId, setSavingId] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const [draftRoles, setDraftRoles] = useState<Record<number, string>>({})

  const queryKey = useMemo(() => JSON.stringify({ page }), [page])

  const load = useCallback(async () => {
    if (!user || !canViewUsers) return
    const requestId = loadGuard.next()
    setLoading(true)
    setError('')
    try {
      const response = await listUsers({ page, limit: 20, sort_by: 'created_at', sort_order: 'desc' })
      if (!loadGuard.isCurrent(requestId)) return
      setUsers(response.data)
      setPagination(response.pagination)
      setDraftRoles((prev) => {
        // Preserve any in-flight edits; otherwise initialize drafts from server role.
        const next: Record<number, string> = { ...prev }
        for (const u of response.data) {
          if (next[u.id] === undefined) next[u.id] = u.role
        }
        return next
      })
    } catch (err) {
      if (!loadGuard.isCurrent(requestId)) return
      setError(err instanceof Error ? err.message : 'Failed to load users')
    } finally {
      if (loadGuard.isCurrent(requestId)) setLoading(false)
    }
  }, [user, canViewUsers, page])

  useEffect(() => {
    if (authLoading || !user) return
    void load()
  }, [authLoading, user, queryKey, load])

  async function handleSaveRole(target: User) {
    if (!canManageUsers) return
    const role = draftRoles[target.id] ?? target.role
    if (role === target.role) return
    setSavingId(target.id)
    setError('')
    try {
      const updated = await updateUserRole(target.id, role)
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
      setDraftRoles((prev) => ({ ...prev, [updated.id]: updated.role }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role')
    } finally {
      setSavingId(null)
    }
  }

  if (!canViewUsers) {
    return (
      <div className="page">
        <h1>Users</h1>
        <ErrorMessage message="Forbidden" />
      </div>
    )
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Users</h1>
          <p className="page-header__subtitle">
            {canManageUsers ? 'Admin: manage user roles' : 'Read-only (admin / analyst)'}
          </p>
        </div>
        <button type="button" className="btn btn--ghost" onClick={() => load()} disabled={loading}>
          Retry
        </button>
      </header>

      <ErrorMessage message={error} />

      <Card title={pagination ? `Users (${pagination.total_records})` : 'Users'}>
        {loading ? (
          <LoadingSpinner label="Loading users…" />
        ) : users.length === 0 ? (
          <EmptyState title="No users" description="No user records were found." />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Active</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    (() => {
                      const draft = draftRoles[u.id] ?? u.role
                      const dirty = draft !== u.role
                      return (
                    <tr key={u.id}>
                      <td>{u.id}</td>
                      <td>{u.username}</td>
                      <td>{u.email}</td>
                      <td>
                        {canManageUsers ? (
                          <div className="table-actions">
                            <select
                              value={draft}
                              disabled={savingId === u.id}
                              onChange={(e) =>
                                setDraftRoles((prev) => ({ ...prev, [u.id]: e.target.value }))
                              }
                            >
                              {ROLE_OPTIONS.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              className="btn btn--ghost btn--small"
                              disabled={savingId === u.id || !dirty}
                              onClick={() => handleSaveRole(u)}
                              title={dirty ? 'Save role change' : 'No changes to save'}
                            >
                              Save
                            </button>
                          </div>
                        ) : (
                          <code>{u.role}</code>
                        )}
                      </td>
                      <td>{u.is_active ? 'yes' : 'no'}</td>
                      <td>{u.created_at ? new Date(u.created_at).toLocaleString() : '—'}</td>
                    </tr>
                      )
                    })()
                  ))}
                </tbody>
              </table>
            </div>
            {pagination ? (
              <Pagination meta={pagination} disabled={loading} onPageChange={(p) => setPage(p)} />
            ) : null}
          </>
        )}
      </Card>
    </div>
  )
}


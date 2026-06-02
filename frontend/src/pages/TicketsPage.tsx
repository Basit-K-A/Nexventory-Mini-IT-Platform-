import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '../components/Badge'
import { EmptyState } from '../components/EmptyState'
import { ErrorMessage } from '../components/ErrorMessage'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { Pagination } from '../components/Pagination'
import { CreateTicketModal } from '../components/tickets/CreateTicketModal'
import { TicketFilterChips } from '../components/tickets/TicketFilterChips'
import { TicketSelect } from '../components/tickets/TicketSelect'
import { useAuth } from '../hooks/useAuth'
import { assignTicketToSelf, createTicket, deleteTicket, getTickets } from '../services/tickets'
import type { Ticket, TicketCreate } from '../types/ticket'
import type { TicketListQuery } from '../services/tickets'
import { createRequestGuard } from '../utils/requestGuard'
import { priorityVariant, statusVariant } from '../utils/ticketStatus'
import type { PaginationMeta } from '../api/types'

const loadGuard = createRequestGuard()

const STAFF_STATUS_FILTERS = [
  { value: '', label: 'All statuses' },
  { value: 'Open', label: 'Open' },
  { value: 'In Progress', label: 'In Progress' },
  { value: 'Resolved', label: 'Resolved' },
  { value: 'Closed', label: 'Closed' },
] as const

type AssignmentFilter = 'all' | 'assigned_to_me'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString()
}

export function TicketsPage() {
  const { user, loading: authLoading, permissions } = useAuth()
  const isStaff = permissions.canManageTickets
  const isAdmin = permissions.canDeleteTickets

  const [tickets, setTickets] = useState<Ticket[]>([])
  const [pagination, setPagination] = useState<PaginationMeta | null>(null)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [localError, setLocalError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showCreate, setShowCreate] = useState(false)

  const listQuery = useMemo((): TicketListQuery => {
    const base: TicketListQuery = {
      page,
      limit: 20,
      sort_by: 'updated_at',
      sort_order: 'desc',
      search: search.trim() || undefined,
      status: statusFilter || undefined,
    }
    if (!isStaff) {
      return { ...base, mine_only: true }
    }
    if (assignmentFilter === 'assigned_to_me') {
      return { ...base, assigned_to_me: true }
    }
    return base
  }, [page, search, statusFilter, assignmentFilter, isStaff])

  const load = useCallback(async () => {
    if (!user) return
    const requestId = loadGuard.next()
    setLoading(true)
    setError('')
    try {
      const response = await getTickets(listQuery)
      if (!loadGuard.isCurrent(requestId)) return
      setTickets(response.data)
      setPagination(response.pagination)
    } catch (err) {
      if (!loadGuard.isCurrent(requestId)) return
      setError(err instanceof Error ? err.message : 'Failed to load tickets')
    } finally {
      if (loadGuard.isCurrent(requestId)) setLoading(false)
    }
  }, [user, listQuery])

  useEffect(() => {
    if (authLoading || !user) return
    void load()
  }, [authLoading, user, load])

  useEffect(() => {
    setPage(1)
  }, [search, statusFilter, assignmentFilter])

  async function handleCreate(data: TicketCreate) {
    setSubmitting(true)
    setLocalError('')
    try {
      await createTicket(data)
      setShowCreate(false)
      setPage(1)
      await load()
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to create ticket')
      throw err
    } finally {
      setSubmitting(false)
    }
  }

  async function handleAssignToMe(ticket: Ticket) {
    if (!permissions.canAssignTickets) return
    setSubmitting(true)
    setLocalError('')
    try {
      await assignTicketToSelf(ticket.id)
      await load()
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to assign ticket')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(ticket: Ticket) {
    if (!isAdmin) return
    if (!window.confirm(`Delete ticket ${ticket.ticket_number}?`)) return
    setSubmitting(true)
    setLocalError('')
    try {
      await deleteTicket(ticket.id)
      await load()
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to delete ticket')
    } finally {
      setSubmitting(false)
    }
  }

  const subtitle = isAdmin
    ? 'Manage assignments, priorities, and ticket lifecycle'
    : isStaff
      ? 'Triage queues, assign work, and update ticket status'
      : 'Submit and track your IT support requests'

  return (
    <div className="page tickets-ui">
      <header className="page-header">
        <div>
          <h1>Tickets</h1>
          <p className="page-header__subtitle">{subtitle}</p>
        </div>
        {permissions.canCreateTickets && (
          <button
            type="button"
            className="ticket-btn ticket-btn--primary"
            onClick={() => setShowCreate(true)}
          >
            Create ticket
          </button>
        )}
      </header>

      <ErrorMessage message={error || localError} />

      <div className="ticket-toolbar">
        <div className="ticket-toolbar__grow">
          <input
            type="search"
            className="ticket-search"
            placeholder={isStaff ? 'Search title or ticket number…' : 'Search your tickets…'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search tickets"
          />
        </div>
        {isStaff && (
          <>
            <TicketFilterChips value={assignmentFilter} onChange={setAssignmentFilter} />
            <TicketSelect
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by status"
            >
              {STAFF_STATUS_FILTERS.map((opt) => (
                <option key={opt.value || 'all'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </TicketSelect>
          </>
        )}
        <button
          type="button"
          className="ticket-btn ticket-btn--ghost"
          onClick={() => void load()}
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <LoadingSpinner label="Loading tickets…" />
      ) : tickets.length === 0 ? (
        <EmptyState
          title="No tickets found"
          description={
            assignmentFilter === 'assigned_to_me'
              ? 'No tickets are assigned to you. Try “All tickets” or assign an unassigned ticket.'
              : isStaff
                ? 'No tickets match your filters. Try clearing search or status filters.'
                : 'You have not created any tickets yet. Use Create ticket to submit a request.'
          }
        />
      ) : (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ticket #</th>
                  <th>Title</th>
                  <th>Priority</th>
                  <th>Status</th>
                  {isStaff && <th>Creator</th>}
                  {isStaff && <th>Assigned</th>}
                  <th>Created</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => (
                  <tr key={ticket.id}>
                    <td>
                      <code>{ticket.ticket_number}</code>
                    </td>
                    <td>{ticket.title}</td>
                    <td>
                      <Badge label={ticket.priority} variant={priorityVariant(ticket.priority)} />
                    </td>
                    <td>
                      <Badge label={ticket.status} variant={statusVariant(ticket.status)} />
                    </td>
                    {isStaff && <td>#{ticket.created_by}</td>}
                    {isStaff && (
                      <td>{ticket.assigned_to ? `#${ticket.assigned_to}` : 'Unassigned'}</td>
                    )}
                    <td>{formatDate(ticket.created_at)}</td>
                    <td className="data-table__actions">
                      <Link
                        to={`/tickets/${ticket.id}`}
                        className="ticket-btn ticket-btn--secondary"
                      >
                        View
                      </Link>
                      {permissions.canAssignTickets && !ticket.assigned_to && (
                        <button
                          type="button"
                          className="ticket-btn ticket-btn--accent-outline"
                          disabled={submitting}
                          onClick={() => void handleAssignToMe(ticket)}
                        >
                          Assign to me
                        </button>
                      )}
                      {isAdmin && (
                        <button
                          type="button"
                          className="ticket-btn ticket-btn--danger"
                          disabled={submitting}
                          onClick={() => void handleDelete(ticket)}
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pagination && (
            <Pagination
              meta={pagination}
              disabled={loading || submitting}
              onPageChange={(p) => setPage(p)}
            />
          )}
        </>
      )}

      <CreateTicketModal
        open={showCreate}
        submitting={submitting}
        onClose={() => setShowCreate(false)}
        onSubmit={handleCreate}
      />
    </div>
  )
}

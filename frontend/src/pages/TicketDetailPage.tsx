import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { listUsers } from '../api/users'
import { Badge } from '../components/Badge'
import { Card } from '../components/Card'
import { ErrorMessage } from '../components/ErrorMessage'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { useAuth } from '../hooks/useAuth'
import {
  assignTicketToSelf,
  deleteTicket,
  getTicket,
  reassignTicket,
  updateStatus,
} from '../services/tickets'
import type { TicketDetail } from '../types/ticket'
import type { User } from '../types/user'
import { TicketSelect } from '../components/tickets/TicketSelect'
import {
  priorityVariant,
  statusVariant,
  TICKET_STATUSES,
} from '../utils/ticketStatus'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString()
}

export function TicketDetailPage() {
  const { id } = useParams<{ id: string }>()
  const ticketId = Number(id)
  const navigate = useNavigate()
  const { user, loading: authLoading, permissions } = useAuth()

  const [ticket, setTicket] = useState<TicketDetail | null>(null)
  const [staffUsers, setStaffUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [statusDraft, setStatusDraft] = useState('')
  const [resolutionDraft, setResolutionDraft] = useState('')
  const [reassignTo, setReassignTo] = useState<string>('')

  const isStaff = permissions.canManageTickets
  const isAdmin = permissions.canDeleteTickets

  const load = useCallback(async () => {
    if (!user || !Number.isFinite(ticketId)) return
    setLoading(true)
    setError('')
    try {
      const detail = await getTicket(ticketId)
      setTicket(detail)
      setStatusDraft(detail.status)
      setResolutionDraft(detail.resolution_notes ?? '')
      setReassignTo(detail.assigned_to ? String(detail.assigned_to) : '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load ticket')
      setTicket(null)
    } finally {
      setLoading(false)
    }
  }, [user, ticketId])

  useEffect(() => {
    if (authLoading || !user) return
    if (!Number.isFinite(ticketId)) {
      setError('Invalid ticket id')
      setLoading(false)
      return
    }
    void load()
  }, [authLoading, user, load, ticketId])

  useEffect(() => {
    if (!isAdmin || !permissions.canViewUsers) return
    let cancelled = false
    void listUsers({ page: 1, limit: 100, sort_by: 'username', sort_order: 'asc' })
      .then((res) => {
        if (cancelled) return
        const staff = res.data.filter((u) =>
          ['admin', 'technician', 'analyst'].includes(u.role.toLowerCase()),
        )
        setStaffUsers(staff)
      })
      .catch(() => {
        if (!cancelled) setStaffUsers([])
      })
    return () => {
      cancelled = true
    }
  }, [isAdmin, permissions.canViewUsers])

  async function handleStatusSave(e: FormEvent) {
    e.preventDefault()
    if (!ticket || !isStaff) return
    setSubmitting(true)
    setError('')
    try {
      await updateStatus(ticket.id, statusDraft, resolutionDraft || null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleAssignToMe() {
    if (!ticket || !permissions.canAssignTickets) return
    setSubmitting(true)
    setError('')
    try {
      await assignTicketToSelf(ticket.id)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign ticket')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleReassign(e: FormEvent) {
    e.preventDefault()
    if (!ticket || !isAdmin) return
    setSubmitting(true)
    setError('')
    try {
      const assignedTo = reassignTo === '' ? null : Number(reassignTo)
      await reassignTicket(ticket.id, assignedTo)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reassign ticket')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!ticket || !isAdmin) return
    if (!window.confirm(`Delete ticket ${ticket.ticket_number}?`)) return
    setSubmitting(true)
    setError('')
    try {
      await deleteTicket(ticket.id)
      navigate('/tickets', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete ticket')
    } finally {
      setSubmitting(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="page">
        <LoadingSpinner label="Loading ticket…" />
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className="page">
        <ErrorMessage message={error || 'Ticket not found'} />
        <Link to="/tickets" className="link-inline">
          ← Back to tickets
        </Link>
      </div>
    )
  }

  return (
    <div className="page tickets-ui">
      <header className="page-header">
        <div>
          <p className="muted">
            <Link to="/tickets">Tickets</Link>
            <span aria-hidden="true"> / </span>
            <code>{ticket.ticket_number}</code>
          </p>
          <h1>{ticket.title}</h1>
        </div>
        <div className="page-header__actions">
          {permissions.canAssignTickets && !ticket.assigned_to && (
            <button
              type="button"
              className="ticket-btn ticket-btn--accent-outline"
              disabled={submitting}
              onClick={() => void handleAssignToMe()}
            >
              Assign to me
            </button>
          )}
          {isAdmin && (
            <button
              type="button"
              className="ticket-btn ticket-btn--danger"
              disabled={submitting}
              onClick={() => void handleDelete()}
            >
              Delete ticket
            </button>
          )}
        </div>
      </header>

      <ErrorMessage message={error} />

      <div className="ticket-detail-meta">
        <Badge label={ticket.priority} variant={priorityVariant(ticket.priority)} />
        <Badge label={ticket.status} variant={statusVariant(ticket.status)} />
        <span className="muted">{ticket.category}</span>
      </div>

      <div className="dashboard-grid">
        <Card title="Details">
          <dl className="detail-list">
            <div>
              <dt>Ticket number</dt>
              <dd>
                <code>{ticket.ticket_number}</code>
              </dd>
            </div>
            <div>
              <dt>Description</dt>
              <dd className="ticket-detail__body">{ticket.description}</dd>
            </div>
            <div>
              <dt>Creator</dt>
              <dd>User #{ticket.created_by}</dd>
            </div>
            <div>
              <dt>Assigned technician</dt>
              <dd>{ticket.assigned_to ? `User #${ticket.assigned_to}` : 'Unassigned'}</dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>
                <time dateTime={ticket.created_at}>{formatDate(ticket.created_at)}</time>
              </dd>
            </div>
            <div>
              <dt>Last updated</dt>
              <dd>
                <time dateTime={ticket.updated_at}>{formatDate(ticket.updated_at)}</time>
              </dd>
            </div>
            {ticket.resolution_notes && (
              <div>
                <dt>Resolution notes</dt>
                <dd className="ticket-detail__body">{ticket.resolution_notes}</dd>
              </div>
            )}
          </dl>
        </Card>

        {isStaff && (
          <Card title="Change status">
            <form className="ticket-form-grid" onSubmit={handleStatusSave}>
              <TicketSelect
                label="Status"
                value={statusDraft}
                onChange={(e) => setStatusDraft(e.target.value)}
              >
                {TICKET_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </TicketSelect>
              <label className="ticket-field ticket-field--full">
                <span className="ticket-field__label">Resolution notes</span>
                <textarea
                  className="ticket-textarea"
                  rows={4}
                  value={resolutionDraft}
                  onChange={(e) => setResolutionDraft(e.target.value)}
                />
              </label>
              <div className="ticket-form-actions">
                <button
                  type="submit"
                  className="ticket-btn ticket-btn--primary"
                  disabled={submitting}
                >
                  Save status
                </button>
              </div>
            </form>
          </Card>
        )}

        {isAdmin && (
          <Card title="Reassign ticket">
            <form className="ticket-form-grid" onSubmit={handleReassign}>
              <TicketSelect
                className="ticket-field--full"
                label="Technician"
                value={reassignTo}
                onChange={(e) => setReassignTo(e.target.value)}
              >
                <option value="">Unassigned</option>
                {staffUsers.map((u) => (
                  <option key={u.id} value={String(u.id)}>
                    {u.username} ({u.role})
                  </option>
                ))}
              </TicketSelect>
              <div className="ticket-form-actions">
                <button
                  type="submit"
                  className="ticket-btn ticket-btn--primary"
                  disabled={submitting}
                >
                  Save assignment
                </button>
              </div>
            </form>
          </Card>
        )}
      </div>
    </div>
  )
}

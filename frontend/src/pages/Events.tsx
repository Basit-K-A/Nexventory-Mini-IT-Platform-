import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { createEvent, listEvents, resolveEvent, updateEvent } from '../api/events'
import { Badge } from '../components/Badge'
import { Card } from '../components/Card'
import { EmptyState } from '../components/EmptyState'
import { ErrorMessage } from '../components/ErrorMessage'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { useAuth } from '../hooks/useAuth'
import type { Event } from '../types/event'
import { createRequestGuard } from '../utils/requestGuard'
import { severityVariant } from '../utils/status'

const loadGuard = createRequestGuard()

export function EventsPage() {
  const { user, loading: authLoading, canManageEvents } = useAuth()
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [localError, setLocalError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Event | null>(null)
  const [tab, setTab] = useState<'open' | 'resolved'>('open')

  const emptyForm = useMemo(
    () => ({
      event_type: '',
      severity: 'info',
      device_id: 0,
      message: '',
    }),
    [],
  )
  const [form, setForm] = useState(emptyForm)

  const load = useCallback(async () => {
    if (!user) return
    const requestId = loadGuard.next()
    setLoading(true)
    setError('')
    try {
      const response = await listEvents({
        page: 1,
        limit: 50,
        sort_by: 'timestamp',
        sort_order: 'desc',
      })
      if (!loadGuard.isCurrent(requestId)) return
      setEvents(response.data)
      setError('')
    } catch (err) {
      if (!loadGuard.isCurrent(requestId)) return
      setError(err instanceof Error ? err.message : 'Failed to load events')
    } finally {
      if (loadGuard.isCurrent(requestId)) setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (authLoading || !user) return
    void load()
  }, [authLoading, user, load])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!user || !canManageEvents) return
    setSubmitting(true)
    setLocalError('')
    try {
      await createEvent({
        event_type: form.event_type,
        severity: form.severity,
        device_id: Number(form.device_id),
        message: form.message,
      })
      setForm(emptyForm)
      setShowForm(false)
      setTab('open')
      await load()
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to create event')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleUpdate(e: FormEvent) {
    e.preventDefault()
    if (!editing || !user || !canManageEvents) return
    setSubmitting(true)
    setLocalError('')
    try {
      await updateEvent(editing.id, {
        event_type: editing.event_type,
        severity: editing.severity,
        device_id: editing.device_id,
        message: editing.message,
      })
      setEditing(null)
      await load()
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to update event')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleResolve(event: Event) {
    if (!user || !canManageEvents) return
    if (event.resolved_at) return
    setSubmitting(true)
    setLocalError('')
    try {
      await resolveEvent(event.id)
      await load()
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to resolve event')
    } finally {
      setSubmitting(false)
    }
  }

  const openEvents = useMemo(() => events.filter((e) => !e.resolved_at), [events])
  const resolvedEvents = useMemo(() => events.filter((e) => e.resolved_at), [events])
  const visibleEvents = tab === 'resolved' ? resolvedEvents : openEvents

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Events</h1>
          <p className="page-header__subtitle">Device event log</p>
        </div>
        <div className="page-header__actions">
          {canManageEvents ? (
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setShowForm((v) => !v)}
            >
              {showForm ? 'Cancel' : 'Add event'}
            </button>
          ) : null}
          <button type="button" className="btn btn--ghost" onClick={load} disabled={loading}>
            Retry
          </button>
        </div>
      </header>

      <ErrorMessage message={localError || error} />

      {showForm && canManageEvents ? (
        <Card title="Add event" className="form-card">
          <form className="form form--grid" onSubmit={handleCreate}>
            <label className="form__field">
              <span>Event type</span>
              <input
                required
                value={form.event_type}
                onChange={(e) => setForm({ ...form, event_type: e.target.value })}
              />
            </label>
            <label className="form__field">
              <span>Severity</span>
              <select
                value={form.severity}
                onChange={(e) => setForm({ ...form, severity: e.target.value })}
              >
                <option value="low">low</option>
                <option value="info">info</option>
                <option value="medium">medium</option>
                <option value="warning">warning</option>
                <option value="high">high</option>
                <option value="critical">critical</option>
              </select>
            </label>
            <label className="form__field">
              <span>Device ID</span>
              <input
                required
                type="number"
                min={1}
                value={form.device_id || ''}
                onChange={(e) => setForm({ ...form, device_id: Number(e.target.value) })}
              />
            </label>
            <label className="form__field form__field--span2">
              <span>Message</span>
              <textarea
                required
                rows={3}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
              />
            </label>
            <div className="form__actions">
              <button type="submit" className="btn btn--primary" disabled={submitting}>
                {submitting ? 'Saving…' : 'Save event'}
              </button>
            </div>
          </form>
        </Card>
      ) : null}

      {editing && canManageEvents ? (
        <Card title={`Edit event #${editing.id}`} className="form-card">
          <form className="form form--grid" onSubmit={handleUpdate}>
            <label className="form__field">
              <span>Event type</span>
              <input
                required
                value={editing.event_type}
                onChange={(e) => setEditing({ ...editing, event_type: e.target.value })}
              />
            </label>
            <label className="form__field">
              <span>Severity</span>
              <select
                value={editing.severity}
                onChange={(e) => setEditing({ ...editing, severity: e.target.value })}
              >
                <option value="low">low</option>
                <option value="info">info</option>
                <option value="medium">medium</option>
                <option value="warning">warning</option>
                <option value="high">high</option>
                <option value="critical">critical</option>
              </select>
            </label>
            <label className="form__field">
              <span>Device ID</span>
              <input
                required
                type="number"
                min={1}
                value={editing.device_id}
                onChange={(e) => setEditing({ ...editing, device_id: Number(e.target.value) })}
              />
            </label>
            <label className="form__field form__field--span2">
              <span>Message</span>
              <textarea
                required
                rows={3}
                value={editing.message}
                onChange={(e) => setEditing({ ...editing, message: e.target.value })}
              />
            </label>
            <div className="form__actions">
              <button type="submit" className="btn btn--primary" disabled={submitting}>
                Save changes
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => setEditing(null)}>
                Cancel
              </button>
            </div>
          </form>
        </Card>
      ) : null}

      <Card
        title={
          tab === 'resolved'
            ? `Resolved events (${resolvedEvents.length})`
            : `Open events (${openEvents.length})`
        }
      >
        <div className="table-actions" style={{ marginBottom: '0.75rem' }}>
          <button
            type="button"
            className={`btn btn--ghost btn--small${tab === 'open' ? ' sidebar__link--active' : ''}`}
            onClick={() => setTab('open')}
            disabled={loading}
          >
            Open
          </button>
          <button
            type="button"
            className={`btn btn--ghost btn--small${tab === 'resolved' ? ' sidebar__link--active' : ''}`}
            onClick={() => setTab('resolved')}
            disabled={loading}
          >
            Resolved
          </button>
        </div>
        {loading ? (
          <LoadingSpinner label="Loading events…" />
        ) : visibleEvents.length === 0 ? (
          <EmptyState
            title={tab === 'resolved' ? 'No resolved events' : 'No open events'}
            description={
              tab === 'resolved'
                ? 'Resolved events will appear here after you mark them resolved.'
                : 'Events appear when devices report activity.'
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Type</th>
                  <th>Severity</th>
                  <th>Device</th>
                  <th>Message</th>
                  {canManageEvents ? <th>Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {visibleEvents.map((event) => (
                  <tr key={event.id}>
                    <td>{new Date(event.timestamp).toLocaleString()}</td>
                    <td>{event.event_type}</td>
                    <td>
                      <Badge label={event.severity} variant={severityVariant(event.severity)} />
                    </td>
                    <td>{event.device_id}</td>
                    <td>{event.message}</td>
                  {canManageEvents ? (
                    <td className="table-actions">
                      <button
                        type="button"
                        className="btn btn--ghost btn--small"
                        onClick={() => setEditing({ ...event })}
                      >
                        Edit
                      </button>
                        <button
                          type="button"
                          className="btn btn--ghost btn--small"
                          onClick={() => handleResolve(event)}
                          disabled={submitting || Boolean(event.resolved_at)}
                          title={
                            event.resolved_at
                              ? `Resolved at ${new Date(event.resolved_at).toLocaleString()}`
                              : 'Mark this event as resolved'
                          }
                        >
                          {event.resolved_at ? 'Resolved' : 'Resolve'}
                        </button>
                    </td>
                  ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

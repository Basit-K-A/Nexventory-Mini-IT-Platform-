import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '../components/Badge'
import { Card } from '../components/Card'
import { ErrorMessage } from '../components/ErrorMessage'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { StatCard } from '../components/StatCard'
import { listDevices } from '../api/devices'
import { getTicketsForDashboard } from '../services/tickets'
import { useAuth } from '../hooks/useAuth'
import type { Device } from '../types/device'
import type { Ticket } from '../types/ticket'
import { createRequestGuard } from '../utils/requestGuard'
import { isOnlineStatus } from '../utils/status'
import { priorityVariant, statusVariant, TERMINAL_STATUSES } from '../utils/ticketStatus'

const loadGuard = createRequestGuard()

export function DashboardPage() {
  const { user, loading: authLoading, permissions } = useAuth()
  const isAdmin = permissions.canDeleteTickets
  const canViewDevices = permissions.canViewDevices
  const [devices, setDevices] = useState<Device[]>([])
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (authLoading || !user) return

    const requestId = loadGuard.next()
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')

      const [ticketsResult, devicesResult] = await Promise.allSettled([
        getTicketsForDashboard({ sort_by: 'updated_at', sort_order: 'desc' }),
        canViewDevices
          ? listDevices({ page: 1, limit: 100, sort_by: 'created_at', sort_order: 'desc' })
          : Promise.resolve(null),
      ])

      if (cancelled || !loadGuard.isCurrent(requestId)) return

      const errors: string[] = []

      if (ticketsResult.status === 'fulfilled') {
        setTickets(ticketsResult.value)
      } else {
        const reason = ticketsResult.reason
        errors.push(
          reason instanceof Error ? reason.message : 'Failed to load tickets',
        )
        setTickets([])
      }

      if (devicesResult.status === 'fulfilled' && devicesResult.value) {
        setDevices(devicesResult.value.data)
      } else if (canViewDevices) {
        if (devicesResult.status === 'rejected') {
          const reason = devicesResult.reason
          errors.push(
            reason instanceof Error ? reason.message : 'Failed to load devices',
          )
        }
        setDevices([])
      } else {
        setDevices([])
      }

      setError(errors.join(' · '))
      setLoading(false)
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [authLoading, user, canViewDevices])

  const online = devices.filter((d) => isOnlineStatus(d.status)).length
  const offline = devices.length - online

  const metrics = useMemo(() => {
    const open = tickets.filter((t) => !TERMINAL_STATUSES.has(t.status))
    const closed = tickets.filter((t) => TERMINAL_STATUSES.has(t.status))
    const unassigned = open.filter((t) => !t.assigned_to)
    const highPriority = open.filter(
      (t) => t.priority === 'High' || t.priority === 'Critical',
    )
    const workload: Record<number, number> = {}
    for (const t of open) {
      if (t.assigned_to) {
        workload[t.assigned_to] = (workload[t.assigned_to] ?? 0) + 1
      }
    }
    const workloadRows = Object.entries(workload)
      .map(([id, count]) => ({ id: Number(id), count }))
      .sort((a, b) => b.count - a.count)
    return { open, closed, unassigned, highPriority, workloadRows }
  }, [tickets])

  const recentTickets = tickets.slice(0, 8)

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p className="page-header__subtitle">Service desk and infrastructure overview</p>
        </div>
      </header>

      <ErrorMessage message={error} />

      {loading ? (
        <LoadingSpinner label="Loading dashboard…" />
      ) : (
        <>
          <div className="stat-grid">
            <StatCard label="Open tickets" value={metrics.open.length} accent="warning" />
            <StatCard label="Closed / resolved" value={metrics.closed.length} accent="success" />
            <StatCard label="Unassigned" value={metrics.unassigned.length} />
            <StatCard label="High priority open" value={metrics.highPriority.length} accent="warning" />
            {canViewDevices && (
              <>
                <StatCard label="Total devices" value={devices.length} />
                <StatCard label="Online" value={online} accent="success" />
                <StatCard
                  label="Offline / other"
                  value={offline}
                  accent={offline > 0 ? 'warning' : 'default'}
                />
              </>
            )}
          </div>

          <div className="dashboard-grid">
            <Card title="Recently updated tickets">
              {recentTickets.length === 0 ? (
                <p className="muted">No tickets yet.</p>
              ) : (
                <ul className="event-feed">
                  {recentTickets.map((ticket) => (
                    <li key={ticket.id} className="event-feed__item">
                      <div className="event-feed__meta">
                        <Badge label={ticket.priority} variant={priorityVariant(ticket.priority)} />
                        <Badge label={ticket.status} variant={statusVariant(ticket.status)} />
                        <span className="event-feed__type">{ticket.ticket_number}</span>
                        <time dateTime={ticket.updated_at}>
                          {new Date(ticket.updated_at).toLocaleString()}
                        </time>
                      </div>
                      <p className="event-feed__message">{ticket.title}</p>
                    </li>
                  ))}
                </ul>
              )}
              <Link to="/tickets" className="link-inline">
                View all tickets →
              </Link>
            </Card>

            {isAdmin && metrics.workloadRows.length > 0 && (
              <Card title="Technician workload (open tickets)">
                <ul className="device-snapshot">
                  {metrics.workloadRows.map((row) => (
                    <li key={row.id}>
                      <span className="device-snapshot__host">User #{row.id}</span>
                      <span className="device-snapshot__ip">{row.count} open</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {canViewDevices && (
              <Card title="Device snapshot">
                {devices.length === 0 ? (
                  <p className="muted">No devices registered.</p>
                ) : (
                  <ul className="device-snapshot">
                    {devices.slice(0, 6).map((device) => (
                      <li key={device.id}>
                        <span className="device-snapshot__host">{device.hostname}</span>
                        <span className="device-snapshot__ip">{device.ip_address}</span>
                        <Badge
                          label={device.status}
                          variant={isOnlineStatus(device.status) ? 'success' : 'danger'}
                        />
                      </li>
                    ))}
                  </ul>
                )}
                <Link to="/devices" className="link-inline">
                  Manage devices →
                </Link>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  )
}

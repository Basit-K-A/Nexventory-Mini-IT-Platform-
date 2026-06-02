import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { createDevice, deleteDevice, updateDevice } from '../api/devices'
import { Badge } from '../components/Badge'
import { Card } from '../components/Card'
import { EmptyState } from '../components/EmptyState'
import { ErrorMessage } from '../components/ErrorMessage'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { Pagination } from '../components/Pagination'
import { useAuth } from '../hooks/useAuth'
import { useDevicesStore } from '../store/devicesStore'
import type { Device, DeviceCreate, DeviceUpdate } from '../types/device'
import { deviceStatusVariant } from '../utils/status'

const emptyForm: Omit<DeviceCreate, 'owner_id'> = {
  hostname: '',
  ip_address: '',
  operating_system: '',
  status: 'active',
  department: '',
}

export function DevicesPage() {
  const { user, loading: authLoading, canCreateDevices, canUpdateDevices, canDeleteDevices } =
    useAuth()
  const {
    devices,
    pagination,
    query,
    loading,
    error,
    setQuery,
    fetchDevices,
    resetError,
  } = useDevicesStore()

  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Device | null>(null)
  const [localError, setLocalError] = useState('')

  const queryKey = useMemo(() => JSON.stringify(query), [query])

  useEffect(() => {
    if (authLoading || !user) return
    void fetchDevices()
  }, [authLoading, user, fetchDevices, queryKey])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!user || !canCreateDevices) return
    setSubmitting(true)
    setLocalError('')
    resetError()
    try {
      await createDevice({
        ...form,
        department: form.department || null,
        owner_id: user.id,
      })
      setForm(emptyForm)
      setShowForm(false)
      setQuery({ page: 1 })
      await fetchDevices()
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to create device')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleUpdate(e: FormEvent) {
    e.preventDefault()
    if (!editing || !user || !canUpdateDevices) return
    setSubmitting(true)
    setLocalError('')
    try {
      const payload: DeviceUpdate = {
        hostname: editing.hostname,
        ip_address: editing.ip_address,
        operating_system: editing.operating_system,
        status: editing.status,
        department: editing.department ?? null,
        owner_id: editing.owner_id,
      }
      await updateDevice(editing.id, payload)
      setEditing(null)
      setQuery({ page: 1 })
      await fetchDevices()
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to update device')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(device: Device) {
    if (!canDeleteDevices) return
    if (!window.confirm(`Delete device "${device.hostname}"?`)) return
    setLocalError('')
    try {
      await deleteDevice(device.id)
      setQuery({ page: 1 })
      await fetchDevices()
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to delete device')
    }
  }

  function applyFilters(e: FormEvent) {
    e.preventDefault()
    const data = new FormData(e.currentTarget as HTMLFormElement)
    setQuery({
      page: 1,
      status: (data.get('status') as string) || undefined,
      hostname: (data.get('hostname') as string) || undefined,
      sort_by: (data.get('sort_by') as string) || 'created_at',
      sort_order: (data.get('sort_order') as 'asc' | 'desc') || 'desc',
    })
  }

  const displayError = localError || error

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Devices</h1>
          <p className="page-header__subtitle">Managed infrastructure inventory</p>
        </div>
        {canCreateDevices ? (
          <button type="button" className="btn btn--primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Cancel' : 'Add device'}
          </button>
        ) : null}
      </header>

      <ErrorMessage message={displayError || ''} />

      <Card title="Filters" className="form-card">
        <form className="form form--grid" onSubmit={applyFilters}>
          <label className="form__field">
            <span>Status</span>
            <select name="status" defaultValue={query.status ?? ''}>
              <option value="">All</option>
              <option value="active">active</option>
              <option value="online">online</option>
              <option value="offline">offline</option>
              <option value="maintenance">maintenance</option>
              <option value="inactive">inactive</option>
            </select>
          </label>
          <label className="form__field">
            <span>Hostname contains</span>
            <input name="hostname" defaultValue={query.hostname ?? ''} />
          </label>
          <label className="form__field">
            <span>Sort by</span>
            <select name="sort_by" defaultValue={query.sort_by ?? 'created_at'}>
              <option value="created_at">created_at</option>
              <option value="hostname">hostname</option>
              <option value="status">status</option>
            </select>
          </label>
          <label className="form__field">
            <span>Order</span>
            <select name="sort_order" defaultValue={query.sort_order ?? 'desc'}>
              <option value="desc">Newest first</option>
              <option value="asc">Oldest first</option>
            </select>
          </label>
          <div className="form__actions">
            <button type="submit" className="btn btn--primary">
              Apply
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => fetchDevices()}
              disabled={loading}
            >
              Retry
            </button>
          </div>
        </form>
      </Card>

      {showForm && canCreateDevices ? (
        <Card title="Add device" className="form-card">
          <form className="form form--grid" onSubmit={handleCreate}>
            <label className="form__field">
              <span>Hostname</span>
              <input
                required
                value={form.hostname}
                onChange={(e) => setForm({ ...form, hostname: e.target.value })}
                placeholder="e.g. SRV-DB-01 or desktop_1234"
                title="1–255 chars. Letters/numbers, dots, hyphens, underscores. No spaces. Avoid leading/trailing hyphen."
              />
              <small className="form__help">
                1–255 chars. Letters/numbers, dots (<code>.</code>), hyphens (<code>-</code>), underscores (
                <code>_</code>). No spaces.
              </small>
            </label>
            <label className="form__field">
              <span>IP address</span>
              <input
                required
                value={form.ip_address}
                onChange={(e) => setForm({ ...form, ip_address: e.target.value })}
                placeholder="e.g. 10.0.1.15 or 2001:db8::1"
                title="IPv4 or IPv6 address (no hostname). Examples: 10.0.1.15, 2001:db8::1"
              />
              <small className="form__help">IPv4 or IPv6. Example: <code>10.0.1.15</code> or <code>2001:db8::1</code>.</small>
            </label>
            <label className="form__field">
              <span>Operating system</span>
              <input
                required
                value={form.operating_system}
                onChange={(e) => setForm({ ...form, operating_system: e.target.value })}
                placeholder="e.g. Windows 11, Ubuntu 22.04"
                title="Free text (max 100 characters). Example: Windows 11, Ubuntu 22.04"
              />
              <small className="form__help">Free text (max 100 chars). Example: <code>Windows 11</code>, <code>Ubuntu 22.04</code>.</small>
            </label>
            <label className="form__field">
              <span>Department</span>
              <input
                value={form.department ?? ''}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                placeholder="Optional (e.g. IT, Finance)"
                title="Optional. If provided, max 100 characters."
              />
              <small className="form__help">Optional (max 100 chars). Leave blank if unknown.</small>
            </label>
            <label className="form__field">
              <span>Status</span>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                title="Choose the operational status for this device."
              >
                <option value="active">active</option>
                <option value="online">online</option>
                <option value="offline">offline</option>
                <option value="maintenance">maintenance</option>
                <option value="inactive">inactive</option>
              </select>
              <small className="form__help">
                Use <code>online</code>/<code>offline</code> for reachability, <code>maintenance</code> for planned work.
              </small>
            </label>
            <div className="form__actions">
              <button type="submit" className="btn btn--primary" disabled={submitting}>
                {submitting ? 'Saving…' : 'Save device'}
              </button>
            </div>
          </form>
        </Card>
      ) : null}

      {editing && canUpdateDevices ? (
        <Card title={`Edit ${editing.hostname}`} className="form-card">
          <form className="form form--grid" onSubmit={handleUpdate}>
            <label className="form__field">
              <span>Hostname</span>
              <input
                required
                value={editing.hostname}
                onChange={(e) => setEditing({ ...editing, hostname: e.target.value })}
                title="1–255 chars. Letters/numbers, dots, hyphens, underscores. No spaces. Avoid leading/trailing hyphen."
              />
              <small className="form__help">
                Letters/numbers, dots (<code>.</code>), hyphens (<code>-</code>), underscores (<code>_</code>). No spaces.
              </small>
            </label>
            <label className="form__field">
              <span>IP address</span>
              <input
                required
                value={editing.ip_address}
                onChange={(e) => setEditing({ ...editing, ip_address: e.target.value })}
                title="IPv4 or IPv6 address (no hostname). Examples: 10.0.1.15, 2001:db8::1"
              />
              <small className="form__help">IPv4 or IPv6. Example: <code>10.0.1.15</code> or <code>2001:db8::1</code>.</small>
            </label>
            <label className="form__field">
              <span>OS</span>
              <input
                required
                value={editing.operating_system}
                onChange={(e) => setEditing({ ...editing, operating_system: e.target.value })}
                title="Free text (max 100 characters). Example: Windows 11, Ubuntu 22.04"
              />
              <small className="form__help">Free text (max 100 chars). Example: <code>Windows 11</code>, <code>Ubuntu 22.04</code>.</small>
            </label>
            <label className="form__field">
              <span>Status</span>
              <select
                value={editing.status}
                onChange={(e) => setEditing({ ...editing, status: e.target.value })}
                title="Choose the operational status for this device."
              >
                <option value="active">active</option>
                <option value="online">online</option>
                <option value="offline">offline</option>
                <option value="maintenance">maintenance</option>
                <option value="inactive">inactive</option>
              </select>
              <small className="form__help">
                Use <code>online</code>/<code>offline</code> for reachability, <code>maintenance</code> for planned work.
              </small>
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

      <Card title={pagination ? `Devices (${pagination.total_records})` : 'Devices'}>
        {loading ? (
          <LoadingSpinner label="Loading devices…" />
        ) : devices.length === 0 ? (
          <EmptyState
            title="No devices found"
            description="Adjust filters or add a device to get started."
            action={
              canCreateDevices ? (
                <button type="button" className="btn btn--primary" onClick={() => setShowForm(true)}>
                  Add device
                </button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Hostname</th>
                    <th>IP</th>
                    <th>OS</th>
                    <th>Status</th>
                    <th>Dept</th>
                    <th>Owner</th>
                    {canUpdateDevices || canDeleteDevices ? <th>Actions</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {devices.map((device) => (
                    <tr key={device.id}>
                      <td>{device.hostname}</td>
                      <td>
                        <code>{device.ip_address}</code>
                      </td>
                      <td>{device.operating_system}</td>
                      <td>
                        <Badge label={device.status} variant={deviceStatusVariant(device.status)} />
                      </td>
                      <td>{device.department ?? '—'}</td>
                      <td>{device.owner_id}</td>
                      {canUpdateDevices || canDeleteDevices ? (
                        <td className="table-actions">
                          {canUpdateDevices ? (
                            <button
                              type="button"
                              className="btn btn--ghost btn--small"
                              onClick={() => setEditing({ ...device })}
                            >
                              Edit
                            </button>
                          ) : null}
                          {canDeleteDevices ? (
                            <button
                              type="button"
                              className="btn btn--ghost btn--small"
                              onClick={() => handleDelete(device)}
                            >
                              Delete
                            </button>
                          ) : null}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pagination ? (
              <Pagination
                meta={pagination}
                disabled={loading}
                onPageChange={(page) => setQuery({ page })}
              />
            ) : null}
          </>
        )}
      </Card>
    </div>
  )
}

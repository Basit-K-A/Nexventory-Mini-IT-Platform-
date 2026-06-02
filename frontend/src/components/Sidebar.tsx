import { NavLink } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function Sidebar() {
  const { user, logout, permissions } = useAuth()

  // Build nav from permissions so each role sees only what it may access.
  const links = [
    permissions.canViewDashboard && { to: '/dashboard', label: 'Dashboard', end: false },
    permissions.canViewTickets && { to: '/tickets', label: 'Tickets', end: false },
    permissions.canViewDevices && { to: '/devices', label: 'Devices', end: false },
    permissions.canViewAudit && { to: '/audit', label: 'Audit logs', end: false },
    permissions.canViewUsers && { to: '/users', label: 'Users', end: false },
  ].filter(Boolean) as { to: string; label: string; end: boolean }[]

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <span className="sidebar__logo" aria-hidden="true">
          N
        </span>
        <div>
          <p className="sidebar__name">Nexventory</p>
          <p className="sidebar__tagline">Infrastructure Console</p>
        </div>
      </div>

      <nav className="sidebar__nav" aria-label="Main">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) =>
              `sidebar__link${isActive ? ' sidebar__link--active' : ''}`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar__footer">
        <p className="sidebar__user">
          {user?.username ?? '—'}
          {user?.role ? <span className="muted"> ({user.role})</span> : null}
        </p>
        <button type="button" className="btn btn--ghost btn--small" onClick={logout}>
          Sign out
        </button>
      </div>
    </aside>
  )
}

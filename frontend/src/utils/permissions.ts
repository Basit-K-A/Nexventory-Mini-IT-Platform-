/**
 * Frontend permission helpers derived from the user's role.
 *
 * IMPORTANT: this only controls what the UI renders. The backend is the source of
 * truth and enforces every rule independently — hiding a button is never security.
 */

export type Role = 'viewer' | 'technician' | 'analyst' | 'admin' | string

export interface Permissions {
  canViewTickets: boolean
  canCreateTickets: boolean
  canManageTickets: boolean
  canAssignTickets: boolean
  canDeleteTickets: boolean
  /** @deprecated Legacy events — use tickets */
  canViewEvents: boolean
  canManageEvents: boolean
  canViewDevices: boolean
  canCreateDevices: boolean
  canUpdateDevices: boolean
  canDeleteDevices: boolean
  canViewAudit: boolean
  canManageUsers: boolean
  canViewUsers: boolean
  canViewDashboard: boolean
}

export function getPermissions(role: Role | undefined | null): Permissions {
  const r = (role ?? '').toLowerCase()
  const isAdmin = r === 'admin'
  const isTechnician = r === 'technician'
  const isAnalyst = r === 'analyst'
  const isViewer = r === 'viewer'

  return {
    canViewTickets: true,
    canCreateTickets: true,
    canManageTickets: isAdmin || isTechnician || isAnalyst,
    canAssignTickets: isAdmin || isTechnician || isAnalyst,
    canDeleteTickets: isAdmin,
    // Legacy events API remains but UI uses tickets
    canViewEvents: true,
    canManageEvents: isAdmin || isAnalyst || isTechnician,
    canViewDevices: isAdmin || isAnalyst || isTechnician,
    canCreateDevices: isAdmin || isAnalyst,
    canUpdateDevices: isAdmin || isAnalyst || isTechnician,
    canDeleteDevices: isAdmin || isAnalyst,
    canViewAudit: isAdmin || isAnalyst,
    canManageUsers: isAdmin,
    canViewUsers: isAdmin || isAnalyst,
    canViewDashboard: isAdmin || isTechnician || isAnalyst,
    // Viewers use ticket-only home (no asset/audit access)
    ...(isViewer
      ? {
          canViewDevices: false,
          canViewDashboard: false,
          canViewAudit: false,
          canViewUsers: false,
        }
      : {}),
  }
}

/** Landing route for a role. */
export function homeRouteForRole(role: Role | undefined | null): string {
  const perms = getPermissions(role)
  if (perms.canViewDashboard) return '/dashboard'
  return '/tickets'
}

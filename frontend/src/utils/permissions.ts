/**
 * Frontend permission helpers derived from the user's role.
 *
 * IMPORTANT: this only controls what the UI renders. The backend is the source of
 * truth and enforces every rule independently — hiding a button is never security.
 */

export type Role = 'viewer' | 'technician' | 'analyst' | 'admin' | string

export interface Permissions {
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

  return {
    // Everyone authenticated can read events
    canViewEvents: true,
    // Events: admin + analyst + technician may create/update
    canManageEvents: isAdmin || isAnalyst || isTechnician,
    // Devices: admin + analyst + technician can view/update; create/delete are admin+analyst
    canViewDevices: isAdmin || isAnalyst || isTechnician,
    canCreateDevices: isAdmin || isAnalyst,
    canUpdateDevices: isAdmin || isAnalyst || isTechnician,
    canDeleteDevices: isAdmin || isAnalyst,
    // Audit trail: admin + analyst
    canViewAudit: isAdmin || isAnalyst,
    // User management: only admin can patch roles (analyst may list users, enforced backend-side)
    canManageUsers: isAdmin,
    // User listing: admin + analyst
    canViewUsers: isAdmin || isAnalyst,
    // Dashboard summary needs device visibility; analysts get a security view
    canViewDashboard: isAdmin || isTechnician || isAnalyst,
  }
}

/** Landing route for a role (viewers go straight to events). */
export function homeRouteForRole(role: Role | undefined | null): string {
  const perms = getPermissions(role)
  return perms.canViewDashboard ? '/dashboard' : '/events'
}

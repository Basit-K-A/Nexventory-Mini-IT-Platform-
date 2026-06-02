import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { fetchCurrentUser, logout as apiLogout } from '../api/auth'
import { clearTokens, getToken, setUnauthorizedHandler } from '../api/client'
import type { User } from '../types/user'
import { getPermissions, homeRouteForRole, type Permissions } from '../utils/permissions'
import { toAppPath } from '../utils/paths'

interface AuthContextValue {
  user: User | null
  loading: boolean
  isAuthenticated: boolean
  setUser: (user: User | null) => void
  logout: () => void
  refreshUser: () => Promise<void>
  permissions: Permissions
  homeRoute: string
  canAccessAudit: boolean
  canCreateDevices: boolean
  canUpdateDevices: boolean
  canDeleteDevices: boolean
  canManageEvents: boolean
  canViewUsers: boolean
  canManageUsers: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    const token = getToken()
    if (!token) {
      setUser(null)
      return
    }
    try {
      const me = await fetchCurrentUser()
      setUser(me)
    } catch {
      clearTokens()
      setUser(null)
    }
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null)
      const path = window.location.pathname
      const loginPath = toAppPath('/login')
      const registerPath = toAppPath('/register')
      if (!path.endsWith(loginPath) && !path.endsWith(registerPath)) {
        window.location.assign(loginPath)
      }
    })
    refreshUser().finally(() => setLoading(false))
  }, [refreshUser])

  const logout = useCallback(() => {
    apiLogout()
    setUser(null)
  }, [])

  const permissions = useMemo(() => getPermissions(user?.role), [user?.role])
  const homeRoute = useMemo(() => homeRouteForRole(user?.role), [user?.role])
  const canAccessAudit = permissions.canViewAudit
  const canCreateDevices = permissions.canCreateDevices
  const canUpdateDevices = permissions.canUpdateDevices
  const canDeleteDevices = permissions.canDeleteDevices
  const canManageEvents = permissions.canManageEvents
  const canViewUsers = permissions.canViewUsers
  const canManageUsers = permissions.canManageUsers

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      setUser,
      logout,
      refreshUser,
      permissions,
      homeRoute,
      canAccessAudit,
      canCreateDevices,
      canUpdateDevices,
      canDeleteDevices,
      canManageEvents,
      canViewUsers,
      canManageUsers,
    }),
    [
      user,
      loading,
      logout,
      refreshUser,
      permissions,
      homeRoute,
      canAccessAudit,
      canCreateDevices,
      canUpdateDevices,
      canDeleteDevices,
      canManageEvents,
      canViewUsers,
      canManageUsers,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

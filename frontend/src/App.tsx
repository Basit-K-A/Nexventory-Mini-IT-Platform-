import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { HomeRedirect } from './components/HomeRedirect'
import { ProtectedRoute } from './components/ProtectedRoute'
import { RequirePermission } from './components/RequirePermission'
import { AuthProvider } from './hooks/useAuth'
import { DashboardLayout } from './layouts/DashboardLayout'
import { AuditLogsPage } from './pages/AuditLogs'
import { DashboardPage } from './pages/Dashboard'
import { DevicesPage } from './pages/Devices'
import { EventsPage } from './pages/Events'
import { UsersPage } from './pages/Users'
import { LoginPage } from './pages/Login'
import { RegisterPage } from './pages/Register'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || undefined}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<DashboardLayout />}>
              {/* Send each role to the page it is allowed to see first */}
              <Route index element={<HomeRedirect />} />

              {/* Everyone authenticated can read events */}
              <Route path="events" element={<EventsPage />} />

              {/* Dashboard + devices: admin / technician (analyst gets dashboard) */}
              <Route element={<RequirePermission permission="canViewDashboard" />}>
                <Route path="dashboard" element={<DashboardPage />} />
              </Route>
              <Route element={<RequirePermission permission="canViewDevices" />}>
                <Route path="devices" element={<DevicesPage />} />
              </Route>

              {/* Audit logs: admin / analyst */}
              <Route element={<RequirePermission permission="canViewAudit" />}>
                <Route path="audit" element={<AuditLogsPage />} />
              </Route>

              {/* Users: admin / analyst can view; admin can edit roles */}
              <Route element={<RequirePermission permission="canViewUsers" />}>
                <Route path="users" element={<UsersPage />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

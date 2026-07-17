import { Outlet, Navigate, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { useAuthStore } from '@/store/auth'
import { useDualControlStore } from '@/store/dualControl'
import { SessionExpiredOverlay } from '@/components/auth/SessionExpiredOverlay'

const RESOURCE_MAP: Record<string, string> = {
  dashboard: 'dashboard',
  onboarding: 'setup',
  assets: 'assets',
  discovery: 'discovery jobs',
  scans: 'scans',
  vapt: 'campaigns',
  reports: 'reports',
  tracker: 'tracker',
  compliance: 'compliance',
  alerts: 'settings',
  audit: 'audit log',
}

export function AppShell() {
  const { orgToken, authExpired } = useAuthStore()
  const sessionExpired = useDualControlStore((s) => s.sessionExpired)
  const location = useLocation()
  const segment = location.pathname.split('/')[1]
  const resource = RESOURCE_MAP[segment] || 'this page'

  if (!orgToken && !authExpired) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto bg-background">
          <div className="container mx-auto p-6">
            {authExpired ? (
              <SessionExpiredOverlay resource={resource} />
            ) : (
              <>
                {sessionExpired && <SessionExpiredOverlay resource={resource} />}
                <Outlet />
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

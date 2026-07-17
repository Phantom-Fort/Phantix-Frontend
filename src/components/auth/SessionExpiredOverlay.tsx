import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import { useDualControlStore } from '@/store/dualControl'
import { Button } from '@/components/ui/button'
import { LogIn, ShieldAlert, UserCheck } from 'lucide-react'

interface SessionExpiredOverlayProps {
  resource: string
}

export function SessionExpiredOverlay({ resource }: SessionExpiredOverlayProps) {
  const navigate = useNavigate()
  const authExpired = useAuthStore((s) => s.authExpired)
  const { sessionExpired, clearSessionExpired } = useDualControlStore()

  const openDcModal = () => {
    useDualControlStore.getState().requireDcSession({
      retry: () => {
        clearSessionExpired()
        return Promise.resolve()
      },
      label: `re-authenticate ${resource}`,
    })
  }

  // Both expired → show org re-auth (DC can't work without org JWT)
  if (authExpired && sessionExpired) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <ShieldAlert className="h-10 w-10 text-amber-500 mb-3" />
        <h2 className="text-lg font-semibold text-foreground mb-1">Session Expired</h2>
        <p className="text-sm text-muted-foreground mb-5 max-w-sm">
          Your session has expired. Re-authenticate to continue.
        </p>
        <Button onClick={() => navigate('/login')}>
          <LogIn className="mr-1.5 h-4 w-4" /> Authenticate to view {resource}
        </Button>
      </div>
    )
  }

  if (authExpired) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <ShieldAlert className="h-10 w-10 text-amber-500 mb-3" />
        <h2 className="text-lg font-semibold text-foreground mb-1">Session Expired</h2>
        <p className="text-sm text-muted-foreground mb-5 max-w-sm">
          Your session has expired. Authenticate to view {resource}.
        </p>
        <Button onClick={() => navigate('/login')}>
          <LogIn className="mr-1.5 h-4 w-4" /> Authenticate to view {resource}
        </Button>
      </div>
    )
  }

  if (sessionExpired) {
    return (
      <div className="mb-6 flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50/50 dark:bg-amber-900/10 p-3 text-sm">
        <UserCheck className="h-5 w-5 shrink-0 text-amber-500" />
        <span className="flex-1 text-amber-800 dark:text-amber-200">
          Dual-control session expired. <strong>Page data is still readable</strong> — re-authenticate to perform actions on {resource}.
        </span>
        <Button size="sm" onClick={openDcModal}>
          <UserCheck className="mr-1 h-3.5 w-3.5" /> Re-authenticate
        </Button>
      </div>
    )
  }

  return null
}

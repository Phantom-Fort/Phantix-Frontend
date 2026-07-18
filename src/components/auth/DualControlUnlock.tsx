import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api, formatApiError, saveDcSession, setDualControlConfigured } from '@/lib/api'
import { toastError, toastSuccess } from '@/lib/toast'
import { useDualControlStore, type DcRoleRequired } from '@/store/dualControl'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { KeyRound, Loader2, ShieldAlert, UserCheck } from 'lucide-react'

function getDeviceId(): string {
  let id = localStorage.getItem('phantix_device_id')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('phantix_device_id', id)
  }
  return id
}

export function DualControlUnlock() {
  const { isOpen, pending, dismiss, clearPending, clearSessionExpired, sessionExpired } =
    useDualControlStore()
  const [role, setRole] = useState<DcRoleRequired>('any')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mfaToken, setMfaToken] = useState<string | null>(null)
  const [mfaCode, setMfaCode] = useState('')
  const [devOtp, setDevOtp] = useState('')

  const { data: dcStatus } = useQuery({
    queryKey: ['org-users', 'dual-control'],
    queryFn: async () => {
      const { data } = await api.get('/org-users/dual-control')
      if (data?.configured) setDualControlConfigured(true)
      return data as {
        configured?: boolean
        initiator?: { id: number; email?: string; full_name?: string; title?: string }
        authorizer?: { id: number; email?: string; full_name?: string; title?: string }
      }
    },
    enabled: isOpen,
  })

  // Reset + prefill when modal opens or required role changes
  useEffect(() => {
    if (!isOpen) return
    const required = pending?.role || 'any'
    setRole(required === 'any' ? 'authorizer' : required)
    setMfaToken(null)
    setMfaCode('')
    setDevOtp('')
    setPassword('')
  }, [isOpen, pending?.role])

  useEffect(() => {
    if (!isOpen || !dcStatus) return
    if (role === 'initiator' && dcStatus.initiator?.email) {
      setEmail(dcStatus.initiator.email)
    } else if (role === 'authorizer' && dcStatus.authorizer?.email) {
      setEmail(dcStatus.authorizer.email)
    } else if (role === 'any') {
      setEmail(dcStatus.authorizer?.email || dcStatus.initiator?.email || '')
    }
  }, [isOpen, role, dcStatus])

  const finishUnlock = async (data: any) => {
    if (!data.session_token) return
    saveDcSession(data.session_token)
    useAuthStore.getState().setDcSession(data.session_token, data.user)
    if (data.access_token) {
      useAuthStore.getState().setOrgAuth(data.access_token)
    }
    setDualControlConfigured(true)
    clearSessionExpired()
    try {
      if (pending?.retry) await pending.retry()
      toastSuccess('Dual-control unlocked')
    } catch (err: any) {
      toastError(formatApiError(err, 'Action failed after unlock — check you unlocked as the correct role'))
      return
    }
    clearPending()
    setEmail('')
    setPassword('')
    setMfaToken(null)
    setMfaCode('')
    setDevOtp('')
  }

  const loginMutation = useMutation({
    mutationFn: async () => {
      const deviceId = getDeviceId()
      const { data } = await api.post(
        '/org-users/auth/login',
        {
          email: email.trim(),
          password,
          purpose: 'dual_control',
          device_id: deviceId,
        },
        { headers: { 'X-Device-Id': deviceId }, _skipDc: true } as any,
      )
      return data
    },
    onSuccess: async (data) => {
      if (data.session_token) {
        await finishUnlock(data)
      } else if (data.mfa_required && data.mfa_token) {
        setMfaToken(data.mfa_token)
        setDevOtp(data.dev_otp || '')
      } else {
        toastError(data.message || data.detail || 'Authentication failed')
      }
    },
    onError: (err: any) => toastError(formatApiError(err, 'Login failed')),
  })

  const mfaMutation = useMutation({
    mutationFn: async () => {
      const deviceId = getDeviceId()
      const { data } = await api.post(
        '/org-users/auth/login/mfa',
        { mfa_token: mfaToken, code: mfaCode, device_id: deviceId },
        { headers: { 'X-Device-Id': deviceId }, _skipDc: true } as any,
      )
      return data
    },
    onSuccess: async (data) => {
      if (data.session_token) {
        await finishUnlock(data)
      } else {
        toastError(data.message || 'Verification failed')
      }
    },
    onError: (err: any) => toastError(formatApiError(err, 'Verification failed')),
  })

  if (!isOpen) return null

  const lockedRole = pending?.role && pending.role !== 'any'
  const initiator = dcStatus?.initiator
  const authorizer = dcStatus?.authorizer
  const roleHint =
    role === 'initiator'
      ? `Unlock as Initiator${initiator?.full_name ? ` (${initiator.full_name})` : ''}`
      : role === 'authorizer'
        ? `Unlock as Authorizer${authorizer?.full_name ? ` (${authorizer.full_name})` : ''}`
        : 'Unlock as Initiator or Authorizer'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-xl border space-y-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-amber-500" />
          <h2 className="text-lg font-semibold">Dual-Control Unlock</h2>
        </div>

        {sessionExpired && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Previous dual-control session expired (idle ~3 min). Unlock again.
          </p>
        )}

        {pending?.label && (
          <p className="text-sm text-muted-foreground">
            Action: <code className="text-xs bg-muted px-1 rounded">{pending.label}</code>
          </p>
        )}

        <div className="rounded-lg border p-3 space-y-2 text-sm">
          <div className="font-medium flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-brand-700" />
            {roleHint}
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div>
              <span className="font-medium text-foreground">Initiator</span>
              <br />
              {initiator?.email || '—'}
            </div>
            <div>
              <span className="font-medium text-foreground">Authorizer</span>
              <br />
              {authorizer?.email || '—'}
            </div>
          </div>
          {!lockedRole && (
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                variant={role === 'initiator' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setRole('initiator')}
              >
                Initiator
              </Button>
              <Button
                size="sm"
                variant={role === 'authorizer' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setRole('authorizer')}
              >
                Authorizer
              </Button>
            </div>
          )}
          {pending?.role === 'authorizer' && (
            <p className="text-[11px] text-amber-700 dark:text-amber-300">
              Approve / reject requires the <strong>Authorizer</strong> session only.
            </p>
          )}
          {pending?.role === 'initiator' && (
            <p className="text-[11px] text-amber-700 dark:text-amber-300">
              Propose / submit requires the <strong>Initiator</strong> session.
            </p>
          )}
        </div>

        {!mfaToken ? (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@company.com"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Directory password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Temp password from user create"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={dismiss} className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={() => loginMutation.mutate()}
                disabled={!email || !password || loginMutation.isPending}
                className="flex-1"
              >
                {loginMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Sending…
                  </>
                ) : (
                  <>
                    <KeyRound className="h-4 w-4 mr-1" /> Unlock
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">OTP sent to the org-user email.</p>
            {devOtp && (
              <p className="text-xs font-mono text-muted-foreground">
                Dev OTP: <span className="text-brand-700 font-bold">{devOtp}</span>
              </p>
            )}
            <div>
              <label className="text-sm font-medium mb-1 block">Verification code</label>
              <Input
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                maxLength={6}
                placeholder="000000"
                className="font-mono tracking-widest"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setMfaToken(null)
                  setDevOtp('')
                }}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={() => mfaMutation.mutate()}
                disabled={mfaCode.length < 4 || mfaMutation.isPending}
                className="flex-1"
              >
                {mfaMutation.isPending ? 'Verifying…' : 'Verify & run'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

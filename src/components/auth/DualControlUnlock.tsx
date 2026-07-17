import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api, saveDcSession } from '@/lib/api'
import { useDualControlStore } from '@/store/dualControl'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ShieldAlert } from 'lucide-react'

export function DualControlUnlock() {
  const { isOpen, pending, dismiss, clearPending, clearSessionExpired } = useDualControlStore()
  const [email, setEmail] = useState('')
  const [mfaToken, setMfaToken] = useState<string | null>(null)
  const [mfaCode, setMfaCode] = useState('')
  const [error, setError] = useState('')

  const dcLoginMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/org-users/auth/login', { email, purpose: 'dual_control' })
      return data
    },
    onSuccess: (data) => {
      if (data.session_token) {
        saveDcSession(data.session_token)
        useAuthStore.getState().setDcSession(data.session_token, data.user)
        clearSessionExpired()
        pending?.retry()
        clearPending()
        setEmail('')
      } else if (data.mfa_required && data.mfa_token) {
        setMfaToken(data.mfa_token)
      } else {
        setError(data.detail || 'Authentication failed')
      }
    },
    onError: (err: any) => {
      setError(err?.response?.data?.detail || 'Login failed')
    },
  })

  const mfaMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/org-users/auth/login/mfa', { mfa_token: mfaToken, code: mfaCode })
      return data
    },
    onSuccess: (data) => {
      if (data.session_token) {
        saveDcSession(data.session_token)
        useAuthStore.getState().setDcSession(data.session_token, data.user)
        clearSessionExpired()
        pending?.retry()
        clearPending()
        setEmail('')
        setMfaToken(null)
        setMfaCode('')
      }
    },
    onError: (err: any) => {
      setError(err?.response?.data?.detail || 'Verification failed')
    },
  })

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-xl border space-y-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-amber-500" />
          <h2 className="text-lg font-semibold">Dual-Control Required</h2>
        </div>

        {pending?.label && (
          <p className="text-sm text-muted-foreground">
            This action (<code className="text-xs bg-muted px-1 rounded">{pending.label}</code>) requires an authorized dual-control session.
          </p>
        )}

        {!mfaToken ? (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Org User Email (domain must match org)</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="operator@company.com" />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button variant="outline" onClick={dismiss} className="flex-1">Cancel</Button>
              <Button onClick={() => dcLoginMutation.mutate()} disabled={!email || dcLoginMutation.isPending} className="flex-1">
                {dcLoginMutation.isPending ? 'Sending code...' : 'Send OTP & Unlock'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">MFA code sent to your email.</p>
            <div>
              <label className="text-sm font-medium mb-1 block">Verification Code</label>
              <Input value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} maxLength={6} placeholder="000000" />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setMfaToken(null); setError('') }} className="flex-1">Back</Button>
              <Button onClick={() => mfaMutation.mutate()} disabled={mfaCode.length < 4 || mfaMutation.isPending} className="flex-1">
                {mfaMutation.isPending ? 'Verifying...' : 'Verify'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

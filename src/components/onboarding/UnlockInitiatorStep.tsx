import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api, saveDcSession } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CheckCircle2, ArrowRight, Loader2 } from 'lucide-react'

interface UnlockInitiatorStepProps {
  onComplete: () => void
}

export function UnlockInitiatorStep({ onComplete }: UnlockInitiatorStepProps) {
  const [email, setEmail] = useState('')
  const [mfaToken, setMfaToken] = useState<string | null>(null)
  const [mfaCode, setMfaCode] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const { setDcSession } = useAuthStore()

  const loginMutation = useMutation({
    mutationFn: async () => {
      // Include device_id for stable device tracking (per spec)
      let deviceId = localStorage.getItem('phantix_device_id')
      if (!deviceId) {
        deviceId = crypto.randomUUID()
        localStorage.setItem('phantix_device_id', deviceId)
      }
      const { data } = await api.post('/org-users/auth/login', {
        email: email || undefined,
        purpose: 'dual_control',
        device_id: deviceId,
      })
      return data
    },
    onSuccess: (data) => {
      if (data.session_token) {
        saveDcSession(data.session_token)
        setDcSession(data.session_token, data.user)
        setDone(true)
        setTimeout(onComplete, 800)
      } else if (data.mfa_required && data.mfa_token) {
        setMfaToken(data.mfa_token)
        setError('')
      } else {
        setError(data.detail || 'Authentication failed')
      }
    },
    onError: (err: any) => {
      setError(err?.response?.data?.detail || 'Failed to start unlock')
    },
  })

  const mfaMutation = useMutation({
    mutationFn: async () => {
      let deviceId = localStorage.getItem('phantix_device_id') || crypto.randomUUID()
      const { data } = await api.post('/org-users/auth/login/mfa', {
        mfa_token: mfaToken,
        code: mfaCode,
        device_id: deviceId,
      })
      return data
    },
    onSuccess: (data) => {
      if (data.session_token) {
        saveDcSession(data.session_token)
        setDcSession(data.session_token, data.user)
        setDone(true)
        setTimeout(onComplete, 800)
      }
    },
    onError: (err: any) => {
      setError(err?.response?.data?.detail || 'Verification failed')
    },
  })

  if (done) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-green-600">
          <CheckCircle2 className="h-5 w-5" />
          <p className="font-medium">Unlocked as Initiator. Dual-control session active.</p>
        </div>
        <Button onClick={onComplete} variant="outline">
          Continue to next <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Unlock as Initiator (OTP)</h3>
      <p className="text-sm text-muted-foreground">
        Enter the initiator's email to receive an OTP. This creates a short-lived dual-control session needed for writes (DB, assets, scans).
      </p>

      {!mfaToken ? (
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium mb-1 block">Initiator Email</label>
            <Input
              type="email"
              placeholder="initiator@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={() => loginMutation.mutate()} disabled={loginMutation.isPending || !email}>
            {loginMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending OTP...</> : 'Send OTP'}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Code sent. Enter the 6-digit code.</p>
          <div>
            <label className="text-sm font-medium mb-1 block">Verification Code</label>
            <Input
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value)}
              maxLength={6}
              placeholder="000000"
              className="font-mono text-lg tracking-widest max-w-[220px]"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setMfaToken(null); setMfaCode(''); setError('') }}>
              Back
            </Button>
            <Button onClick={() => mfaMutation.mutate()} disabled={mfaCode.length < 4 || mfaMutation.isPending}>
              {mfaMutation.isPending ? 'Verifying...' : 'Verify & Unlock'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

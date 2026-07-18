import { useState, useEffect } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api, formatApiError, saveDcSession, setDualControlConfigured } from '@/lib/api'
import { toastError } from '@/lib/toast'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CheckCircle2, ArrowRight, Loader2 } from 'lucide-react'

interface UnlockInitiatorStepProps {
  onComplete: () => void
}

function getDeviceId(): string {
  let deviceId = localStorage.getItem('phantix_device_id')
  if (!deviceId) {
    deviceId = crypto.randomUUID()
    localStorage.setItem('phantix_device_id', deviceId)
  }
  return deviceId
}

export function UnlockInitiatorStep({ onComplete }: UnlockInitiatorStepProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('TempPass123!')
  const [mfaToken, setMfaToken] = useState<string | null>(null)
  const [mfaCode, setMfaCode] = useState('')
  const [done, setDone] = useState(false)
  const [devOtp, setDevOtp] = useState('')

  const { setDcSession, setOrgAuth } = useAuthStore()

  const { data: dcStatus } = useQuery({
    queryKey: ['org-users', 'dual-control'],
    queryFn: async () => {
      const { data } = await api.get('/org-users/dual-control')
      if (data?.configured) setDualControlConfigured(true)
      return data as {
        configured?: boolean
        initiator?: { id: number; email?: string; full_name?: string }
      }
    },
  })

  useEffect(() => {
    const fromDc = dcStatus?.initiator?.email
    const fromWizard = sessionStorage.getItem('phantix_wizard_initiator_email')
    if (!email && (fromDc || fromWizard)) {
      setEmail(fromDc || fromWizard || '')
    }
  }, [dcStatus, email])

  const persistSession = (data: any) => {
    if (data.session_token) {
      saveDcSession(data.session_token)
      setDcSession(data.session_token, data.user)
    }
    // Prefer org-user JWT for named audit when returned
    if (data.access_token) {
      setOrgAuth(data.access_token)
    }
    setDualControlConfigured(true)
    setDone(true)
    setTimeout(onComplete, 600)
  }

  const loginMutation = useMutation({
    mutationFn: async () => {
      const deviceId = getDeviceId()
      // Backend requires email + password; MFA OTP follows when mfa_enabled
      const { data } = await api.post(
        '/org-users/auth/login',
        {
          email: email.trim(),
          password: password,
          purpose: 'dual_control',
          device_id: deviceId,
        },
        {
          headers: { 'X-Device-Id': deviceId },
          _skipDc: true,
        } as any,
      )
      return data
    },
    onSuccess: (data) => {
      if (data.session_token) {
        persistSession(data)
      } else if (data.mfa_required && data.mfa_token) {
        setMfaToken(data.mfa_token)
        setDevOtp(data.dev_otp || '')
      } else {
        toastError(data.message || data.detail || 'Authentication failed')
      }
    },
    onError: (err: any) => {
      toastError(formatApiError(err, 'Failed to start unlock'))
    },
  })

  const mfaMutation = useMutation({
    mutationFn: async () => {
      const deviceId = getDeviceId()
      const { data } = await api.post(
        '/org-users/auth/login/mfa',
        {
          mfa_token: mfaToken,
          code: mfaCode,
          device_id: deviceId,
        },
        {
          headers: { 'X-Device-Id': deviceId },
          _skipDc: true,
        } as any,
      )
      return data
    },
    onSuccess: (data) => {
      if (data.session_token) {
        persistSession(data)
      } else if (data.device_verification_required && data.device_token) {
        toastError('New device verification required — complete device step or try again from this browser.')
      } else {
        toastError(data.message || 'Verification failed')
      }
    },
    onError: (err: any) => {
      toastError(formatApiError(err, 'Verification failed'))
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
        Enter the initiator email. OTP creates a short-lived dual-control session required for writes (DB, assets, scans).
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
          <div>
            <label className="text-sm font-medium mb-1 block">Directory Password</label>
            <Input
              type="password"
              placeholder="Temp password from create step"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Same temp password used when creating the initiator (then email OTP).
            </p>
          </div>
          <Button onClick={() => loginMutation.mutate()} disabled={loginMutation.isPending || !email.trim() || !password}>
            {loginMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending OTP...
              </>
            ) : (
              'Send OTP'
            )}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Code sent. Enter the 6-digit code.</p>
          {devOtp && (
            <p className="text-xs text-muted-foreground font-mono">
              Dev OTP: <span className="text-brand-700 font-bold">{devOtp}</span>
            </p>
          )}
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
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setMfaToken(null)
                setMfaCode('')
                setDevOtp('')
              }}
            >
              Back
            </Button>
            <Button
              onClick={() => mfaMutation.mutate()}
              disabled={mfaCode.length < 4 || mfaMutation.isPending}
            >
              {mfaMutation.isPending ? 'Verifying...' : 'Verify & Unlock'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

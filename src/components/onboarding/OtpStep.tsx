import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toastApiError } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CheckCircle2, ArrowRight } from 'lucide-react'

interface OtpStepProps {
  onComplete: () => void
  verified: boolean
}

export function OtpStep({ onComplete, verified }: OtpStepProps) {
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)

  const sendMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/organizations/me/setup/otp/send', { channel: 'email' })
      return data as { dev_otp?: string }
    },
    onSuccess: (data) => {
      setSent(true)
      if (data.dev_otp) setCode(data.dev_otp)
    },
  })

  const verifyMutation = useMutation({
    mutationFn: async () => {
      await api.post('/organizations/me/setup/otp/verify', { channel: 'email', code })
    },
    onSuccess: onComplete,
    onError: (err: any) => toastApiError(err, 'Invalid or expired code. Try sending again.'),
  })

  if (verified) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-green-600">
          <CheckCircle2 className="h-5 w-5" />
          <p className="font-medium">Email verified</p>
        </div>
        <Button onClick={onComplete} variant="outline">
          Continue <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Verify Your Email</h3>
      <p className="text-sm text-muted-foreground">We'll send a one-time passcode to your registered email.</p>

      {!sent ? (
        <Button onClick={() => sendMutation.mutate()} disabled={sendMutation.isPending}>
          {sendMutation.isPending ? 'Sending...' : 'Send Verification Code'}
        </Button>
      ) : (
        <div className="space-y-3">
          {sendMutation.data?.dev_otp && (
            <p className="text-xs text-muted-foreground font-mono">
              Dev OTP: <span className="text-brand-700 font-bold">{sendMutation.data.dev_otp}</span>
            </p>
          )}
          <div>
            <label className="text-sm font-medium mb-1 block">Verification Code</label>
            <Input
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={6}
              className="max-w-[200px] font-mono text-lg tracking-widest"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setSent(false); setCode('') }}>
              Resend
            </Button>
            <Button onClick={() => verifyMutation.mutate()} disabled={code.length < 4 || verifyMutation.isPending}>
              {verifyMutation.isPending ? 'Verifying...' : 'Verify'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

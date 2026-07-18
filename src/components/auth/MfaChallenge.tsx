import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api, formatApiError } from '@/lib/api'
import { toastError, toastSuccess } from '@/lib/toast'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'

interface MfaChallengeProps {
  mfaToken: string
  onSuccess: () => void
  onBack: () => void
  mfaEndpoint?: string
}

export function MfaChallenge({
  mfaToken,
  onSuccess,
  onBack,
  mfaEndpoint = '/organizations/login/mfa',
}: MfaChallengeProps) {
  const [code, setCode] = useState('')

  const mfaMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(mfaEndpoint, { mfa_token: mfaToken, code })
      return data
    },
    onSuccess: (data) => {
      if (data.access_token) {
        useAuthStore.getState().setOrgAuth(data.access_token)
        toastSuccess('Verified')
        onSuccess()
      } else {
        toastError(data.detail || 'Verification failed')
      }
    },
    onError: (err: any) => toastError(formatApiError(err, 'Verification failed')),
  })

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Two-Factor Authentication</CardTitle>
        <CardDescription>Enter the verification code sent to your email.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium mb-1 block">Verification Code</label>
          <Input
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={6}
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack} className="flex-1">
            Back
          </Button>
          <Button
            onClick={() => mfaMutation.mutate()}
            disabled={code.length < 4 || mfaMutation.isPending}
            className="flex-1"
          >
            {mfaMutation.isPending ? 'Verifying...' : 'Verify'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

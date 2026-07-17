import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Loader2, ArrowRight } from 'lucide-react'

interface PrivacyStepProps {
  onComplete: () => void
  accepted: boolean
}

export function PrivacyStep({ onComplete, accepted }: PrivacyStepProps) {
  const { data: privacy, isLoading } = useQuery({
    queryKey: ['privacy'],
    queryFn: async () => {
      const { data } = await api.get('/organizations/privacy')
      return data as { notice_version?: string; version?: string; content?: string }
    },
  })

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const version = privacy?.notice_version || privacy?.version || '2026-07-10'
      await api.post('/organizations/me/setup/privacy/accept', {
        accepted: true,
        notice_version: version,
      })
    },
    onSuccess: onComplete,
  })

  if (accepted) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-green-600">
          <CheckCircle2 className="h-5 w-5" />
          <p className="font-medium">Privacy policy accepted</p>
        </div>
        <Button onClick={onComplete} variant="outline">
          Continue <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    )
  }

  if (isLoading) {
    return <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading privacy policy...</div>
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Privacy Policy</h3>
      <div className="max-h-48 overflow-y-auto rounded border bg-muted p-3 text-sm text-muted-foreground">
        {privacy?.content || (
          <p>Phantix Security Solutions processes your organization's asset and vulnerability data solely for the purpose of providing security assessment services. Data is encrypted at rest and in transit. We do not share your data with third parties without explicit consent. By accepting, you agree to the terms outlined in the full privacy policy (v{privacy?.notice_version || privacy?.version || '1.0'}).</p>
        )}
      </div>
      {acceptMutation.isError && (
        <p className="text-sm text-destructive">Failed to accept. Please try again.</p>
      )}
      <Button onClick={() => acceptMutation.mutate()} disabled={acceptMutation.isPending}>
        {acceptMutation.isPending ? 'Accepting...' : 'Accept & Continue'}
      </Button>
    </div>
  )
}

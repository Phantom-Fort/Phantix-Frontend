import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { CheckCircle2, ArrowRight, Loader2, Key } from 'lucide-react'

interface DualControlStepProps {
  onComplete: () => void
  configured: boolean
}

export function DualControlStep({ onComplete, configured }: DualControlStepProps) {
  const { data: users, isLoading } = useQuery({
    queryKey: ['org-users'],
    queryFn: async () => {
      const { data } = await api.get('/org-users')
      const items = data?.items || data?.users || data || []
      return Array.isArray(items) ? items : []
    },
  })

  const assignMutation = useMutation({
    mutationFn: async () => {
      const list = users || []
      if (list.length < 2) throw new Error('Need two users')
      // Assign first created as initiator, second as authorizer (order from API)
      const initId = list[0]?.id
      const authId = list[1]?.id
      if (!initId || !authId || initId === authId) throw new Error('Initiator and authorizer must be different')
      await api.put('/org-users/dual-control', {
        initiator_user_id: initId,
        authorizer_user_id: authId,
        require_dual_control: true,
      })
    },
    onSuccess: async () => {
      // Assigned using company token (bootstrap). Dual session obtained in next unlock step.
      onComplete()
    },
  })

  if (configured) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-green-600">
          <CheckCircle2 className="h-5 w-5" />
          <p className="font-medium">Dual-control configured</p>
        </div>
        <Button onClick={onComplete} variant="outline">
          Continue <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    )
  }

  if (isLoading) {
    return <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading users...</div>
  }

  const list = users || []
  const initiator = list[0]
  const authorizer = list[1]

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold flex items-center gap-2"><Key className="h-5 w-5" /> Review & Assign Dual-Control</h3>
      <p className="text-sm text-muted-foreground">Confirm the two users below. First will be Initiator, second Authorizer. They must be different people.</p>

      <div className="rounded-lg border divide-y text-sm">
        <div className="flex items-center justify-between p-3">
          <div>
            <span className="font-medium">Initiator:</span>{' '}
            <span className="text-muted-foreground">{initiator?.email || initiator?.full_name || '—'}</span>
          </div>
          {initiator && <span className="text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full">initiator</span>}
        </div>
        <div className="flex items-center justify-between p-3">
          <div>
            <span className="font-medium">Authorizer:</span>{' '}
            <span className="text-muted-foreground">{authorizer?.email || authorizer?.full_name || '—'}</span>
          </div>
          {authorizer && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">authorizer</span>}
        </div>
      </div>

      {!initiator || !authorizer ? (
        <p className="text-sm text-destructive">Need at least two org users. Complete the previous steps first.</p>
      ) : initiator.id === authorizer.id ? (
        <p className="text-sm text-destructive">Initiator and authorizer must be different users.</p>
      ) : assignMutation.isError ? (
        <p className="text-sm text-destructive">Assignment failed. Make sure both users exist and are different.</p>
      ) : null}

      <Button onClick={() => assignMutation.mutate()} disabled={!initiator || !authorizer || initiator.id === authorizer.id || assignMutation.isPending}>
        {assignMutation.isPending ? 'Assigning...' : 'Assign & Continue'}
      </Button>
    </div>
  )
}

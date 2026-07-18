import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, clearDcSession, formatApiError, isDualControlConfigured, setDualControlConfigured } from '@/lib/api'
import { toastError, toastWarning } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { CheckCircle2, ArrowRight, Loader2, Key } from 'lucide-react'


interface DualControlStepProps {
  onComplete: () => void
  configured: boolean
}

export function DualControlStep({ onComplete, configured }: DualControlStepProps) {
  const queryClient = useQueryClient()

  const { data: users, isLoading } = useQuery({
    queryKey: ['org-users'],
    queryFn: async () => {
      const { data } = await api.get('/org-users')
      const items = data?.items || data?.users || data || []
      return Array.isArray(items) ? items : []
    },
  })

  const { data: dcStatus } = useQuery({
    queryKey: ['org-users', 'dual-control'],
    queryFn: async () => {
      const { data } = await api.get('/org-users/dual-control')
      if (data?.configured) setDualControlConfigured(true)
      return data as {
        configured?: boolean
        require_dual_control?: boolean
        initiator?: { id: number; email?: string; full_name?: string }
        authorizer?: { id: number; email?: string; full_name?: string }
      }
    },
  })

  const assignMutation = useMutation({
    mutationFn: async () => {
      // Phase 2 bootstrap: company JWT only — no dual session
      if (!isDualControlConfigured()) {
        clearDcSession()
      }

      const list = users || []
      if (list.length < 2) throw new Error('Need two different org users')

      // Prefer wizard-stored IDs, else first two list entries
      const initStored = sessionStorage.getItem('phantix_wizard_initiator_id')
      const authStored = sessionStorage.getItem('phantix_wizard_authorizer_id')
      let initId = initStored ? Number(initStored) : list[0]?.id
      let authId = authStored ? Number(authStored) : list[1]?.id

      // If stored IDs missing, try match by email
      if (!initStored) {
        const initEmail = sessionStorage.getItem('phantix_wizard_initiator_email')
        if (initEmail) {
          const u = list.find((x: any) => x.email === initEmail)
          if (u) initId = u.id
        }
      }
      if (!authStored) {
        const authEmail = sessionStorage.getItem('phantix_wizard_authorizer_email')
        if (authEmail) {
          const u = list.find((x: any) => x.email === authEmail)
          if (u) authId = u.id
        }
      }

      if (!initId || !authId || initId === authId) {
        throw new Error('Initiator and authorizer must be two different users')
      }

      await api.put(
        '/org-users/dual-control',
        {
          initiator_user_id: initId,
          authorizer_user_id: authId,
          require_dual_control: true,
        },
        { _skipDc: true } as any,
      )
    },
    onSuccess: async () => {
      setDualControlConfigured(true)
      try { sessionStorage.setItem('phantix_wizard_review_done', '1') } catch { /* noop */ }
      await queryClient.invalidateQueries({ queryKey: ['org-users'] })
      await queryClient.invalidateQueries({ queryKey: ['org', 'setup'] })
      onComplete()
    },
    onError: (err: any) => {
      toastError(formatApiError(err, 'Assignment failed'))
    },
  })

  const alreadyConfigured = configured || !!dcStatus?.configured

  const handleContinue = () => {
    try { sessionStorage.setItem('phantix_wizard_review_done', '1') } catch { /* noop */ }
    onComplete()
  }

  if (alreadyConfigured) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-green-600">
          <CheckCircle2 className="h-5 w-5" />
          <p className="font-medium">Dual-control configured</p>
        </div>
        {(dcStatus?.initiator || dcStatus?.authorizer) && (
          <div className="rounded-lg border divide-y text-sm">
            <div className="p-3">
              <span className="font-medium">Initiator:</span>{' '}
              <span className="text-muted-foreground">
                {dcStatus?.initiator?.full_name || dcStatus?.initiator?.email || '—'}
              </span>
            </div>
            <div className="p-3">
              <span className="font-medium">Authorizer:</span>{' '}
              <span className="text-muted-foreground">
                {dcStatus?.authorizer?.full_name || dcStatus?.authorizer?.email || '—'}
              </span>
            </div>
          </div>
        )}
        <Button onClick={handleContinue} variant="outline">
          Continue <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading users...
      </div>
    )
  }

  const list = users || []
  const initStored = sessionStorage.getItem('phantix_wizard_initiator_id')
  const authStored = sessionStorage.getItem('phantix_wizard_authorizer_id')
  const initiator =
    (initStored && list.find((u: any) => String(u.id) === initStored)) ||
    list.find((u: any) => u.email === sessionStorage.getItem('phantix_wizard_initiator_email')) ||
    list[0]
  const authorizer =
    (authStored && list.find((u: any) => String(u.id) === authStored)) ||
    list.find((u: any) => u.email === sessionStorage.getItem('phantix_wizard_authorizer_email')) ||
    list.find((u: any) => u.id !== initiator?.id) ||
    list[1]

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <Key className="h-5 w-5" /> Review & Assign Dual-Control
      </h3>
      <p className="text-sm text-muted-foreground">
        Confirm the two users. After assign, only these people can unlock operate mode for writes.
      </p>

      <div className="rounded-lg border divide-y text-sm">
        <div className="flex items-center justify-between p-3">
          <div>
            <span className="font-medium">Initiator:</span>{' '}
            <span className="text-muted-foreground">
              {initiator?.email || initiator?.full_name || '—'}
            </span>
          </div>
          {initiator && (
            <span className="text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full">initiator</span>
          )}
        </div>
        <div className="flex items-center justify-between p-3">
          <div>
            <span className="font-medium">Authorizer:</span>{' '}
            <span className="text-muted-foreground">
              {authorizer?.email || authorizer?.full_name || '—'}
            </span>
          </div>
          {authorizer && (
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">authorizer</span>
          )}
        </div>
      </div>

      <Button
        onClick={() => {
          if (!initiator || !authorizer) {
            toastWarning('Need at least two org users. Complete the previous steps first.')
            return
          }
          if (initiator.id === authorizer.id) {
            toastError('Initiator and authorizer must be different users.')
            return
          }
          assignMutation.mutate()
        }}
        disabled={
          !initiator ||
          !authorizer ||
          initiator.id === authorizer.id ||
          assignMutation.isPending
        }
      >
        {assignMutation.isPending ? 'Assigning...' : 'Assign & Continue'}
      </Button>
    </div>
  )
}

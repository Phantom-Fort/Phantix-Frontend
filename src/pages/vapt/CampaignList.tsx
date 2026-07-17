import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { DataTable } from '@/components/shared/DataTable'
import { Card, CardContent } from '@/components/ui/card'
import { useToastStore } from '@/store/toast'
import { Swords, Loader2, Play, XCircle, ExternalLink, CheckCircle2, ListChecks, X } from 'lucide-react'
import { SubPageNav } from '@/components/shared/SubPageNav'

const PAGE_SIZE = 30

interface VaptPlan {
  plan_id: string
  name: string
  estimated_duration: string
  estimated_duration_minutes: number
  asset_count: number
  scan_types: string[]
  recommended_plan?: {
    steps: Array<{ step_type: string; step_name: string; tool: string; target: string }>
  }
  narrative?: string
  based_on?: Record<string, unknown>
}

export function CampaignList() {
  const queryClient = useQueryClient()
  const [offset, setOffset] = useState(0)
  const [plan, setPlan] = useState<VaptPlan | null>(null)
  const [planning, setPlanning] = useState(false)
  const [showProcedures, setShowProcedures] = useState(false)
  const [selectedProcedure, setSelectedProcedure] = useState<string>('')
  const { addToast } = useToastStore()

  const { data, isLoading } = useQuery({
    queryKey: ['campaigns', 'list', offset],
    queryFn: async () => {
      const { data } = await api.get(`/vapt/campaigns?limit=${PAGE_SIZE}&offset=${offset}`)
      return data as { items: any[]; total: number }
    },
    refetchInterval: 10000,
  })

  const campaigns = data?.items ?? []
  const total = data?.total ?? 0

  const { data: proceduresData } = useQuery({
    queryKey: ['vapt', 'procedures'],
    queryFn: async () => {
      const { data } = await api.get('/vapt/procedures')
      return data?.items || data || []
    },
  })
  const procedures = proceduresData || []

  const { data: settingsData } = useQuery({
    queryKey: ['vapt', 'settings'],
    queryFn: async () => {
      const { data } = await api.get('/vapt/settings')
      return data
    },
  })

  const { data: schedulesData } = useQuery({
    queryKey: ['vapt', 'schedules'],
    queryFn: async () => {
      const { data } = await api.get('/vapt/schedules')
      return data?.items || data || []
    },
  })

  const planMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/vapt/plan', {})
      return data as VaptPlan
    },
    onSuccess: (data) => {
      setPlan(data)
      setPlanning(false)
    },
    onError: (err: any) => {
      addToast({ type: 'error', title: 'Planning failed', message: err?.response?.data?.detail || 'Could not generate campaign plan.' })
      setPlanning(false)
    },
  })

  const executeMutation = useMutation({
    mutationFn: async (planId: string) => {
      const { data } = await api.post('/vapt/plan/execute', { plan_id: planId, start: false })
      return data as { campaign_id: number; status: string; campaign?: any }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      setPlan(null)
      addToast({ type: 'success', title: 'Campaign created', message: `Campaign #${data.campaign_id} is ready. Review and start when ready.` })
    },
    onError: (err: any) => {
      addToast({ type: 'error', title: 'Execution failed', message: err?.response?.data?.detail || 'Could not execute plan.' })
    },
  })

  const createFromProcedure = useMutation({
    mutationFn: async (procedureKey: string) => {
      const { data } = await api.post('/vapt/campaigns', {
        procedure_key: procedureKey,
        campaign_type: 'procedure_based',
        start: false
      })
      return data
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      addToast({ type: 'success', title: 'Campaign created from procedure', message: `Campaign #${data.id} created.` })
      setSelectedProcedure('')
    },
    onError: (err: any) => {
      addToast({ type: 'error', title: 'Create failed', message: err?.response?.data?.detail || 'Could not create campaign.' })
    },
  })

  const startMutation = useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.post(`/vapt/campaigns/${id}/start`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      addToast({ type: 'success', title: 'Campaign started' })
    },
    onError: (err: any) => {
      addToast({ type: 'error', title: 'Start failed', message: err?.response?.data?.detail || 'Could not start campaign.' })
    },
  })

  const cancelMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.post(`/vapt/campaigns/${id}/cancel`, { reason: 'User cancelled' })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      addToast({ type: 'info', title: 'Campaign cancelled' })
    },
    onError: (err: any) => {
      addToast({ type: 'error', title: 'Cancel failed', message: err?.response?.data?.detail })
    },
  })

  const pauseMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.post(`/vapt/campaigns/${id}/pause`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      addToast({ type: 'info', title: 'Campaign paused' })
    },
  })

  const resumeMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.post(`/vapt/campaigns/${id}/resume`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      addToast({ type: 'success', title: 'Campaign resumed' })
    },
  })

  const approveMutation = useMutation({
    mutationFn: async ({ requestId }: { requestId: number }) => {
      const { data } = await api.post(`/vapt/approvals/${requestId}/decide`, { approve: true })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      addToast({ type: 'success', title: 'Approved', message: 'Campaign approved. Start it to begin execution.' })
    },
    onError: (err: any) => {
      addToast({ type: 'error', title: 'Approval failed', message: err?.response?.data?.detail })
    },
  })

  const hasActive = Array.isArray(campaigns) && campaigns.some((c: any) => c.status === 'active' || c.status === 'running')
  const isPendingWork = planMutation.isPending || executeMutation.isPending

  const approvalsQuery = useQuery({
    queryKey: ['campaigns', 'approvals'],
    queryFn: async () => {
      const results = await Promise.allSettled(
        campaigns.filter((c: any) => c.status === 'pending_approval' || (c.approval_status === 'pending' && c.status === 'draft'))
          .map(async (c: any) => {
            const { data } = await api.get(`/vapt/campaigns/${c.id}/approvals`)
            return { campaignId: c.id, approvals: Array.isArray(data) ? data : data?.items || [] }
          }),
      )
      return results.filter((r) => r.status === 'fulfilled').map((r: any) => r.value)
    },
    enabled: campaigns.some((c: any) => c.status === 'pending_approval' || (c.approval_status === 'pending' && c.status === 'draft')),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">VAPT Campaigns</h1>
          <p className="text-muted-foreground">Manage security assessment campaigns</p>
        </div>
        <Button onClick={() => { setPlanning(true); planMutation.mutate() }} disabled={hasActive || isPendingWork}>
          {planMutation.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Swords className="mr-1 h-4 w-4" />}
          Plan New Campaign (Intelligent)
        </Button>
        <Button variant="outline" onClick={() => setShowProcedures(!showProcedures)}>
          Browse Procedures
        </Button>
      </div>

      <SubPageNav items={[{ label: 'Campaigns', to: '/vapt' }]} />

      {showProcedures && (
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold mb-2">Available Procedures</h3>
            <div className="flex flex-wrap gap-2 mb-3">
              {procedures.map((p: any) => (
                <button
                  key={p.key || p.procedure_key}
                  onClick={() => setSelectedProcedure(p.key || p.procedure_key)}
                  className={`px-3 py-1 text-sm rounded border ${selectedProcedure === (p.key || p.procedure_key) ? 'bg-brand-700 text-white' : 'hover:bg-muted'}`}
                >
                  {p.name || p.procedure_key || p.key}
                </button>
              ))}
            </div>
            {selectedProcedure && (
              <Button onClick={() => createFromProcedure.mutate(selectedProcedure)} disabled={createFromProcedure.isPending}>
                Create Campaign from "{selectedProcedure}"
              </Button>
            )}
            <p className="text-xs text-muted-foreground mt-2">Procedures include builtin (web_scan, full_vapt) and custom overrides.</p>
          </CardContent>
        </Card>
      )}

      {/* Settings quick view */}
      {settingsData && (
        <div className="text-xs text-muted-foreground">
          VAPT Settings: Mining consent {settingsData.mining_consent ? 'on' : 'off'} · AI threshold {settingsData.ai_complexity_threshold || 'default'}
        </div>
      )}

      {/* Schedules */}
      {schedulesData?.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold text-sm mb-2">Active Schedules</h3>
            <ul className="text-xs space-y-1">
              {schedulesData.map((s: any) => (
                <li key={s.id}>• {s.schedule_name || s.id} — {s.procedure_key} (cron: {s.cron_expression})</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Plan Review Modal */}
      {plan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setPlan(null)}>
          <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-lg bg-background p-6 shadow-xl border space-y-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2"><ListChecks className="h-5 w-5 text-brand-700" /> Campaign Plan Review</h2>
              <button onClick={() => setPlan(null)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>

            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="rounded-lg bg-muted p-3">
                <p className="text-2xl font-bold text-foreground">{plan.estimated_duration_minutes}</p>
                <p className="text-xs text-muted-foreground">Est. minutes</p>
              </div>
              <div className="rounded-lg bg-muted p-3">
                <p className="text-2xl font-bold text-foreground">{plan.asset_count}</p>
                <p className="text-xs text-muted-foreground">Assets covered</p>
              </div>
              <div className="rounded-lg bg-muted p-3">
                <p className="text-2xl font-bold text-foreground">{plan.scan_types?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Scan types</p>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2">Scan Types</h3>
              <div className="flex flex-wrap gap-1.5">
                {(plan.scan_types || []).map((t: string) => (
                  <span key={t} className="rounded-full bg-brand-50 text-brand-700 dark:bg-brand-800 dark:text-white px-2.5 py-0.5 text-xs font-medium">
                    {t.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>

            {plan.recommended_plan?.steps && (
              <div>
                <h3 className="text-sm font-semibold mb-2">Execution Steps ({plan.recommended_plan.steps.length})</h3>
                <div className="space-y-1.5">
                  {plan.recommended_plan.steps.map((s: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2 text-sm">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-700 text-xs text-white font-medium">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{s.step_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{s.tool} — {s.target}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">{s.step_type}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {plan.narrative && (
              <div>
                <h3 className="text-sm font-semibold mb-1">Narrative</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{plan.narrative}</p>
              </div>
            )}

            <div className="flex gap-2 pt-2 border-t">
              <Button variant="outline" onClick={() => setPlan(null)} className="flex-1">Revise Plan</Button>
              <Button onClick={() => executeMutation.mutate(plan.plan_id)} disabled={executeMutation.isPending} className="flex-1">
                {executeMutation.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Play className="mr-1.5 h-4 w-4" />}
                Execute Plan
              </Button>
            </div>
          </div>
        </div>
      )}

      <DataTable
        columns={[
          { key: 'campaign', label: 'Campaign', width: '2fr', render: (c: any) => (
            <div className="min-w-0">
               <a href={`/vapt/${c.id}`} className="font-medium text-foreground hover:underline flex items-center gap-1">
                {c.campaign_name || `Campaign #${c.id}`} <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
              <p className="text-xs text-muted-foreground">Created {new Date(c.created_at).toLocaleDateString()}</p>
            </div>
          )},
          { key: 'phase', label: 'Phase', width: '130px', render: (c: any) => <span className="text-xs text-muted-foreground">{c.current_phase?.replace(/_/g, ' ') || '—'}</span> },
          { key: 'status', label: 'Status', width: '110px', render: (c: any) => <StatusBadge status={c.status} pulse={c.status === 'running'} /> },
          { key: 'approval', label: 'Approval', width: '120px', render: (c: any) => (
            <span className="text-xs">
              {c.approval_status === 'pending' && c.status !== 'pending_approval' ? (
                <span className="text-yellow-600">Pending</span>
              ) : c.approval_status === 'approved' ? (
                <span className="text-green-600 flex items-center gap-0.5"><CheckCircle2 className="h-3 w-3" /> Approved</span>
              ) : c.approval_status === 'rejected' ? (
                <span className="text-red-600">Rejected</span>
              ) : c.approval_required ? (
                <span className="text-yellow-600">Required</span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </span>
          )},
          { key: 'actions', label: 'Actions', width: '200px', render: (c: any) => (
            <div className="flex gap-1">
              {(c.status === 'pending_approval' || (c.approval_status === 'pending' && c.status === 'draft')) && (
                <>
                  <Button size="sm" variant="outline" className="text-green-600 border-green-300" onClick={() => {
                    const app = (approvalsQuery.data || []).find((a: any) => a.campaignId === c.id)
                    if (app?.approvals?.length) {
                      approveMutation.mutate({ requestId: app.approvals[0].id })
                    } else {
                      addToast({ type: 'warning', title: 'No approval requests', message: 'Loading approval requests...' })
                    }
                  }} disabled={approveMutation.isPending}>
                    <CheckCircle2 className="mr-1 h-3 w-3" /> Approve
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => {
                    addToast({ type: 'info', title: 'Coming soon', message: 'Rejection flow TBD' })
                  }}>
                    <XCircle className="h-3 w-3" />
                  </Button>
                </>
              )}
              {c.status === 'draft' && !c.approval_required && (
                <Button size="sm" variant="outline" onClick={() => startMutation.mutate(c.id)} disabled={startMutation.isPending}>
                  <Play className="mr-1 h-3 w-3" /> Start
                </Button>
              )}
              {c.status === 'draft' && c.approval_status === 'approved' && (
                <Button size="sm" variant="outline" onClick={() => startMutation.mutate(c.id)} disabled={startMutation.isPending}>
                  <Play className="mr-1 h-3 w-3" /> Start
                </Button>
              )}
              {(c.status === 'active' || c.status === 'paused') && (
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => cancelMutation.mutate(c.id)}>
                  <XCircle className="h-3 w-3" />
                </Button>
              )}
              {c.status === 'active' && (
                <Button size="sm" variant="outline" onClick={() => pauseMutation.mutate(c.id)} disabled={pauseMutation.isPending}>
                  Pause
                </Button>
              )}
              {c.status === 'paused' && (
                <Button size="sm" variant="outline" onClick={() => resumeMutation.mutate(c.id)} disabled={resumeMutation.isPending}>
                  <Play className="mr-1 h-3 w-3" /> Resume
                </Button>
              )}
            </div>
          )},
        ]}
        data={campaigns}
        total={total}
        offset={offset}
        limit={PAGE_SIZE}
        isLoading={isLoading || planning}
        isEmpty={!campaigns || campaigns.length === 0}
        emptyIcon={Swords}
        emptyTitle="No VAPT campaigns yet"
        emptyDescription="Click 'Plan New Campaign' to generate an intelligent security assessment plan."
        onPageChange={setOffset}
        keyExtractor={(c: any) => c.id}
      />
    </div>
  )
}

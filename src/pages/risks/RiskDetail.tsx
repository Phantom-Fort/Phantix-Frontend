import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, formatApiError } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SeverityBadge } from '@/components/shared/SeverityBadge'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { SubPageNav } from '@/components/shared/SubPageNav'
import { JsonViewer } from '@/components/shared/JsonViewer'
import { useToastStore } from '@/store/toast'
import { toastError } from '@/lib/toast'
import { useAuthStore } from '@/store/auth'
import { useDualControlStore, type DcRoleRequired } from '@/store/dualControl'
import type { Risk, RiskAssessment, RiskHistory, RiskTreatment } from '@/types/api'
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  History,
  KeyRound,
  Loader2,
  Shield,
  UserCheck,
  XCircle,
} from 'lucide-react'

const DEPARTMENTS = [
  'IT',
  'Security',
  'Finance',
  'Operations',
  'Legal',
  'Compliance',
  'Engineering',
  'Executive',
  'Other',
]
const TREATMENT_TYPES = ['mitigate', 'accept', 'transfer', 'avoid']
const LIKELIHOOD = ['very_low', 'low', 'medium', 'high', 'very_high']
const IMPACT = ['very_low', 'low', 'medium', 'high', 'very_high']
const STATUSES = ['open', 'in_treatment', 'accepted', 'closed', 'monitoring']

export function RiskDetail() {
  const { id } = useParams()
  const riskId = Number(id)
  const queryClient = useQueryClient()
  const { addToast } = useToastStore()
  const { orgUser, dcSession } = useAuthStore()
  const requireDcSession = useDualControlStore((s) => s.requireDcSession)
  const [tab, setTab] = useState<'overview' | 'treatments' | 'assessments' | 'history'>('overview')
  const [showTreatForm, setShowTreatForm] = useState(false)
  const [rejectId, setRejectId] = useState<number | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [edit, setEdit] = useState({
    title: '',
    description: '',
    owner_department: '',
    treatment_plan: '',
    status: '',
  })
  const [treatForm, setTreatForm] = useState({
    treatment_type: 'mitigate',
    treatment_plan: '',
    estimated_cost: '',
    estimated_effort_days: '',
    target_completion_date: '',
    residual_likelihood: '',
    residual_impact: '',
  })

  const riskQuery = useQuery({
    queryKey: ['risks', riskId],
    queryFn: async () => {
      const { data } = await api.get(`/risks/${riskId}`)
      const r = data as Risk
      setEdit({
        title: r.title || '',
        description: r.description || '',
        owner_department: r.owner_department || '',
        treatment_plan: r.treatment_plan || '',
        status: r.status || '',
      })
      return r
    },
    enabled: Number.isFinite(riskId) && riskId > 0,
  })

  useEffect(() => {
    if (riskQuery.isError) {
      toastError(formatApiError(riskQuery.error, 'Risk not found'))
    }
  }, [riskQuery.isError, riskQuery.error])

  const treatmentsQuery = useQuery({
    queryKey: ['risks', riskId, 'treatments'],
    queryFn: async () => {
      const { data } = await api.get(`/risks/${riskId}/treatments`)
      return (Array.isArray(data) ? data : []) as RiskTreatment[]
    },
    enabled: Number.isFinite(riskId) && riskId > 0,
  })

  const dcStatusQuery = useQuery({
    queryKey: ['org-users', 'dual-control'],
    queryFn: async () => {
      const { data } = await api.get('/org-users/dual-control')
      return data as {
        configured?: boolean
        initiator?: { id: number; email?: string; full_name?: string }
        authorizer?: { id: number; email?: string; full_name?: string }
      }
    },
  })

  /** Run action; if no session (or 403 dual-control), open unlock for the required role then retry. */
  const runWithRole = async (
    role: DcRoleRequired,
    label: string,
    action: () => Promise<unknown>,
  ) => {
    const hasSession = !!sessionStorage.getItem('dc_session')
    if (!hasSession) {
      requireDcSession({
        role,
        label,
        retry: async () => {
          await action()
        },
      })
      return
    }
    try {
      await action()
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      const msg = typeof detail === 'string' ? detail : detail?.message || ''
      const status = err?.response?.status
      if (
        status === 403 &&
        (/authorizer|initiator|dual-control|X-Dual-Control-Session|Authenticator/i.test(msg) ||
          detail?.required_header)
      ) {
        // Wrong person or missing session — force unlock as the required role
        sessionStorage.removeItem('dc_session')
        useAuthStore.setState({ dcSession: null })
        requireDcSession({
          role,
          label,
          retry: async () => {
            await action()
          },
        })
        return
      }
      throw err
    }
  }

  const assessmentsQuery = useQuery({
    queryKey: ['risks', riskId, 'assessments'],
    queryFn: async () => {
      const { data } = await api.get(`/risks/${riskId}/assessments`)
      return (Array.isArray(data) ? data : []) as RiskAssessment[]
    },
    enabled: Number.isFinite(riskId) && riskId > 0 && tab === 'assessments',
  })

  const historyQuery = useQuery({
    queryKey: ['risks', riskId, 'history'],
    queryFn: async () => {
      const { data } = await api.get(`/risks/${riskId}/history?limit=50`)
      return (Array.isArray(data) ? data : []) as RiskHistory[]
    },
    enabled: Number.isFinite(riskId) && riskId > 0 && tab === 'history',
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['risks', riskId] })
    queryClient.invalidateQueries({ queryKey: ['risks', riskId, 'treatments'] })
    queryClient.invalidateQueries({ queryKey: ['risks', 'list'] })
    queryClient.invalidateQueries({ queryKey: ['risks', 'prioritized'] })
  }

  const patchMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {}
      if (edit.title) body.title = edit.title
      if (edit.description !== undefined) body.description = edit.description
      if (edit.owner_department) body.owner_department = edit.owner_department
      if (edit.treatment_plan !== undefined) body.treatment_plan = edit.treatment_plan
      if (edit.status) body.status = edit.status
      const { data } = await api.patch(`/risks/${riskId}`, body)
      return data as Risk
    },
    onSuccess: () => {
      addToast({ type: 'success', title: 'Risk updated' })
      invalidate()
    },
    onError: (err: any) => addToast({ type: 'error', title: formatApiError(err) }),
  })

  const proposeAsInitiator = async () => {
    const body: Record<string, unknown> = {
      treatment_type: treatForm.treatment_type,
      treatment_plan: treatForm.treatment_plan,
    }
    if (treatForm.estimated_cost) body.estimated_cost = Number(treatForm.estimated_cost)
    if (treatForm.estimated_effort_days)
      body.estimated_effort_days = Number(treatForm.estimated_effort_days)
    if (treatForm.target_completion_date)
      body.target_completion_date = treatForm.target_completion_date
    if (treatForm.residual_likelihood) body.residual_likelihood = treatForm.residual_likelihood
    if (treatForm.residual_impact) body.residual_impact = treatForm.residual_impact

    await runWithRole('initiator', 'Propose treatment (initiator)', async () => {
      await api.post(`/risks/${riskId}/treatments`, body)
      addToast({ type: 'success', title: 'Treatment proposed (initiator)' })
      setShowTreatForm(false)
      setTreatForm({
        treatment_type: 'mitigate',
        treatment_plan: '',
        estimated_cost: '',
        estimated_effort_days: '',
        target_completion_date: '',
        residual_likelihood: '',
        residual_impact: '',
      })
      invalidate()
    })
  }

  const submitAsInitiator = async (treatmentId: number) => {
    await runWithRole('initiator', `Submit treatment #${treatmentId} (initiator)`, async () => {
      await api.post(`/risks/treatments/${treatmentId}/submit`)
      addToast({
        type: 'success',
        title: 'Submitted for authorizer approval',
        message: 'Authorizer must unlock next to approve or reject.',
      })
      invalidate()
    })
  }

  const approveAsAuthorizer = async (treatmentId: number) => {
    // Backend: require_authorizer_session — wrong role opens authorizer unlock
    await runWithRole('authorizer', `Approve treatment #${treatmentId}`, async () => {
      await api.post(`/risks/treatments/${treatmentId}/approve`, { notes: null })
      addToast({ type: 'success', title: 'Treatment approved by authorizer' })
      invalidate()
    })
  }

  const rejectAsAuthorizer = async (treatmentId: number, reason: string) => {
    await runWithRole('authorizer', `Reject treatment #${treatmentId}`, async () => {
      await api.post(`/risks/treatments/${treatmentId}/reject`, { reason })
      addToast({ type: 'success', title: 'Treatment rejected by authorizer' })
      setRejectId(null)
      setRejectReason('')
      invalidate()
    })
  }

  const completeAsInitiator = async (treatmentId: number) => {
    await runWithRole('initiator', `Complete treatment #${treatmentId}`, async () => {
      await api.post(`/risks/treatments/${treatmentId}/complete`)
      addToast({ type: 'success', title: 'Treatment completed; residual risk recorded' })
      invalidate()
    })
  }

  const [busy, setBusy] = useState(false)
  const wrap = async (fn: () => Promise<void>) => {
    setBusy(true)
    try {
      await fn()
    } catch (err: any) {
      addToast({ type: 'error', title: formatApiError(err) })
    } finally {
      setBusy(false)
    }
  }

  const dc = dcStatusQuery.data
  const actingEmail = orgUser?.email
  const actingIsInitiator =
    !!actingEmail && !!dc?.initiator?.email && actingEmail === dc.initiator.email
  const actingIsAuthorizer =
    !!actingEmail && !!dc?.authorizer?.email && actingEmail === dc.authorizer.email

  if (riskQuery.isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground p-8">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading risk…
      </div>
    )
  }

  if (riskQuery.isError || !riskQuery.data) {
    return (
      <div className="space-y-4 p-6">
        <Link to="/risks" className="text-sm text-brand-700 hover:underline">
          Back to risks
        </Link>
      </div>
    )
  }

  const risk = riskQuery.data
  const treatments = treatmentsQuery.data ?? []

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            to="/risks"
            className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Risk register
          </Link>
          <h1 className="text-2xl font-bold text-foreground">{risk.title}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {risk.risk_level && <SeverityBadge severity={risk.risk_level} />}
            <StatusBadge status={risk.status} />
            {risk.priority_band && (
              <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded">
                {risk.priority_band}
                {risk.priority_label ? ` · ${risk.priority_label}` : ''}
              </span>
            )}
            <span className="text-sm text-muted-foreground">
              Score: <span className="font-mono text-foreground">{risk.risk_score ?? '—'}</span>
            </span>
          </div>
        </div>
      </div>

      <SubPageNav
        items={[
          { label: 'Risks', to: '/risks' },
          { label: 'Reports', to: '/reports' },
          { label: 'Tracker', to: '/tracker' },
        ]}
      />

      <div className="flex flex-wrap gap-2 border-b pb-2">
        {(
          [
            ['overview', 'Overview'],
            ['treatments', 'Treatments'],
            ['assessments', 'Assessments'],
            ['history', 'History'],
          ] as const
        ).map(([k, label]) => (
          <Button
            key={k}
            size="sm"
            variant={tab === k ? 'default' : 'ghost'}
            onClick={() => setTab(k)}
          >
            {label}
          </Button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Description</div>
                <p className="mt-0.5">{risk.description || '—'}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-muted-foreground">Threat</div>
                  <p>{risk.threat_event || '—'}</p>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Vulnerability</div>
                  <p>{risk.vulnerability || '—'}</p>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Likelihood / Impact</div>
                  <p>
                    {risk.likelihood || '—'} / {risk.impact || '—'}
                  </p>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Asset</div>
                  <p>
                    {risk.asset_id != null ? `#${risk.asset_id}` : '—'}
                    {risk.asset_criticality ? ` (${risk.asset_criticality})` : ''}
                  </p>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Residual</div>
                  <p>
                    {risk.residual_risk_score ?? '—'}
                    {risk.residual_risk_level ? ` · ${risk.residual_risk_level}` : ''}
                  </p>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Source</div>
                  <p>{risk.source || '—'}</p>
                </div>
              </div>
              {risk.scoring_breakdown && Object.keys(risk.scoring_breakdown).length > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Scoring breakdown</div>
                  <JsonViewer data={risk.scoring_breakdown} />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ownership & plan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-xs font-medium mb-1 block">Title</label>
                <Input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Description</label>
                <textarea
                  className="w-full min-h-[80px] rounded-md border border-input bg-background text-foreground px-3 py-2 text-sm"
                  value={edit.description}
                  onChange={(e) => setEdit({ ...edit, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium mb-1 block">Department</label>
                  <select
                    className="w-full h-9 rounded-md border border-input bg-background text-foreground px-2 text-sm"
                    value={edit.owner_department}
                    onChange={(e) => setEdit({ ...edit, owner_department: e.target.value })}
                  >
                    <option value="">—</option>
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Status</label>
                  <select
                    className="w-full h-9 rounded-md border border-input bg-background text-foreground px-2 text-sm"
                    value={edit.status}
                    onChange={(e) => setEdit({ ...edit, status: e.target.value })}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Treatment plan (summary)</label>
                <textarea
                  className="w-full min-h-[70px] rounded-md border border-input bg-background text-foreground px-3 py-2 text-sm"
                  value={edit.treatment_plan}
                  onChange={(e) => setEdit({ ...edit, treatment_plan: e.target.value })}
                />
              </div>
              <Button onClick={() => patchMutation.mutate()} disabled={patchMutation.isPending}>
                {patchMutation.isPending ? 'Saving…' : 'Save changes'}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'treatments' && (
        <div className="space-y-4">
          <Card className="border-brand-200/60 dark:border-brand-800">
            <CardContent className="p-4 space-y-3 text-sm">
              <div className="font-medium flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-brand-700" /> Two-person treatment flow
              </div>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground text-xs sm:text-sm">
                <li>
                  <strong className="text-foreground">Initiator</strong> proposes treatment, then
                  submits for approval
                  {dc?.initiator?.email ? ` (${dc.initiator.email})` : ''}.
                </li>
                <li>
                  <strong className="text-foreground">Authorizer</strong> unlocks and approves or
                  rejects
                  {dc?.authorizer?.email ? ` (${dc.authorizer.email})` : ''}.
                </li>
                <li>
                  <strong className="text-foreground">Initiator</strong> marks treatment complete
                  after work is done.
                </li>
              </ol>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {dcSession ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 px-2 py-0.5">
                    <KeyRound className="h-3 w-3" />
                    Session active
                    {actingEmail ? `: ${actingEmail}` : ''}
                    {actingIsInitiator ? ' · Initiator' : ''}
                    {actingIsAuthorizer ? ' · Authorizer' : ''}
                  </span>
                ) : (
                  <span className="text-muted-foreground">No dual-control session — unlock when prompted.</span>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    requireDcSession({
                      role: 'initiator',
                      label: 'Unlock as Initiator (manual)',
                      retry: async () => {
                        addToast({ type: 'success', title: 'Initiator session ready' })
                      },
                    })
                  }
                >
                  Unlock Initiator
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    requireDcSession({
                      role: 'authorizer',
                      label: 'Unlock as Authorizer (manual)',
                      retry: async () => {
                        addToast({ type: 'success', title: 'Authorizer session ready' })
                      },
                    })
                  }
                >
                  Unlock Authorizer
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              Propose / submit = Initiator · Approve / reject = Authorizer only
            </p>
            <Button size="sm" onClick={() => setShowTreatForm(!showTreatForm)}>
              {showTreatForm ? 'Cancel' : 'Propose treatment'}
            </Button>
          </div>

          {showTreatForm && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium mb-1 block">Type</label>
                    <select
                      className="w-full h-9 rounded-md border border-input bg-background text-foreground px-2 text-sm"
                      value={treatForm.treatment_type}
                      onChange={(e) => setTreatForm({ ...treatForm, treatment_type: e.target.value })}
                    >
                      {TREATMENT_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">Target date</label>
                    <Input
                      type="date"
                      value={treatForm.target_completion_date}
                      onChange={(e) =>
                        setTreatForm({ ...treatForm, target_completion_date: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">Est. cost</label>
                    <Input
                      type="number"
                      value={treatForm.estimated_cost}
                      onChange={(e) => setTreatForm({ ...treatForm, estimated_cost: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">Effort (days)</label>
                    <Input
                      type="number"
                      value={treatForm.estimated_effort_days}
                      onChange={(e) =>
                        setTreatForm({ ...treatForm, estimated_effort_days: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">Residual likelihood</label>
                    <select
                      className="w-full h-9 rounded-md border border-input bg-background text-foreground px-2 text-sm"
                      value={treatForm.residual_likelihood}
                      onChange={(e) =>
                        setTreatForm({ ...treatForm, residual_likelihood: e.target.value })
                      }
                    >
                      <option value="">—</option>
                      {LIKELIHOOD.map((x) => (
                        <option key={x} value={x}>
                          {x}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">Residual impact</label>
                    <select
                      className="w-full h-9 rounded-md border border-input bg-background text-foreground px-2 text-sm"
                      value={treatForm.residual_impact}
                      onChange={(e) => setTreatForm({ ...treatForm, residual_impact: e.target.value })}
                    >
                      <option value="">—</option>
                      {IMPACT.map((x) => (
                        <option key={x} value={x}>
                          {x}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Treatment plan</label>
                  <textarea
                    className="w-full min-h-[90px] rounded-md border border-input bg-background text-foreground px-3 py-2 text-sm"
                    value={treatForm.treatment_plan}
                    onChange={(e) => setTreatForm({ ...treatForm, treatment_plan: e.target.value })}
                    placeholder="Describe mitigation steps…"
                  />
                </div>
                <Button
                  onClick={() => wrap(proposeAsInitiator)}
                  disabled={busy || !treatForm.treatment_plan.trim()}
                >
                  {busy ? 'Working…' : 'Propose as Initiator'}
                </Button>
              </CardContent>
            </Card>
          )}

          {treatmentsQuery.isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading treatments…
            </div>
          ) : treatments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No treatments yet.</p>
          ) : (
            <div className="space-y-3">
              {treatments.map((t) => (
                <Card key={t.id}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-brand-700" />
                        <span className="font-medium text-sm capitalize">{t.treatment_type}</span>
                        <StatusBadge status={t.status} />
                      </div>
                      <span className="text-xs text-muted-foreground">#{t.id}</span>
                    </div>
                    <p className="text-sm">{t.treatment_plan}</p>
                    <div className="text-xs text-muted-foreground flex flex-wrap gap-3">
                      {t.estimated_cost != null && <span>Cost: {t.estimated_cost}</span>}
                      {t.estimated_effort_days != null && <span>Days: {t.estimated_effort_days}</span>}
                      {t.target_completion_date && <span>Target: {t.target_completion_date}</span>}
                      {t.residual_risk_score != null && (
                        <span>
                          Residual: {t.residual_risk_score}
                          {t.residual_risk_level ? ` (${t.residual_risk_level})` : ''}
                        </span>
                      )}
                      {t.rejection_reason && (
                        <span className="text-muted-foreground">Rejected: {t.rejection_reason}</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {['draft', 'proposed'].includes(t.status) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => wrap(() => submitAsInitiator(t.id))}
                          disabled={busy}
                        >
                          Submit (Initiator)
                        </Button>
                      )}
                      {['pending_approval', 'submitted'].includes(t.status) && (
                        <>
                          <Button
                            size="sm"
                            className="text-green-700"
                            variant="outline"
                            onClick={() => wrap(() => approveAsAuthorizer(t.id))}
                            disabled={busy}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve (Authorizer)
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => setRejectId(t.id)}
                            disabled={busy}
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1" /> Reject (Authorizer)
                          </Button>
                        </>
                      )}
                      {['approved', 'in_progress'].includes(t.status) && (
                        <Button
                          size="sm"
                          onClick={() => wrap(() => completeAsInitiator(t.id))}
                          disabled={busy}
                        >
                          Mark complete (Initiator)
                        </Button>
                      )}
                    </div>
                    {rejectId === t.id && (
                      <div className="flex gap-2 items-end pt-2 border-t">
                        <div className="flex-1">
                          <label className="text-xs font-medium mb-1 block">Rejection reason</label>
                          <Input
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Why is this rejected?"
                          />
                        </div>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={rejectReason.length < 2 || busy}
                          onClick={() =>
                            wrap(() => rejectAsAuthorizer(t.id, rejectReason))
                          }
                        >
                          Confirm reject (Authorizer unlock)
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'assessments' && (
        <div className="space-y-3">
          {assessmentsQuery.isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading assessments…
            </div>
          ) : (assessmentsQuery.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No assessments recorded.</p>
          ) : (
            (assessmentsQuery.data ?? []).map((a) => (
              <Card key={a.id}>
                <CardContent className="p-4 text-sm space-y-1">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-brand-700" />
                    <span className="font-medium">{a.assessment_type}</span>
                    {a.risk_level && <SeverityBadge severity={a.risk_level} />}
                    <span className="text-xs text-muted-foreground ml-auto">
                      {a.created_at ? new Date(a.created_at).toLocaleString() : ''}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Score: {a.calculated_risk_score ?? '—'} · L/I: {a.likelihood_score ?? '—'}/
                    {a.impact_score ?? '—'} · Method: {a.scoring_method || '—'} · By:{' '}
                    {a.performed_by || '—'}
                  </div>
                  {a.notes && <p>{a.notes}</p>}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-3">
          {historyQuery.isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading history…
            </div>
          ) : (historyQuery.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No history yet.</p>
          ) : (
            (historyQuery.data ?? []).map((h) => (
              <Card key={h.id}>
                <CardContent className="p-4 text-sm space-y-1">
                  <div className="flex items-center gap-2">
                    <History className="h-4 w-4 text-brand-700" />
                    <span className="font-medium">{h.change_type || 'change'}</span>
                    <span className="text-xs text-muted-foreground">
                      by {h.changed_by || '—'} ·{' '}
                      {h.created_at ? new Date(h.created_at).toLocaleString() : ''}
                    </span>
                  </div>
                  {(h.previous_value || h.new_value) && (
                    <div className="grid sm:grid-cols-2 gap-2 text-xs">
                      {h.previous_value && (
                        <div>
                          <div className="text-muted-foreground mb-0.5">Previous</div>
                          <JsonViewer data={h.previous_value} />
                        </div>
                      )}
                      {h.new_value && (
                        <div>
                          <div className="text-muted-foreground mb-0.5">New</div>
                          <JsonViewer data={h.new_value} />
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  )
}

import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { SeverityBadge } from '@/components/shared/SeverityBadge'
import { Pagination } from '@/components/shared/Pagination'
import { useToastStore } from '@/store/toast'
import { SubPageNav } from '@/components/shared/SubPageNav'
import { ScanEvidence } from '@/components/shared/ScanEvidence'
import { Loader2, ArrowLeft, Play, Pause, XCircle, ChevronDown, ChevronUp } from 'lucide-react'

export function CampaignDetail() {
  const { id } = useParams<{ id: string }>()
  const [tab, setTab] = useState<'correlations' | 'findings'>('correlations')
  const [expandedFinding, setExpandedFinding] = useState<number | null>(null)
  const [corrOffset, setCorrOffset] = useState(0)
  const [findingsOffset, setFindingsOffset] = useState(0)
  const [expandedRaw, setExpandedRaw] = useState<number | null>(null)
  const PAGE_SIZE = 30

  const { data: campaign, isLoading } = useQuery({
    queryKey: ['campaign', id],
    queryFn: async () => {
      const { data } = await api.get(`/vapt/campaigns/${id}`)
      return data
    },
    refetchInterval: (query) => {
      const c = query.state.data as any
      return c && (c.status === 'active' || c.status === 'running') ? 5000 : false
    },
  })

  const { data: approvalsData } = useQuery({
    queryKey: ['campaign', id, 'approvals'],
    queryFn: async () => {
      const { data } = await api.get(`/vapt/campaigns/${id}/approvals`)
      return Array.isArray(data) ? data : data?.items || []
    },
    enabled: !!id,
  })
  const approvals = approvalsData || []

  const { data: correlationsData } = useQuery({
    queryKey: ['campaign', id, 'correlations', corrOffset],
    queryFn: async () => {
      const { data } = await api.get(`/vapt/campaigns/${id}/findings?limit=${PAGE_SIZE}&offset=${corrOffset}`)
      const items = Array.isArray(data) ? data : data?.items || data?.findings || []
      return items.slice(0, PAGE_SIZE) // cap
    },
    enabled: tab === 'correlations',
  })
  const correlations = correlationsData || []

  const { data: findingsData } = useQuery({
    queryKey: ['campaign', id, 'findings', findingsOffset],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(findingsOffset) })
      const { data } = await api.get(`/scans/results?${params}`)
      const items = Array.isArray(data) ? data : data?.items || data?.results || []
      return items.slice(0, PAGE_SIZE)
    },
    enabled: tab === 'findings',
  })
  const findings = findingsData || []
  const queryClient = useQueryClient()
  const { addToast } = useToastStore()

  const pauseMutation = useMutation({
    mutationFn: async () => await api.post(`/vapt/campaigns/${id}/pause`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['campaign', id] }); addToast({ type: 'info', title: 'Paused' }) }
  })
  const resumeMutation = useMutation({
    mutationFn: async () => await api.post(`/vapt/campaigns/${id}/resume`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['campaign', id] }); addToast({ type: 'success', title: 'Resumed' }) }
  })
  const cancelMutation = useMutation({
    mutationFn: async () => await api.post(`/vapt/campaigns/${id}/cancel`, { reason: 'User action' }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['campaign', id] }); addToast({ type: 'info', title: 'Cancelled' }) }
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!campaign) {
    return <div className="text-center py-12 text-muted-foreground">Campaign not found.</div>
  }

  const c: any = campaign
  const steps: any[] = c.steps || []

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/vapt" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-5 w-5" /></Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">Campaign #{id}</h1>
            <StatusBadge status={c.status} />
          </div>
          <p className="text-sm text-muted-foreground">{c.current_phase || '—'}</p>
        </div>
        <div className="flex gap-2">
          {c.status === 'active' && <button onClick={() => pauseMutation.mutate()} className="flex items-center gap-1 text-sm px-2 py-1 border rounded"><Pause className="h-4 w-4" /> Pause</button>}
          {c.status === 'paused' && <button onClick={() => resumeMutation.mutate()} className="flex items-center gap-1 text-sm px-2 py-1 border rounded"><Play className="h-4 w-4" /> Resume</button>}
          {(c.status === 'active' || c.status === 'paused' || c.status === 'draft') && <button onClick={() => cancelMutation.mutate()} className="flex items-center gap-1 text-sm px-2 py-1 border rounded text-destructive"><XCircle className="h-4 w-4" /> Cancel</button>}
        </div>
      </div>

      <SubPageNav items={[{ label: 'All Campaigns', to: '/vapt' }, { label: `Campaign #${id}`, to: `/vapt/${id}` }]} />

      {/* Step Progress */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {steps.map((s: any, i: number) => (
              <div key={i} className="flex items-center gap-2 shrink-0">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${s.status === 'completed' ? 'bg-green-100 text-green-700' : s.status === 'running' ? 'bg-brand-100 text-brand-700 animate-pulse' : s.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-muted text-muted-foreground'}`}>
                  {i + 1}
                </div>
                <div className={i < steps.length - 1 ? 'mr-2' : ''}>
                  <p className="text-xs font-medium whitespace-nowrap">{s.name || `Step ${i + 1}`}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">{s.status}</p>
                </div>
                {i < steps.length - 1 && <div className="h-px w-6 bg-border" />}
              </div>
            ))}
          </div>
          {c.procedure_key && <p className="text-xs mt-2 text-muted-foreground">Procedure: {c.procedure_key}</p>}
        </CardContent>
      </Card>

      {/* Approvals */}
      {approvals.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="font-medium mb-2">Pending Approvals</h3>
            {approvals.map((a: any) => (
              <div key={a.id} className="text-sm border p-2 rounded mb-1">Approval #{a.id} — {a.status || 'pending'}</div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        <button
          onClick={() => setTab('correlations')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'correlations' ? 'border-brand-700 text-brand-700' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          Correlated Findings ({Array.isArray(correlations) ? correlations.length : 0})
        </button>
        <button
          onClick={() => setTab('findings')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'findings' ? 'border-brand-700 text-brand-700' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          Raw Findings ({Array.isArray(findings) ? findings.length : 0})
        </button>
      </div>

      {tab === 'correlations' ? (
        <Card>
          <CardContent className="p-0 divide-y">
            {!Array.isArray(correlations) || correlations.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground text-center">No correlated findings yet.</p>
            ) : (
              <>
                {correlations.map((f: any) => (
                  <div key={f.id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm">{f.title}</p>
                      <SeverityBadge severity={f.severity} />
                    </div>
                    <p className="text-xs text-muted-foreground">{f.description}</p>
                    <div className="flex gap-2 text-xs text-muted-foreground">
                      <span className="bg-muted px-1.5 py-0.5 rounded">{f.correlation_type}</span>
                      {f.requires_human_review && <span className="bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">Requires review</span>}
                      {f.attack_path && (
                        <button onClick={() => setExpandedFinding(expandedFinding === f.id ? null : f.id)} className="text-brand-700 hover:underline">
                          {expandedFinding === f.id ? 'Hide attack path' : 'Show attack path'}
                        </button>
                      )}
                    </div>
                    {expandedFinding === f.id && f.attack_path && (
                      <div className="rounded-lg bg-muted p-3 text-xs space-y-2">
                        <p className="font-medium text-muted-foreground">Rule: {f.attack_path.rule_key}</p>
                        {f.attack_path.steps.map((s: any, i: number) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className="h-5 w-5 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-bold">{i + 1}</span>
                            <span>{s.title}</span>
                            <SeverityBadge severity={s.severity} />
                          </div>
                        ))}
                        <p className="text-muted-foreground mt-1">{f.attack_path.risk_summary}</p>
                      </div>
                    )}
                  </div>
                ))}
                <Pagination
                  total={correlations.length === PAGE_SIZE ? corrOffset + PAGE_SIZE + 1 : corrOffset + correlations.length}
                  offset={corrOffset}
                  limit={PAGE_SIZE}
                  onChange={setCorrOffset}
                />
              </>
            )}
          </CardContent>
         </Card>
       ) : (
        <Card>
          <CardContent className="p-0 divide-y">
            {!Array.isArray(findings) || findings.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground text-center">No raw findings for this campaign.</p>
            ) : (
              <>
                 {findings.map((r: any) => (
                   <div key={r.id} className="p-4">
                     <div className="flex items-center justify-between">
                       <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setExpandedRaw(expandedRaw === r.id ? null : r.id)}>
                         <p className="text-sm font-medium">{r.title}</p>
                         <p className="text-xs text-muted-foreground">{r.tool}</p>
                       </div>
                       <div className="flex items-center gap-2">
                         <SeverityBadge severity={r.severity} />
                         {expandedRaw === r.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                       </div>
                     </div>
                     {expandedRaw === r.id && (
                       <div className="mt-2 pl-1">
                         <ScanEvidence result={r} />
                       </div>
                     )}
                   </div>
                 ))}
                <Pagination
                  total={findings.length === PAGE_SIZE ? findingsOffset + PAGE_SIZE + 1 : findingsOffset + findings.length}
                  offset={findingsOffset}
                  limit={PAGE_SIZE}
                  onChange={setFindingsOffset}
                />
              </>
            )}
          </CardContent>
         </Card>
       )}
     </div>
   )
 }

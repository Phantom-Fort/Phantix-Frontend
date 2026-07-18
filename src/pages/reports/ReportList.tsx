import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { DataTable } from '@/components/shared/DataTable'
import { JsonViewer } from '@/components/shared/JsonViewer'
import { useToastStore } from '@/store/toast'
import { FileText, Loader2, Plus, X, FileDown, Eye, RefreshCw, Download, BarChart3, Search, Calendar, Code, File, Table } from 'lucide-react'
import { SubPageNav } from '@/components/shared/SubPageNav'

const REPORT_TYPES = [
  { value: 'vapt_campaign', label: 'VAPT Campaign', desc: 'Detailed findings, evidence and remediation guidance from a security assessment' },
  { value: 'executive', label: 'Executive Summary', desc: 'High-level risk overview for leadership and stakeholders' },
  { value: 'compliance', label: 'Compliance', desc: 'Gap analysis and control mapping against frameworks' },
  { value: 'ad_hoc', label: 'Ad Hoc', desc: 'Custom one-off report on selected data' },
  { value: 'tracker', label: 'Remediation Tracker', desc: 'Current state of tracked findings across campaigns' },
]

const FORMATS = [
  { value: 'markdown', label: 'Markdown', icon: FileText },
  { value: 'json', label: 'JSON', icon: Code },
  { value: 'csv', label: 'CSV', icon: Table },
  { value: 'xlsx', label: 'Excel', icon: Table },
  { value: 'pdf', label: 'PDF', icon: File },
  { value: 'docx', label: 'Word', icon: File },
]

const EXPORT_SOURCES = ['risks', 'audit', 'vapt_findings', 'tracker', 'compliance']
const EXPORT_FORMATS = ['json', 'csv']

const PAGE_SIZE = 30

export function ReportList() {
  const queryClient = useQueryClient()
  const [showGenerate, setShowGenerate] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [previewId, setPreviewId] = useState<number | null>(null)
  const [previewMarkdown, setPreviewMarkdown] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [offset, setOffset] = useState(0)

  // Generate form state
  const [genForm, setGenForm] = useState({
    report_type: 'vapt_campaign',
    campaign_id: null as number | null,
    title: '',
    formats: ['markdown', 'pdf'] as string[],
    run_inline: false,
  })

  // Ad-hoc export form
  const [expForm, setExpForm] = useState({ source: 'vapt_findings', format: 'json', campaign_id: null as number | null })

  const [pollId, setPollId] = useState<number | null>(null)

  const { addToast } = useToastStore()

  // Reports list (with server-side type filter)
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'list', filterType, offset],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) })
      if (filterType) params.set('report_type', filterType)
      const { data } = await api.get(`/reports?${params}`)
      return data as { items: any[]; total: number }
    },
    refetchInterval: pollId ? 3000 : false,
  })

  const reports = data?.items ?? []
  const total = data?.total ?? 0

  // Stats (broad fetch for KPIs)
  const statsQuery = useQuery({
    queryKey: ['reports', 'stats'],
    queryFn: async () => {
      const { data } = await api.get('/reports?limit=200&offset=0')
      const items: any[] = data?.items || []
      return {
        total: data?.total || items.length,
        complete: items.filter((r) => r.status === 'complete').length,
        generating: items.filter((r) => ['pending', 'generating', 'queued'].includes(r.status)).length,
        failed: items.filter((r) => r.status === 'failed').length,
      }
    },
    refetchInterval: 15000,
  })
  const stats = statsQuery.data || { total: 0, complete: 0, generating: 0, failed: 0 }

  // Engine health
  const engineQuery = useQuery({
    queryKey: ['engines', 'reporting'],
    queryFn: async () => {
      try {
        const { data } = await api.get('/engines/reporting/status')
        return data || { status: 'ok' }
      } catch {
        return { status: 'unknown' }
      }
    },
    refetchInterval: 30000,
  })

  // Campaigns for linking
  const { data: campaigns = [] } = useQuery({
    queryKey: ['campaigns', 'for-reports'],
    queryFn: async () => {
      const { data } = await api.get('/vapt/campaigns?limit=100')
      return data?.items || []
    },
  })

  // Full report detail for preview
  const { data: reportDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['reports', 'detail', previewId],
    queryFn: async () => {
      const { data } = await api.get(`/reports/${previewId}`)
      return data
    },
    enabled: !!previewId,
  })

  useEffect(() => {
    if (reportDetail?.error_message) {
      addToast({ type: 'error', title: 'Report generation failed', message: reportDetail.error_message })
    }
  }, [reportDetail?.id, reportDetail?.error_message])

  // Filtered client side (search + status)
  const filtered = reports.filter((r: any) => {
    const matchesSearch = !search || (r.title || '').toLowerCase().includes(search.toLowerCase()) || String(r.id).includes(search)
    const matchesStatus = !filterStatus || r.status === filterStatus
    return matchesSearch && matchesStatus
  })

  useEffect(() => {
    if (!pollId) return
    const report = reports.find((r: any) => r.id === pollId)
    if (!report) return
    if (report.status === 'complete') {
      addToast({ type: 'success', title: 'Report ready', message: `${report.title || `Report #${pollId}`} is ready.` })
      setPollId(null)
      // auto open preview for newly completed
      setPreviewId(pollId)
    } else if (report.status === 'failed') {
      addToast({ type: 'error', title: 'Report failed', message: report.error_message || `Report #${pollId} failed.` })
      setPollId(null)
    }
  }, [reports, pollId])

  // Generate report
  const generateMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        report_type: genForm.report_type,
        formats: genForm.formats,
        run_inline: genForm.run_inline,
        title: genForm.title || `Report ${new Date().toISOString().slice(0, 10)}`,
      }
      if (genForm.campaign_id) payload.campaign_id = genForm.campaign_id
      const { data } = await api.post('/reports', payload)
      return data as { id: number; status: string }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      queryClient.invalidateQueries({ queryKey: ['reports', 'stats'] })
      setPollId(data.id)
      setShowGenerate(false)
      // reset form partially
      setGenForm((f) => ({ ...f, title: '', campaign_id: null }))
      addToast({ type: 'success', title: 'Report generation started' })
    },
    onError: () => {
      addToast({ type: 'error', title: 'Failed to start report generation' })
    },
  })

  // Ad-hoc export
  const exportMutation = useMutation({
    mutationFn: async () => {
      const payload: any = { source: expForm.source, format: expForm.format }
      if (expForm.campaign_id) payload.campaign_id = expForm.campaign_id
      const response = await api.post('/reports/export', payload, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `export_${expForm.source}.${expForm.format}`
      a.click()
      window.URL.revokeObjectURL(url)
      return true
    },
    onSuccess: () => {
      addToast({ type: 'success', title: 'Export complete', message: 'Ad-hoc export downloaded.' })
      setShowExport(false)
    },
    onError: () => addToast({ type: 'error', title: 'Export failed' }),
  })

  const downloadReport = async (id: number, format: string, baseName?: string) => {
    try {
      const response = await api.get(`/reports/${id}/download`, { params: { format }, responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const a = document.createElement('a')
      a.href = url
      const ext = format === 'markdown' ? 'md' : format
      a.download = `${baseName || `report_${id}`}.${ext}`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch {
      addToast({ type: 'error', title: 'Download failed' })
    }
  }

  const loadMarkdownPreview = async (id: number) => {
    try {
      const response = await api.get(`/reports/${id}/download`, { params: { format: 'markdown' }, responseType: 'text' })
      setPreviewMarkdown(response.data)
    } catch {
      addToast({ type: 'error', title: 'Could not load markdown preview' })
    }
  }

  const closePreview = () => {
    setPreviewId(null)
    setPreviewMarkdown(null)
  }

  const openGenerate = (prefill?: any) => {
    if (prefill) setGenForm((f) => ({ ...f, ...prefill }))
    setShowGenerate(true)
    setShowExport(false)
  }

  const toggleGenFormat = (fmt: string) => {
    setGenForm((prev) => ({
      ...prev,
      formats: prev.formats.includes(fmt) ? prev.formats.filter((f) => f !== fmt) : [...prev.formats, fmt],
    }))
  }

  const regenerate = (r: any) => {
    const prefill = {
      report_type: r.report_type,
      campaign_id: r.campaign_id || null,
      title: `${r.title} (v${(r.report_version || 1) + 1})`,
      formats: r.formats_requested || ['markdown', 'pdf'],
      run_inline: false,
    }
    openGenerate(prefill)
    closePreview()
  }

  // Report cards renderer
  const ReportCard = ({ r }: { r: any }) => (
    <Card className="hover:shadow-md transition-shadow group">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <button onClick={() => setPreviewId(r.id)} className="font-semibold text-foreground hover:text-brand-700 text-left line-clamp-2">
              {r.title || `Report #${r.id}`}
            </button>
            <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
              <Calendar className="h-3 w-3" /> {new Date(r.created_at).toLocaleDateString()} · v{r.report_version || 1}
            </div>
          </div>
          <StatusBadge status={r.status} pulse={['generating', 'pending'].includes(r.status)} />
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="rounded bg-muted px-2 py-0.5 text-muted-foreground">{r.report_type?.replace(/_/g, ' ')}</span>
          {r.campaign_id && <span className="rounded bg-muted px-2 py-0.5 text-muted-foreground">Campaign #{r.campaign_id}</span>}
        </div>

        {r.status === 'complete' && r.output_files && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {Object.keys(r.output_files).filter((k) => !k.endsWith('_error')).map((fmt) => (
              <button
                key={fmt}
                onClick={() => downloadReport(r.id, fmt, `${r.report_type}_${r.id}`)}
                className="inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] hover:bg-muted"
                title={`Download ${fmt}`}
              >
                <FileDown className="h-3 w-3" /> {fmt}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 pt-1 border-t">
          <Button size="sm" variant="outline" onClick={() => setPreviewId(r.id)} className="flex-1">
            <Eye className="mr-1 h-3 w-3" /> Preview
          </Button>
          <Button size="sm" variant="ghost" onClick={() => regenerate(r)}>
            <RefreshCw className="mr-1 h-3 w-3" /> Regenerate
          </Button>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            Reports <BarChart3 className="h-5 w-5 text-brand-700" />
          </h1>
          <p className="text-muted-foreground">Full report engine — generate, preview, download, and track remediation</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowExport(!showExport)}>
            <Download className="mr-1 h-4 w-4" /> Ad-hoc Export
          </Button>
          <Button onClick={() => openGenerate()}>
            <Plus className="mr-1 h-4 w-4" /> Generate Report
          </Button>
        </div>
      </div>

      <SubPageNav items={[{ label: 'Reports', to: '/reports' }, { label: 'Tracker', to: '/tracker' }]} />

      {/* Engine status + KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Reporting Engine</div>
            <div className="mt-1 flex items-center gap-2">
              <span className={`inline-block h-2 w-2 rounded-full ${engineQuery.data?.status === 'ok' ? 'bg-green-500' : 'bg-yellow-500'}`} />
              <span className="text-sm font-medium">{engineQuery.data?.status || 'checking…'}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Total Reports</div>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Completed</div>
            <div className="text-2xl font-bold text-green-600">{stats.complete}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Generating / Queued</div>
            <div className="text-2xl font-bold text-amber-600">{stats.generating}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Failed</div>
            <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
          </CardContent>
        </Card>
      </div>

      {/* Live generating banner */}
      {pollId && (
        <Card className="border-brand-300 bg-brand-50/50 dark:bg-brand-900/20">
          <CardContent className="p-3 flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin text-brand-700" />
            <span>Report #{pollId} is being generated…</span>
            <button onClick={() => setPollId(null)} className="ml-auto text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </CardContent>
        </Card>
      )}

      {/* Filters & Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-64">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search reports or ID..." className="pl-9 h-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <select
          className="h-9 rounded-md border bg-background text-foreground px-3 text-sm"
          value={filterType}
          onChange={(e) => { setFilterType(e.target.value); setOffset(0) }}
        >
          <option value="">All Types</option>
          {REPORT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>

        <select className="h-9 rounded-md border bg-background text-foreground px-3 text-sm" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="complete">Complete</option>
          <option value="generating">Generating</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>

        <div className="ml-auto flex items-center gap-2">
          <div className="text-xs text-muted-foreground hidden sm:block">{filtered.length} shown · {total} total</div>
          <Button variant={viewMode === 'table' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('table')}>Table</Button>
          <Button variant={viewMode === 'cards' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('cards')}>Cards</Button>
          <Button variant="ghost" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['reports'] })}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Data View */}
      {viewMode === 'table' ? (
        <DataTable
          columns={[
            { key: 'report', label: 'Report', width: '2.5fr', render: (r: any) => (
              <button onClick={() => setPreviewId(r.id)} className="text-left hover:text-brand-700 min-w-0">
                <div className="font-medium truncate">{r.title || `Report #${r.id}`}</div>
                <div className="text-[11px] text-muted-foreground">{new Date(r.created_at).toLocaleString()}</div>
              </button>
            )},
            { key: 'type', label: 'Type', width: '140px', render: (r: any) => (
              <span className="inline-flex items-center gap-1 text-xs rounded bg-muted px-2 py-0.5">{r.report_type?.replace(/_/g, ' ')}</span>
            )},
            { key: 'campaign', label: 'Campaign', width: '100px', render: (r: any) => r.campaign_id ? <span className="text-xs text-muted-foreground">#{r.campaign_id}</span> : <span className="text-muted-foreground">—</span> },
            { key: 'version', label: 'Ver', width: '60px', render: (r: any) => <span className="text-xs text-muted-foreground">v{r.report_version || 1}</span> },
            { key: 'status', label: 'Status', width: '110px', render: (r: any) => <StatusBadge status={r.status} pulse={['generating','pending'].includes(r.status)} /> },
            { key: 'actions', label: 'Actions', width: '200px', render: (r: any) => (
              <div className="flex items-center gap-1">
                <Button size="sm" variant="outline" onClick={() => setPreviewId(r.id)}><Eye className="h-3 w-3 mr-1" /> View</Button>
                {r.status === 'complete' && r.output_files && Object.keys(r.output_files).filter((k:string) => !k.endsWith('_error')).slice(0, 3).map((fmt: string) => (
                  <button key={fmt} onClick={() => downloadReport(r.id, fmt, `${r.report_type}_${r.id}`)} className="p-1 hover:text-brand-700" title={fmt}>
                    <FileDown className="h-3.5 w-3.5" />
                  </button>
                ))}
                <Button size="sm" variant="ghost" onClick={() => regenerate(r)}><RefreshCw className="h-3 w-3" /></Button>
              </div>
            )},
          ]}
          data={filtered}
          total={total}
          offset={offset}
          limit={PAGE_SIZE}
          isLoading={isLoading}
          isEmpty={filtered.length === 0}
          emptyIcon={FileText}
          emptyTitle={search || filterType || filterStatus ? 'No matching reports' : 'No reports yet'}
          emptyDescription="Use the Generate button to create your first report from the engine."
          onPageChange={setOffset}
          keyExtractor={(r: any) => r.id}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.length === 0 ? (
            <div className="col-span-full text-center py-12 text-sm text-muted-foreground">
              <FileText className="mx-auto mb-2 h-8 w-8 opacity-40" />
              No reports match your filters.
            </div>
          ) : (
            filtered.map((r: any) => <ReportCard key={r.id} r={r} />)
          )}
        </div>
      )}

      {/* Ad-hoc Export Panel */}
      {showExport && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Download className="h-4 w-4" /> Ad-hoc Export</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="text-xs font-medium mb-1 block">Source</label>
              <select className="w-full h-9 rounded border bg-background text-foreground px-3 text-sm" value={expForm.source} onChange={(e) => setExpForm({ ...expForm, source: e.target.value })}>
                {EXPORT_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Format</label>
              <select className="w-full h-9 rounded border bg-background text-foreground px-3 text-sm" value={expForm.format} onChange={(e) => setExpForm({ ...expForm, format: e.target.value })}>
                {EXPORT_FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Campaign (optional)</label>
              <select className="w-full h-9 rounded border bg-background text-foreground px-3 text-sm" value={expForm.campaign_id || ''} onChange={(e) => setExpForm({ ...expForm, campaign_id: e.target.value ? Number(e.target.value) : null })}>
                <option value="">Any / All</option>
                {campaigns.map((c: any) => <option key={c.id} value={c.id}>#{c.id} — {c.campaign_name || 'Unnamed'}</option>)}
              </select>
            </div>
            <div className="flex items-end">
              <Button onClick={() => exportMutation.mutate()} disabled={exportMutation.isPending} className="w-full">
                {exportMutation.isPending ? 'Exporting…' : 'Export Now'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generate Modal */}
      {showGenerate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowGenerate(false)}>
          <div className="w-full max-w-2xl rounded-xl bg-background border shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <div className="font-semibold flex items-center gap-2"><Plus className="h-4 w-4" /> Generate New Report</div>
              <button onClick={() => setShowGenerate(false)}><X className="h-5 w-5" /></button>
            </div>

            <div className="p-5 space-y-5">
              <div>
                <label className="text-xs font-semibold tracking-wider text-muted-foreground">REPORT TYPE</label>
                <select
                  className="mt-1 w-full h-10 rounded-md border bg-background text-foreground px-3"
                  value={genForm.report_type}
                  onChange={(e) => {
                    const val = e.target.value
                    setGenForm((f) => ({ ...f, report_type: val, campaign_id: ['vapt_campaign', 'tracker'].includes(val) ? f.campaign_id : null }))
                  }}
                >
                  {REPORT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <p className="text-xs text-muted-foreground mt-1">{REPORT_TYPES.find((t) => t.value === genForm.report_type)?.desc}</p>
              </div>

              {['vapt_campaign', 'tracker', 'ad_hoc'].includes(genForm.report_type) && (
                <div>
                  <label className="text-xs font-semibold tracking-wider text-muted-foreground">LINK TO CAMPAIGN (OPTIONAL)</label>
                  <select
                    className="mt-1 w-full h-10 rounded-md border bg-background text-foreground px-3"
                    value={genForm.campaign_id ?? ''}
                    onChange={(e) => setGenForm((f) => ({ ...f, campaign_id: e.target.value ? Number(e.target.value) : null }))}
                  >
                    <option value="">No specific campaign</option>
                    {campaigns.map((c: any) => (
                      <option key={c.id} value={c.id}>#{c.id} — {c.campaign_name || c.current_phase || 'Campaign'}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold tracking-wider text-muted-foreground">TITLE</label>
                <Input
                  className="mt-1"
                  placeholder="e.g. Q3 External Pentest — Executive Summary"
                  value={genForm.title}
                  onChange={(e) => setGenForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>

              <div>
                <label className="text-xs font-semibold tracking-wider text-muted-foreground mb-1 block">OUTPUT FORMATS</label>
                <div className="flex flex-wrap gap-2">
                  {FORMATS.map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => toggleGenFormat(value)}
                      className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition ${genForm.formats.includes(value) ? 'bg-brand-700 text-white border-brand-700' : 'hover:bg-muted'}`}
                    >
                      <Icon className="h-3.5 w-3.5" /> {label}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">Select at least one. Markdown + PDF recommended for most use cases.</p>
              </div>

              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={genForm.run_inline}
                  onChange={(e) => setGenForm((f) => ({ ...f, run_inline: e.target.checked }))}
                />
                Run inline (faster for small reports, blocks until finished)
              </label>

            </div>

            <div className="flex gap-2 p-4 border-t">
              <Button variant="outline" className="flex-1" onClick={() => setShowGenerate(false)}>Cancel</Button>
              <Button className="flex-1" disabled={genForm.formats.length === 0 || generateMutation.isPending} onClick={() => generateMutation.mutate()}>
                {generateMutation.isPending ? 'Starting generation…' : 'Generate Report'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Rich Preview Modal */}
      {previewId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-3" onClick={closePreview}>
          <div className="w-full max-w-5xl max-h-[92vh] overflow-hidden rounded-2xl bg-background border shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Modal header */}
            <div className="flex items-center justify-between border-b px-5 py-3">
              <div>
                <div className="font-semibold text-lg flex items-center gap-2">
                  {reportDetail?.title || `Report #${previewId}`}
                  {reportDetail && <StatusBadge status={reportDetail.status} pulse={reportDetail.status === 'generating'} />}
                </div>
                <div className="text-xs text-muted-foreground">
                  {reportDetail?.report_type} · v{reportDetail?.report_version || 1} · {reportDetail?.generated_at ? new Date(reportDetail.generated_at).toLocaleString() : ''}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {reportDetail?.status === 'complete' && <Button size="sm" variant="outline" onClick={() => regenerate(reportDetail)}>Regenerate</Button>}
                <button onClick={closePreview} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-5 space-y-6">
              {detailLoading && <div className="text-sm text-muted-foreground">Loading report details…</div>}

              {!detailLoading && reportDetail && (
                <>
                  {/* Downloads */}
                  <div>
                    <div className="text-sm font-semibold mb-2">Downloads</div>
                    <div className="flex flex-wrap gap-2">
                      {reportDetail.output_files && Object.keys(reportDetail.output_files).filter((k: string) => !k.endsWith('_error')).length > 0 ? (
                        Object.keys(reportDetail.output_files).filter((k: string) => !k.endsWith('_error')).map((fmt: string) => (
                          <Button key={fmt} variant="outline" onClick={() => downloadReport(previewId, fmt, reportDetail.title || `report_${previewId}`)}>
                            <FileDown className="mr-2 h-4 w-4" /> {fmt.toUpperCase()}
                          </Button>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">No files available yet.</span>
                      )}
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div><span className="text-muted-foreground">Campaign:</span> {reportDetail.campaign_id ? `#${reportDetail.campaign_id}` : '—'}</div>
                    <div><span className="text-muted-foreground">Requested formats:</span> {(reportDetail.formats_requested || []).join(', ') || '—'}</div>
                    <div><span className="text-muted-foreground">Generated:</span> {reportDetail.generated_at ? new Date(reportDetail.generated_at).toLocaleString() : '—'}</div>
                    <div><span className="text-muted-foreground">Updated:</span> {reportDetail.updated_at ? new Date(reportDetail.updated_at).toLocaleString() : '—'}</div>
                  </div>

                  {/* Markdown preview controls */}
                  {reportDetail.output_files?.markdown && (
                    <div>
                      <Button size="sm" variant="outline" onClick={() => loadMarkdownPreview(previewId)}>
                        <Eye className="mr-2 h-4 w-4" /> Load Markdown Preview
                      </Button>
                      {previewMarkdown && (
                        <div className="mt-3 rounded-lg border bg-muted/40 p-4 max-h-[380px] overflow-auto">
                          <pre className="whitespace-pre-wrap text-sm font-mono leading-relaxed">{previewMarkdown}</pre>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Sections */}
                  {reportDetail.sections && (
                    <div>
                      <div className="text-sm font-semibold mb-2">Report Sections</div>
                      <JsonViewer data={reportDetail.sections} collapsed={false} maxHeight={360} />
                    </div>
                  )}

                  {/* AI Narratives */}
                  {reportDetail.ai_narratives && (
                    <div>
                      <div className="text-sm font-semibold mb-2">AI Narratives</div>
                      <JsonViewer data={reportDetail.ai_narratives} collapsed maxHeight={280} />
                    </div>
                  )}


                </>
              )}
            </div>

            <div className="border-t p-3 flex justify-end gap-2">
              <Button variant="outline" onClick={closePreview}>Close</Button>
              {reportDetail && <Button onClick={() => regenerate(reportDetail)}>Regenerate Report</Button>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

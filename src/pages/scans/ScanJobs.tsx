import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { DataTable } from '@/components/shared/DataTable'
import { SubPageNav } from '@/components/shared/SubPageNav'
import { Play, Loader2, AlertTriangle, BookOpen } from 'lucide-react'

const SCAN_TOOLS = ['network_scan', 'dns_scan', 'vuln_scan', 'nmap', 'nuclei', 'web']
const ASSET_TYPES = ['domain', 'subdomain', 'web_app', 'ip_address', 'api_endpoint', 'cloud_account']

export function ScanJobs() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [showCatalog, setShowCatalog] = useState(false)
  const [selectedTools, setSelectedTools] = useState<string[]>(['network_scan'])
  const [selectedAssetTypes, setSelectedAssetTypes] = useState<string[]>(['domain', 'subdomain', 'web_app', 'ip_address'])
  const [offset, setOffset] = useState(0)
  const PAGE_SIZE = 30

  const { data: catalog } = useQuery({
    queryKey: ['scans', 'yaml', 'catalog'],
    queryFn: async () => {
      const { data } = await api.get('/scans/yaml/catalog')
      return data
    },
  })

  const { data: jobsResp, isLoading } = useQuery({
    queryKey: ['scans', 'jobs', offset],
    queryFn: async () => {
      const { data } = await api.get(`/scans/jobs?limit=${PAGE_SIZE}&offset=${offset}`)
      const items = Array.isArray(data) ? data : data?.items || data?.jobs || []
      const total = data?.total ?? (items.length < PAGE_SIZE ? offset + items.length : offset + PAGE_SIZE + 1)
      return { items, total }
    },
    refetchInterval: 5000,
  })
  const jobs = jobsResp?.items || []
  const total = jobsResp?.total || jobs.length

  const { data: activeJob } = useQuery({
    queryKey: ['scans', 'jobs', 'active'],
    queryFn: async () => {
      const { data } = await api.get('/scans/jobs/active')
      return data
    },
    refetchInterval: 3000,
  })

  const createJob = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/scans/jobs', {
        job_type: 'vulnerability_scan',
        tools: selectedTools,
        target_filter: { asset_types: selectedAssetTypes.length ? selectedAssetTypes : undefined },
        run_inline: false,
      })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scans'] })
      setShowForm(false)
    },
  })

  const runJob = useMutation({
    mutationFn: async (jobId: number) => {
      const { data } = await api.post(`/scans/jobs/${jobId}/run`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scans'] })
    },
  })

  const hasActive = jobs.some((j: any) => j.status === 'running' || j.status === 'pending') || !!activeJob

  const toggleTool = (tool: string) => {
    setSelectedTools((prev) =>
      prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool],
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Scanner Jobs</h1>
          <p className="text-muted-foreground">On-demand vulnerability scanning</p>
        </div>
        <div className="flex items-center gap-2">
           {activeJob && (
             <Link to={`/scans/results?job=${activeJob.id}`} className="flex items-center gap-1 text-xs text-brand-700 bg-brand-50 dark:bg-brand-900/30 px-2 py-0.5 rounded hover:underline">
               <Loader2 className="h-3 w-3 animate-spin" /> Active: Job #{activeJob.id} ({activeJob.status})
             </Link>
           )}
           {hasActive && !activeJob && <span className="flex items-center gap-1 text-xs text-brand-700"><Loader2 className="h-3 w-3 animate-spin" /> Live</span>}
           <Button variant="outline" onClick={() => setShowCatalog(!showCatalog)}>
             <BookOpen className="mr-1 h-4 w-4" /> Catalog
           </Button>
           <Button onClick={() => setShowForm(!showForm)} disabled={hasActive}>
             <Play className="mr-1 h-4 w-4" /> New Scan
           </Button>
         </div>
      </div>

      <SubPageNav items={[{ label: 'Jobs', to: '/scans' }, { label: 'Results', to: '/scans/results' }]} />

      {showForm && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <h3 className="font-semibold text-sm">Start Vulnerability Scan</h3>
            <p className="text-xs text-muted-foreground">Select tools to run. One active scan per organization.</p>
            <div className="flex flex-wrap gap-2">
              {SCAN_TOOLS.map((tool) => (
                <button
                  key={tool}
                  onClick={() => toggleTool(tool)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${selectedTools.includes(tool) ? 'bg-brand-700 text-white' : 'bg-muted text-muted-foreground hover:bg-accent'}`}
                >
                  {tool.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Target asset types (optional)</p>
              <div className="flex flex-wrap gap-2">
                {ASSET_TYPES.map((at) => (
                  <button
                    key={at}
                    onClick={() => setSelectedAssetTypes((prev) => prev.includes(at) ? prev.filter(a => a !== at) : [...prev, at])}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${selectedAssetTypes.includes(at) ? 'bg-brand-700 text-white' : 'bg-muted text-muted-foreground hover:bg-accent'}`}
                  >
                    {at}
                  </button>
                ))}
              </div>
            </div>
            {createJob.isError && <p className="text-xs text-destructive">{(createJob.error as any)?.response?.data?.detail || 'Failed to start scan.'}</p>}
            <Button onClick={() => createJob.mutate()} disabled={selectedTools.length === 0 || createJob.isPending}>
              {createJob.isPending ? 'Starting...' : 'Start Scan'}
            </Button>
          </CardContent>
        </Card>
      )}

      {showCatalog && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <h3 className="font-semibold text-sm">YAML Scan Catalog</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <p className="font-medium mb-1">Tools</p>
                <div className="space-y-1">
                  {Object.entries(catalog?.tools || {}).map(([k, v]) => (
                    <div key={k} className="flex justify-between border-b pb-0.5"><span>{k}</span><span className="text-muted-foreground">{String(v)}</span></div>
                  ))}
                </div>
              </div>
              <div>
                <p className="font-medium mb-1">Checks ({catalog?.total_checks || 0})</p>
                <div className="max-h-48 overflow-auto text-[10px] bg-muted/30 p-2 rounded">
                  {Object.entries(catalog?.scans || {}).slice(0, 8).map(([cat, checks]: any) => (
                    <div key={cat}><span className="font-mono">{cat}</span>: {(checks || []).length} checks</div>
                  ))}
                  {Object.keys(catalog?.scans || {}).length > 8 && <div className="text-muted-foreground">... and more</div>}
                </div>
                {catalog?.correlation_rules && <p className="mt-2 text-muted-foreground">Correlation rules: {Object.keys(catalog.correlation_rules).length}</p>}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <DataTable
        columns={[
          { key: 'job', label: 'Job', width: '2fr', render: (j: any) => (
            <div>
              <p className="font-medium">Scan Job #{j.id}</p>
              <p className="text-xs text-muted-foreground">{j.job_type} · {j.created_at ? new Date(j.created_at).toLocaleDateString() : ''}</p>
            </div>
          )},
          { key: 'tools', label: 'Tools', width: '2fr', render: (j: any) => (
            <div className="flex gap-1 flex-wrap">
              {(j.tools || []).map((t: string) => (
                <span key={t} className="text-xs bg-muted px-1.5 py-0.5 rounded">{t.replace(/_/g, ' ')}</span>
              ))}
            </div>
          )},
          { key: 'status', label: 'Status', width: '120px', render: (j: any) => <StatusBadge status={j.status} pulse={j.status === 'running'} /> },
          { key: 'timing', label: 'Timing', width: '1fr', render: (j: any) => (
            <div className="text-xs text-muted-foreground">
              {j.started_at && <div>Started: {new Date(j.started_at).toLocaleTimeString()}</div>}
              {j.completed_at && <div>Done: {new Date(j.completed_at).toLocaleTimeString()}</div>}
              {j.error_message && <div className="text-red-600 truncate">{j.error_message}</div>}
            </div>
          )},
          { key: 'actions', label: '', width: '120px', render: (j: any) => (
            <div className="flex gap-1">
              {j.status === 'pending' && (
                <Button size="sm" variant="outline" onClick={() => runJob.mutate(j.id)} disabled={runJob.isPending}>
                  Run
                </Button>
              )}
              <Link to={`/scans/results?job=${j.id}`} className="text-xs text-brand-700 hover:underline px-2 py-1">Results</Link>
            </div>
          )},
        ]}
        data={jobs}
        total={total}
        offset={offset}
        limit={PAGE_SIZE}
        isLoading={isLoading}
        isEmpty={jobs.length === 0}
        emptyIcon={AlertTriangle}
        emptyTitle="No scan jobs yet"
        emptyDescription="Run a scan to discover vulnerabilities across your assets."
        onPageChange={setOffset}
        keyExtractor={(j: any) => j.id}
      />
    </div>
  )
}

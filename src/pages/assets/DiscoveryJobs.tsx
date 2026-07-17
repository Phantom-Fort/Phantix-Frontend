import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { DataTable } from '@/components/shared/DataTable'
import { usePolling } from '@/hooks/usePolling'
import { formatRelativeTime, normalizeEnum } from '@/lib/format'
import { Play, Loader2, Globe, X } from 'lucide-react'
import { SubPageNav } from '@/components/shared/SubPageNav'

const JOB_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'domain_enum', label: 'Domain Enum' },
  { value: 'subdomain_enum', label: 'Subdomain' },
  { value: 'dns_enrich', label: 'DNS Enrich' },
  { value: 'nmap', label: 'Nmap' },
]

export function DiscoveryJobs() {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [domain, setDomain] = useState('')
  const [offset, setOffset] = useState(0)
  const PAGE_SIZE = 30

  const { data: jobsData, isLoading } = usePolling<{items: any[]; total?: number} | any[]>(
    ['discovery', 'jobs', filter, String(offset)],
    async () => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) })
      if (filter) params.set('job_type', filter)
      const { data } = await api.get(`/assets/discovery/jobs?${params}`)
      const items = Array.isArray(data) ? data : data?.items || data?.jobs || []
      const total = data?.total ?? (items.length < PAGE_SIZE ? offset + items.length : undefined)
      return { items, total }
    },
    { interval: 5000, stopCondition: (d: any) => !d?.items?.some((j: any) => j.status === 'running' || j.status === 'pending') },
  )

  const jobs = (jobsData as any)?.items || (Array.isArray(jobsData) ? jobsData : [])
  const total = (jobsData as any)?.total || jobs.length

  const createJob = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/assets/discovery/jobs', {
        job_type: 'domain_enum',
        config: { domain, include_subdomains: true, include_directories: true, dir_tool: 'auto', wordlist_key: 'seclists_common' },
        run_inline: false,
      })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discovery'] })
      setShowForm(false)
      setDomain('')
    },
  })

  const hasActive = jobs.some((j: any) => j.status === 'running' || j.status === 'pending')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Discovery Jobs</h1>
          <p className="text-muted-foreground">Domain enumeration and asset discovery</p>
        </div>
        <div className="flex items-center gap-2">
          {hasActive && <span className="flex items-center gap-1 text-xs text-brand-700"><Loader2 className="h-3 w-3 animate-spin" /> Live</span>}
          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? <X className="mr-1 h-4 w-4" /> : <Play className="mr-1 h-4 w-4" />}
            {showForm ? 'Cancel' : 'New Discovery'}
          </Button>
        </div>
      </div>

      <SubPageNav items={[{ label: 'Assets', to: '/assets' }, { label: 'Discovery', to: '/discovery' }]} />

      {showForm && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="font-semibold text-sm">Start Domain Enumeration</h3>
            <div className="flex gap-2">
              <Input placeholder="example.com" value={domain} onChange={(e) => setDomain(e.target.value)} className="max-w-sm" />
              <Button onClick={() => createJob.mutate()} disabled={!domain || createJob.isPending}>
                {createJob.isPending ? 'Starting...' : 'Enumerate'}
              </Button>
            </div>
            {createJob.isError && <p className="text-xs text-destructive">Failed to start job.</p>}
            <p className="text-xs text-muted-foreground">Runs subfinder, amass, ffuf/gobuster with soft-404 filtering. Results appear in Assets.</p>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {JOB_TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => { setFilter(t.value); setOffset(0) }}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${filter === t.value ? 'bg-brand-700 text-white' : 'bg-muted text-muted-foreground hover:bg-accent'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <DataTable
        columns={[
          { key: 'domain', label: 'Domain / Config', width: '3fr', render: (j: any) => (
            <div className="min-w-0">
              <p className="font-medium truncate">{j.config?.domain || `Job #${j.id}`}</p>
              {j.result_summary?.tools_used && (
                <p className="text-xs text-muted-foreground">{j.result_summary.tools_used.join(', ')}</p>
              )}
              {j.error_message && <p className="text-xs text-destructive">{j.error_message}</p>}
            </div>
          )},
          { key: 'type', label: 'Type', width: '130px', render: (j: any) => <span className="text-xs text-muted-foreground">{normalizeEnum(j.job_type)}</span> },
          { key: 'status', label: 'Status', width: '120px', render: (j: any) => <StatusBadge status={j.status} pulse={j.status === 'running'} /> },
          { key: 'discovered', label: 'Discovered', width: '110px', render: (j: any) => <span className="text-xs text-muted-foreground">{j.assets_discovered ?? j.result_summary?.assets_upserted ?? 0}</span> },
          { key: 'time', label: 'Time', width: '150px', render: (j: any) => <span className="text-xs text-muted-foreground">{formatRelativeTime(j.created_at)}</span> },
        ]}
        data={jobs}
        total={total}
        offset={offset}
        limit={PAGE_SIZE}
        isLoading={isLoading}
        isEmpty={jobs.length === 0}
        emptyIcon={Globe}
        emptyTitle="No discovery jobs yet"
        emptyDescription="Start a domain enumeration to discover subdomains and endpoints."
        onPageChange={setOffset}
        keyExtractor={(j: any) => j.id}
      />
    </div>
  )
}

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { SeverityBadge } from '@/components/shared/SeverityBadge'
import { Pagination } from '@/components/shared/Pagination'
import { truncate } from '@/lib/format'
import { Search, ChevronDown, ChevronUp, ExternalLink, Bug, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { SubPageNav } from '@/components/shared/SubPageNav'
import { ScanEvidence } from '@/components/shared/ScanEvidence'

const PAGE_SIZE = 30

export function ScanResults() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [severityFilter, setSeverityFilter] = useState('')
  const [toolFilter, setToolFilter] = useState('')
  const [expanded, setExpanded] = useState<number | null>(null)
  const [offset, setOffset] = useState(0)

  const jobFilter = searchParams.get('job') || ''

  const { data: jobsData } = useQuery({
    queryKey: ['scans', 'jobs', 'filter'],
    queryFn: async () => {
      const { data } = await api.get('/scans/jobs?limit=50')
      const items = Array.isArray(data) ? data : data?.items || []
      return items
    },
  })

  const { data, isLoading } = useQuery({
    queryKey: ['scans', 'results', jobFilter, severityFilter, toolFilter, offset],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) })
      if (jobFilter) params.set('scan_job_id', jobFilter)
      if (severityFilter) params.set('severity', severityFilter)
      const { data } = await api.get(`/scans/results?${params}`)
      return data as { items: any[]; total: number }
    },
  })

  const results = data?.items ?? []
  const total = data?.total ?? 0

  const filtered = results.filter((r: any) =>
    (!search || r.title?.toLowerCase().includes(search.toLowerCase()) || r.description?.toLowerCase().includes(search.toLowerCase())) &&
    (!toolFilter || r.tool === toolFilter)
  )

  const SEVERITIES = ['', 'critical', 'high', 'medium', 'low', 'info']
  const tools = Array.from(new Set(results.map((r: any) => r.tool).filter(Boolean))) as string[]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Scan Results</h1>
        <p className="text-muted-foreground">
          Raw findings from all scan tools
          {jobFilter && ` — filtered to Job #${jobFilter}`}
        </p>
      </div>

      <SubPageNav items={[{ label: 'Jobs', to: '/scans' }, { label: 'Results', to: '/scans/results' }]} />

      <div className="flex flex-wrap items-center gap-2">
        {SEVERITIES.map((s) => (
          <button
            key={s || 'all'}
            onClick={() => setSeverityFilter(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${severityFilter === s ? 'bg-brand-700 text-white' : 'bg-muted text-muted-foreground hover:bg-accent'}`}
          >
            {s || 'All Severities'}
          </button>
        ))}
        <select
          className="text-xs bg-background text-foreground border border-input rounded px-2 py-1"
          value={toolFilter}
          onChange={(e) => setToolFilter(e.target.value)}
        >
          <option value="">All Tools</option>
          {tools.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select
          className="text-xs bg-background text-foreground border border-input rounded px-2 py-1"
          value={jobFilter}
          onChange={(e) => {
            const next = new URLSearchParams(searchParams)
            if (e.target.value) next.set('job', e.target.value)
            else next.delete('job')
            setSearchParams(next)
            setOffset(0)
          }}
        >
          <option value="">All Jobs</option>
          {(jobsData || []).map((j: any) => (
            <option key={j.id} value={j.id}>Job #{j.id} ({j.status})</option>
          ))}
        </select>
        {(jobFilter || toolFilter || severityFilter) && (
          <Button size="sm" variant="ghost" onClick={() => {
            setSearchParams(new URLSearchParams())
            setSeverityFilter('')
            setToolFilter('')
            setOffset(0)
          }}><X className="h-3 w-3 mr-1" /> Clear filters</Button>
        )}
        <div className="relative ml-auto">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="w-48 pl-8 h-8 text-sm" placeholder="Search findings..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">Loading findings...</div>
          ) : filtered.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                <Bug className="mx-auto h-8 w-8 mb-2 opacity-40" />
                <p>{search || severityFilter || jobFilter || toolFilter ? 'No findings match your filters.' : 'No findings yet. Run a scan to discover vulnerabilities.'}</p>
              </div>
          ) : (
            <div className="divide-y">
              <div className="grid px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider border-b" style={{ gridTemplateColumns: '1.5fr 1fr 100px 30px' }}>
                <span>Finding</span>
                <span>Tool / Job</span>
                <span>Severity</span>
                <span></span>
              </div>
              {filtered.map((r: any) => (
                <div key={r.id}>
                   <button
                     onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                     className="w-full grid px-6 py-3 text-sm items-center hover:bg-muted/50 text-left"
                     style={{ gridTemplateColumns: '1.5fr 1fr 100px 30px' }}
                   >
                     <div className="min-w-0 border-r pr-4">
                       <p className="font-medium truncate">{r.title}</p>
                       <p className="text-xs text-muted-foreground truncate">{truncate(r.description, 60)}</p>
                     </div>
                     <div className="text-xs text-muted-foreground border-r pr-4">
                       {r.tool} · Job #{r.scan_job_id || '?'}
                     </div>
                     <SeverityBadge severity={r.severity} />
                     <div className="flex justify-end">
                       {expanded === r.id ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
                     </div>
                   </button>
                   {expanded === r.id && (
                     <div className="px-6 pb-4 space-y-3">
                       {r.description && <p className="text-sm text-foreground">{r.description}</p>}
                       <ScanEvidence result={r} />
                       {r.evidence?.exploitdb?.candidates?.length > 0 && (
                         <div className="space-y-1">
                           <p className="text-xs font-medium text-muted-foreground">Exploit-DB Candidates:</p>
                           {r.evidence.exploitdb.candidates.map((c: any, i: number) => (
                             <a key={i} href={c.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-brand-700 hover:underline">
                               {c.edb_id} — {c.title} <ExternalLink className="h-3 w-3" />
                             </a>
                           ))}
                         </div>
                       )}
                     </div>
                   )}
                </div>
              ))}
            </div>
           )}
           <Pagination total={total} offset={offset} limit={PAGE_SIZE} onChange={setOffset} />
         </CardContent>
      </Card>
    </div>
  )
}

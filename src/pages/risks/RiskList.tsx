import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api, formatApiError } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { DataTable } from '@/components/shared/DataTable'
import { SeverityBadge } from '@/components/shared/SeverityBadge'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { SubPageNav } from '@/components/shared/SubPageNav'
import { useToastStore } from '@/store/toast'
import type { PrioritizedRiskListResponse, Risk, RiskListResponse } from '@/types/api'
import { AlertTriangle, Download, ListOrdered, RefreshCw, Search } from 'lucide-react'

const PAGE_SIZE = 30
const LEVELS = ['', 'critical', 'high', 'medium', 'low']
const STATUSES = ['', 'open', 'in_treatment', 'accepted', 'closed', 'monitoring']
const SORTS = [
  { value: 'score', label: 'Score' },
  { value: 'priority', label: 'Priority' },
  { value: 'created', label: 'Created' },
  { value: 'updated', label: 'Updated' },
]
const DEPARTMENTS = ['', 'IT', 'Security', 'Finance', 'Operations', 'Legal', 'Compliance', 'Engineering', 'Executive', 'Other']

export function RiskList() {
  const { addToast } = useToastStore()
  const [view, setView] = useState<'register' | 'prioritized'>('register')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [riskLevel, setRiskLevel] = useState('')
  const [department, setDepartment] = useState('')
  const [sort, setSort] = useState('score')
  const [band, setBand] = useState('')
  const [offset, setOffset] = useState(0)

  const registerQuery = useQuery({
    queryKey: ['risks', 'list', status, riskLevel, department, q, sort, offset],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
        sort,
      })
      if (status) params.set('status', status)
      if (riskLevel) params.set('risk_level', riskLevel)
      if (department) params.set('owner_department', department)
      if (q.trim()) params.set('q', q.trim())
      const { data } = await api.get(`/risks?${params}`)
      return data as RiskListResponse
    },
    enabled: view === 'register',
  })

  const prioritizedQuery = useQuery({
    queryKey: ['risks', 'prioritized', status, riskLevel, department, band, offset],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
        exclude_closed: 'true',
      })
      if (status) params.set('status', status)
      if (riskLevel) params.set('risk_level', riskLevel)
      if (department) params.set('owner_department', department)
      if (band) params.set('band', band)
      const { data } = await api.get(`/risks/prioritized?${params}`)
      return data as PrioritizedRiskListResponse
    },
    enabled: view === 'prioritized',
  })

  const active = view === 'register' ? registerQuery : prioritizedQuery
  const items = active.data?.items ?? []
  const total = active.data?.total ?? 0
  const summary =
    view === 'prioritized'
      ? (prioritizedQuery.data?.summary as Record<string, number> | undefined)
      : (registerQuery.data?.priority_summary as Record<string, number> | undefined)

  const exportRisks = async (format: 'json' | 'csv') => {
    try {
      const params = new URLSearchParams({ format })
      if (status) params.set('status', status)
      if (riskLevel) params.set('risk_level', riskLevel)
      const res = await api.get(`/risks/export?${params}`, { responseType: 'blob' })
      const blob = new Blob([res.data], {
        type: format === 'csv' ? 'text/csv' : 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `phantix-risks.${format}`
      a.click()
      URL.revokeObjectURL(url)
      addToast({ type: 'success', title: `Exported risks as ${format.toUpperCase()}` })
    } catch (err: any) {
      addToast({ type: 'error', title: formatApiError(err, 'Export failed') })
    }
  }

  const columns = [
    {
      key: 'rank',
      label: view === 'prioritized' ? 'Prio' : '#',
      width: '70px',
      render: (r: Risk) =>
        view === 'prioritized' ? (
          <span className="font-mono text-xs font-semibold text-brand-700">
            {r.priority_band || '—'}
            {r.priority_rank != null ? ` · ${r.priority_rank}` : ''}
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">{r.id}</span>
        ),
    },
    {
      key: 'title',
      label: 'Risk',
      render: (r: Risk) => (
        <div className="min-w-0">
          <Link to={`/risks/${r.id}`} className="font-medium text-foreground hover:underline line-clamp-1">
            {r.title}
          </Link>
          {r.vulnerability && (
            <div className="text-xs text-muted-foreground line-clamp-1">{r.vulnerability}</div>
          )}
        </div>
      ),
    },
    {
      key: 'level',
      label: 'Level',
      width: '110px',
      render: (r: Risk) =>
        r.risk_level ? <SeverityBadge severity={r.risk_level} /> : <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'score',
      label: 'Score',
      width: '80px',
      render: (r: Risk) => (
        <span className="font-mono text-sm">{r.risk_score ?? '—'}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      width: '120px',
      render: (r: Risk) => <StatusBadge status={r.status} />,
    },
    {
      key: 'owner',
      label: 'Owner',
      width: '120px',
      render: (r: Risk) => (
        <span className="text-xs text-muted-foreground">{r.owner_department || '—'}</span>
      ),
    },
    {
      key: 'treatment',
      label: 'Treatment',
      width: '110px',
      render: (r: Risk) => (
        <span className="text-xs text-muted-foreground">{r.treatment_status || '—'}</span>
      ),
    },
  ]

  const errMsg = active.isError ? formatApiError(active.error, 'Failed to load risks') : null

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-brand-700" /> Risk Management
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Client-owned risk register, prioritization queue, treatments, and export
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => active.refetch()}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportRisks('csv')}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportRisks('json')}>
            <Download className="h-4 w-4 mr-1" /> JSON
          </Button>
        </div>
      </div>

      <SubPageNav
        items={[
          { label: 'Dashboard', to: '/dashboard' },
          { label: 'VAPT', to: '/vapt' },
          { label: 'Reports', to: '/reports' },
          { label: 'Tracker', to: '/tracker' },
        ]}
      />

      <div className="flex gap-2">
        <Button
          variant={view === 'register' ? 'default' : 'outline'}
          size="sm"
          onClick={() => {
            setView('register')
            setOffset(0)
          }}
        >
          Risk register
        </Button>
        <Button
          variant={view === 'prioritized' ? 'default' : 'outline'}
          size="sm"
          onClick={() => {
            setView('prioritized')
            setOffset(0)
          }}
        >
          <ListOrdered className="h-4 w-4 mr-1" /> Prioritized queue
        </Button>
      </div>

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {['P1', 'P2', 'P3', 'P4', 'P5'].map((b) => (
            <Card key={b} className="shadow-sm">
              <CardContent className="p-3 text-center">
                <div className="text-xs text-muted-foreground">{b}</div>
                <div className="text-xl font-semibold">{summary[b] ?? summary[b.toLowerCase()] ?? 0}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-end">
        {view === 'register' && (
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Search risks…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setOffset(0)
              }}
            />
          </div>
        )}
        <select
          className="h-9 rounded-md border border-input bg-background text-foreground px-2 text-sm"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            setOffset(0)
          }}
        >
          <option value="">All statuses</option>
          {STATUSES.filter(Boolean).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          className="h-9 rounded-md border border-input bg-background text-foreground px-2 text-sm"
          value={riskLevel}
          onChange={(e) => {
            setRiskLevel(e.target.value)
            setOffset(0)
          }}
        >
          <option value="">All levels</option>
          {LEVELS.filter(Boolean).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          className="h-9 rounded-md border border-input bg-background text-foreground px-2 text-sm"
          value={department}
          onChange={(e) => {
            setDepartment(e.target.value)
            setOffset(0)
          }}
        >
          <option value="">All departments</option>
          {DEPARTMENTS.filter(Boolean).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {view === 'register' ? (
          <select
            className="h-9 rounded-md border border-input bg-background text-foreground px-2 text-sm"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value)
              setOffset(0)
            }}
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                Sort: {s.label}
              </option>
            ))}
          </select>
        ) : (
          <select
            className="h-9 rounded-md border border-input bg-background text-foreground px-2 text-sm"
            value={band}
            onChange={(e) => {
              setBand(e.target.value)
              setOffset(0)
            }}
          >
            <option value="">All bands P1–P5</option>
            {['P1', 'P2', 'P3', 'P4', 'P5'].map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        )}
      </div>

      {view === 'prioritized' && prioritizedQuery.data?.formula && (
        <p className="text-xs text-muted-foreground font-mono">{prioritizedQuery.data.formula}</p>
      )}

      <DataTable
        columns={columns}
        data={items}
        total={total}
        offset={offset}
        limit={PAGE_SIZE}
        isLoading={active.isLoading}
        isEmpty={!active.isLoading && items.length === 0}
        emptyIcon={AlertTriangle}
        emptyTitle="No risks yet"
        emptyDescription="Risks are created automatically from scan findings once your security database is connected."
        error={errMsg}
        onRetry={() => active.refetch()}
        onPageChange={setOffset}
        keyExtractor={(r: Risk) => r.id}
      />
    </div>
  )
}

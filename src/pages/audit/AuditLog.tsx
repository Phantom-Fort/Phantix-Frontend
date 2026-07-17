import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { DataTable } from '@/components/shared/DataTable'
import { normalizeAuditEvent, normalizeAuditPending, formatDateTime } from '@/lib/format'
import { Search, Users, History } from 'lucide-react'
import { SubPageNav } from '@/components/shared/SubPageNav'

const PAGE_SIZE = 30

export function AuditLog() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [offset, setOffset] = useState(0)

  const queryKey = ['audit', 'events', offset, search, statusFilter]
  const { data } = useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) })
      if (search) params.set('q', search)
      if (statusFilter) params.set('status', statusFilter)
      const { data } = await api.get(`/audit/events?${params}`)
      return data as { items: any[]; total: number }
    },
  })

  const rawEvents = data?.items ?? []
  const events = rawEvents.map(normalizeAuditEvent)
  const total = data?.total ?? 0

  const { data: rawPending } = useQuery({
    queryKey: ['audit', 'pending', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '50' })
      if (statusFilter) params.set('status', statusFilter)
      const { data } = await api.get(`/audit/pending?${params}`)
      return Array.isArray(data) ? data : data?.items || data?.pending || []
    },
  })
  const pending = (rawPending || []).map(normalizeAuditPending)

  const handleSearchChange = (v: string) => { setSearch(v); setOffset(0) }
  const handleStatusChange = (v: string) => { setStatusFilter(v); setOffset(0) }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <History className="h-5 w-5" /> Audit Log
          </h1>
          <p className="text-muted-foreground">Trace all activities across the system — who did what, when, and why</p>
        </div>
        <div className="flex items-center gap-2">
          {pending.length > 0 && (
            <span className="flex items-center gap-1 text-xs text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 px-2 py-1 rounded-full">
              {pending.length} pending authorization{pending.length > 1 ? 's' : ''}
            </span>
          )}
          <select
            className="h-8 rounded border bg-background text-foreground px-2 text-sm"
            value={statusFilter}
            onChange={(e) => handleStatusChange(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="authorized">Authorized</option>
            <option value="rejected">Rejected</option>
          </select>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="w-48 pl-8 h-8 text-sm" placeholder="Search actions, users, summary..." value={search} onChange={(e) => handleSearchChange(e.target.value)} />
          </div>
        </div>
      </div>

      <SubPageNav items={[{ label: 'Alerts', to: '/alerts' }, { label: 'Dashboard', to: '/dashboard' }]} />

      {pending.length > 0 && (
        <Card className="border-yellow-300 bg-yellow-50/50 dark:bg-yellow-900/10">
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">Pending Authorizations</h3>
            {pending.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <div className="min-w-0">
                  <span className="font-medium">{p.action}</span>
                  {p.summary && <span className="text-xs text-muted-foreground ml-2">— {p.summary}</span>}
                  <div className="text-xs text-muted-foreground">by {p.actor}</div>
                </div>
                <StatusBadge status={p.status || 'pending'} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <DataTable
        columns={[
          { key: 'action', label: 'Action', width: '3fr', render: (e: any) => (
            <div className="min-w-0">
              <p className="font-medium truncate">{e.action}</p>
              {e.summaryText && <p className="text-xs text-muted-foreground truncate">{e.summaryText}</p>}
              {e.resource_type && e.resource_id && (
                <p className="text-[10px] text-muted-foreground">{e.resource_type} #{e.resource_id}</p>
              )}
            </div>
          )},
          { key: 'actor', label: 'Initiator', width: '160px', render: (e: any) => (
            <span className="text-xs text-muted-foreground">{e.actor}{e.initiator_title ? ` (${e.initiator_title})` : ''}</span>
          )},
          { key: 'status', label: 'Status', width: '100px', render: (e: any) => <StatusBadge status={e.status} /> },
          { key: 'time', label: 'When', width: '160px', render: (e: any) => (
            <span className="text-xs text-muted-foreground whitespace-nowrap">{e.time ? formatDateTime(e.time) : '—'}</span>
          )},
          { key: 'category', label: 'Category', width: '100px', render: (e: any) => (
            <span className="text-xs px-1.5 py-0.5 rounded bg-muted">{e.category}</span>
          )},
        ]}
        data={events}
        total={total}
        offset={offset}
        limit={PAGE_SIZE}
        isEmpty={events.length === 0}
        emptyIcon={Users}
        emptyTitle={search || statusFilter ? 'No matching events.' : 'No audit events yet.'}
        emptyDescription="Activities are recorded here for compliance and tracing."
        onPageChange={setOffset}
        keyExtractor={(e: any) => e.id}
      />
    </div>
  )
}

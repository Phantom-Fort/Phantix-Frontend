import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SeverityBadge } from '@/components/shared/SeverityBadge'
import { DataTable } from '@/components/shared/DataTable'
import { ListChecks, RefreshCw, Search, Edit2, Save, X } from 'lucide-react'
import { SubPageNav } from '@/components/shared/SubPageNav'

const COLUMNS = [
  { key: 'open', label: 'Open' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'fixed', label: 'Fixed' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'false_positive', label: 'False Positive' },
]

const STATUSES = ['open', 'in_progress', 'fixed', 'accepted', 'false_positive']
const PRIORITIES = ['low', 'medium', 'high', 'critical']

export function TrackerBoard() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [view, setView] = useState<'board' | 'table'>('board')
  const [offset, setOffset] = useState(0)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<any>({})
  const PAGE_SIZE = 30

  const { data: entriesResp, isLoading } = useQuery({
    queryKey: ['tracker', offset],
    queryFn: async () => {
      const { data } = await api.get(`/reports/tracker?limit=${PAGE_SIZE}&offset=${offset}`)
      const items = Array.isArray(data) ? data : data?.items || []
      const total = data?.total ?? (items.length < PAGE_SIZE ? offset + items.length : offset + PAGE_SIZE + 1)
      return { items, total }
    },
  })
  const entries = entriesResp?.items || []
  const total = entriesResp?.total || entries.length

  const patchMutation = useMutation({
    mutationFn: async ({ key, payload }: { key: string; payload: any }) => {
      await api.patch(`/reports/tracker/${key}`, payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tracker'] })
      setEditingKey(null)
    },
  })

  const filtered = entries.filter((e: any) => {
    const s = (e.status || 'open').toLowerCase()
    const matchesSearch = !search || e.title?.toLowerCase().includes(search.toLowerCase()) || e.finding_key?.includes(search)
    const matchesStatus = !statusFilter || s === statusFilter
    return matchesSearch && matchesStatus
  })

  const grouped: Record<string, any[]> = {}
  COLUMNS.forEach((c) => { grouped[c.key] = [] })
  filtered.forEach((e: any) => {
    const s = (e.status || 'open').toLowerCase()
    if (grouped[s]) grouped[s].push(e)
    else grouped.open.push(e)
  })

  const startEdit = (e: any) => {
    setEditingKey(e.finding_key)
    setEditForm({
      status: e.status,
      priority: e.priority,
      assigned_owner: e.assigned_owner || '',
      assigned_owner_email: e.assigned_owner_email || '',
      target_fix_date: e.target_fix_date || '',
      retest_status: e.retest_status || '',
      retest_evidence: e.retest_evidence || '',
    })
  }

  const saveEdit = () => {
    if (!editingKey) return
    patchMutation.mutate({ key: editingKey, payload: { ...editForm } })
  }

  const quickStatus = (key: string, status: string) => {
    patchMutation.mutate({ key, payload: { status } })
  }

  const TrackerRow = ({ e }: { e: any }) => {
    const isEditing = editingKey === e.finding_key
    return (
      <Card className="shadow-sm">
        <CardContent className="p-3 space-y-2 text-sm">
          <div className="flex justify-between items-start gap-2">
            <div className="min-w-0">
              <p className="font-medium leading-tight truncate">{e.title}</p>
              <p className="text-[10px] text-muted-foreground">{e.finding_key} · {e.surface}</p>
            </div>
            <SeverityBadge severity={e.severity} />
          </div>

          {!isEditing ? (
            <>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>Status: <span className="text-foreground font-medium">{e.status}</span></span>
                <span>Priority: <span className="text-foreground font-medium">{e.priority}</span></span>
                {e.assigned_owner && <span>Owner: {e.assigned_owner}</span>}
                {e.target_fix_date && <span>Due: {new Date(e.target_fix_date).toLocaleDateString()}</span>}
              </div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={() => startEdit(e)}><Edit2 className="h-3 w-3 mr-1" /> Edit</Button>
                {e.status !== 'in_progress' && <Button size="sm" variant="ghost" onClick={() => quickStatus(e.finding_key, 'in_progress')}>Start</Button>}
                {e.status === 'in_progress' && (
                  <>
                    <Button size="sm" variant="ghost" className="text-green-600" onClick={() => quickStatus(e.finding_key, 'fixed')}>Fixed</Button>
                    <Button size="sm" variant="ghost" onClick={() => quickStatus(e.finding_key, 'accepted')}>Accept</Button>
                    <Button size="sm" variant="ghost" onClick={() => quickStatus(e.finding_key, 'false_positive')}>FP</Button>
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-2 pt-1">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <select className="border rounded px-2 py-1 bg-background text-foreground" value={editForm.status} onChange={(ev) => setEditForm({ ...editForm, status: ev.target.value })}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <select className="border rounded px-2 py-1 bg-background text-foreground" value={editForm.priority} onChange={(ev) => setEditForm({ ...editForm, priority: ev.target.value })}>
                  {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <Input placeholder="Owner name" className="h-8 text-xs" value={editForm.assigned_owner} onChange={(ev) => setEditForm({ ...editForm, assigned_owner: ev.target.value })} />
                <Input placeholder="Owner email" className="h-8 text-xs" value={editForm.assigned_owner_email} onChange={(ev) => setEditForm({ ...editForm, assigned_owner_email: ev.target.value })} />
                <Input type="date" className="h-8 text-xs" value={editForm.target_fix_date?.slice(0,10) || ''} onChange={(ev) => setEditForm({ ...editForm, target_fix_date: ev.target.value })} />
                <Input placeholder="Retest status" className="h-8 text-xs" value={editForm.retest_status} onChange={(ev) => setEditForm({ ...editForm, retest_status: ev.target.value })} />
              </div>
              <Input placeholder="Retest evidence / link" className="h-8 text-xs" value={editForm.retest_evidence} onChange={(ev) => setEditForm({ ...editForm, retest_evidence: ev.target.value })} />
              <div className="flex gap-2">
                <Button size="sm" onClick={saveEdit} disabled={patchMutation.isPending}><Save className="h-3 w-3 mr-1" /> Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingKey(null)}><X className="h-3 w-3" /></Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">Remediation Tracker <ListChecks className="h-5 w-5 text-brand-700" /></h1>
          <p className="text-muted-foreground">Interactive cross-campaign finding lifecycle &amp; ownership</p>
        </div>
        <div className="flex gap-2">
          <Button variant={view === 'board' ? 'default' : 'outline'} size="sm" onClick={() => setView('board')}>Board</Button>
          <Button variant={view === 'table' ? 'default' : 'outline'} size="sm" onClick={() => setView('table')}>Table</Button>
          <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['tracker'] })}>
            <RefreshCw className="mr-1 h-4 w-4" /> Refresh
          </Button>
        </div>
      </div>

      <SubPageNav items={[{ label: 'Reports', to: '/reports' }, { label: 'Tracker', to: '/tracker' }]} />

      <div className="flex flex-wrap gap-2">
        <div className="relative w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => { setSearch(e.target.value); setOffset(0) }} placeholder="Search findings..." className="pl-9 h-9" />
        </div>
        <select className="h-9 rounded border px-3 text-sm bg-background text-foreground" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setOffset(0) }}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="text-xs self-center text-muted-foreground ml-auto">{filtered.length} findings</div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading tracker…</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <ListChecks className="mx-auto h-8 w-8 mb-2 opacity-40" />
          <p className="text-sm">No tracker entries match.</p>
        </div>
      ) : view === 'board' ? (
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${COLUMNS.length}, 1fr)` }}>
          {COLUMNS.map((col) => (
            <div key={col.key}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-foreground">{col.label}</h3>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{grouped[col.key]?.length || 0}</span>
              </div>
              <div className="space-y-2">
                {(grouped[col.key] || []).map((e: any) => <TrackerRow key={e.finding_key} e={e} />)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <DataTable
          columns={[
            { key: 'title', label: 'Finding', width: '2.5fr', render: (e: any) => (
              <div>
                <div className="font-medium truncate">{e.title}</div>
                <div className="text-xs text-muted-foreground truncate">{e.finding_key} · {e.surface}</div>
              </div>
            )},
            { key: 'sev', label: 'Severity', width: '100px', render: (e: any) => <SeverityBadge severity={e.severity} /> },
            { key: 'status', label: 'Status', width: '120px', render: (e: any) => <span className="text-xs px-2 py-0.5 rounded bg-muted">{e.status}</span> },
            { key: 'priority', label: 'Priority', width: '100px', render: (e: any) => <span className="text-xs">{e.priority}</span> },
            { key: 'owner', label: 'Owner', width: '140px', render: (e: any) => <span className="text-xs truncate">{e.assigned_owner || '—'}</span> },
            { key: 'due', label: 'Target Date', width: '120px', render: (e: any) => <span className="text-xs">{e.target_fix_date ? new Date(e.target_fix_date).toLocaleDateString() : '—'}</span> },
            { key: 'actions', label: '', width: '160px', render: (e: any) => (
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => startEdit(e)}><Edit2 className="h-3 w-3" /></Button>
                <Button size="sm" variant="ghost" onClick={() => quickStatus(e.finding_key, 'in_progress')}>Start</Button>
              </div>
            )},
          ]}
          data={filtered}
          total={total}
          offset={offset}
          limit={PAGE_SIZE}
          isLoading={isLoading}
          isEmpty={filtered.length === 0}
          onPageChange={setOffset}
          keyExtractor={(e: any) => e.finding_key || e.id}
        />
      )}
    </div>
  )
}

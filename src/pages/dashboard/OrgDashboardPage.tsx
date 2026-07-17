import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { SeverityBadge } from '@/components/shared/SeverityBadge'
import { CardSkeleton } from '@/components/shared/Skeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { formatRelativeTime } from '@/lib/format'
import { Activity, Shield, Swords, AlertTriangle, ArrowRight, Globe, FileText } from 'lucide-react'
import { SubPageNav } from '@/components/shared/SubPageNav'

export function OrgDashboardPage() {
  const campaignsQuery = useQuery({
    queryKey: ['campaigns', 'list', 'limit5'],
    queryFn: async () => {
      const { data } = await api.get('/vapt/campaigns?limit=5')
      return (data?.items || []) as any[]
    },
  })

  const assetsQuery = useQuery({
    queryKey: ['assets', 'list', 'limit5'],
    queryFn: async () => {
      const { data } = await api.get('/assets?limit=5')
      return (data?.items || []) as any[]
    },
  })

  const findingsQuery = useQuery({
    queryKey: ['scans', 'results', 'limit5'],
    queryFn: async () => {
      const { data } = await api.get('/scans/results?limit=5')
      return (data?.items || []) as any[]
    },
  })

  const campaigns = campaignsQuery.data ?? []
  const assets = assetsQuery.data ?? []
  const findings = findingsQuery.data ?? []
  const loading = campaignsQuery.isLoading || assetsQuery.isLoading || findingsQuery.isLoading

  const activeCampaigns = campaigns.filter((c: any) => c.status === 'active' || c.status === 'running')
  const criticalFindings = findings.filter((r: any) => r.severity === 'critical' || r.severity === 'high')

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Organization security overview</p>
        </div>
        <CardSkeleton count={4} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Organization security overview</p>
      </div>

      <SubPageNav items={[{ label: 'Assets', to: '/assets' }, { label: 'Scans', to: '/scans' }, { label: 'VAPT', to: '/vapt' }, { label: 'Reports', to: '/reports' }]} />

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Campaigns</CardTitle>
            <Swords className="h-4 w-4 text-brand-700" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{activeCampaigns.length}</p>
            <p className="text-xs text-muted-foreground">{campaigns.length} total campaigns</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Assets</CardTitle>
            <Globe className="h-4 w-4 text-brand-700" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{assets.length}</p>
            <p className="text-xs text-muted-foreground">Monitored assets</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Critical Findings</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-500">{criticalFindings.length}</p>
            <p className="text-xs text-muted-foreground">High/critical severity</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Live Dashboard</CardTitle>
            <Activity className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-yellow-500" />
              </span>
              <span className="text-xs text-muted-foreground font-mono">Awaiting GraphQL</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Realtime data pending</p>
          </CardContent>
        </Card>
      </div>

      {/* Active campaigns */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Active Campaigns</CardTitle>
          <a href="/vapt" className="text-sm text-brand-700 hover:underline flex items-center gap-1">
            View all <ArrowRight className="h-3 w-3" />
          </a>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <EmptyState icon={Swords} title="No campaigns yet" description="Start your first security assessment." action={<a href="/vapt" className="text-sm text-brand-700 hover:underline">Plan a campaign</a>} />
          ) : (
            <div className="divide-y text-sm">
              {campaigns.slice(0, 5).map((c: any) => (
                <div key={c.id} className="flex items-center justify-between py-3">
                  <div className="min-w-0 flex-1">
                     <a href={`/vapt/${c.id}`} className="font-medium text-foreground hover:underline">
                      {c.campaign_name || `Campaign #${c.id}`}
                    </a>
                    <p className="text-xs text-muted-foreground">{c.current_phase ? c.current_phase.replace(/_/g, ' ') : formatRelativeTime(c.created_at)}</p>
                  </div>
                  <StatusBadge status={c.status} pulse={c.status === 'running'} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent findings + assets */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Recent Findings</CardTitle>
            <a href="/scans/results" className="text-sm text-brand-700 hover:underline flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </a>
          </CardHeader>
          <CardContent>
            {findings.length === 0 ? (
              <EmptyState icon={AlertTriangle} title="No findings yet" description="Run a scan to discover vulnerabilities." />
            ) : (
              <div className="divide-y text-sm">
                {findings.slice(0, 5).map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{r.title}</p>
                      <p className="text-xs text-muted-foreground">{r.tool} · {formatRelativeTime(r.created_at)}</p>
                    </div>
                    <SeverityBadge severity={r.severity} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Recent Assets</CardTitle>
            <a href="/assets" className="text-sm text-brand-700 hover:underline flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </a>
          </CardHeader>
          <CardContent>
            {assets.length === 0 ? (
              <EmptyState icon={Shield} title="No assets yet" description="Add your first asset to begin monitoring." />
            ) : (
              <div className="divide-y text-sm">
                {assets.slice(0, 5).map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{a.name || a.value}</p>
                      <p className="text-xs text-muted-foreground">{a.asset_type?.replace(/_/g, ' ')}</p>
                    </div>
                    <StatusBadge status={a.criticality} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { href: '/assets', icon: Shield, label: 'Add Assets', desc: 'Manage inventory' },
              { href: '/scans', icon: AlertTriangle, label: 'Run Scan', desc: 'Vulnerability scan' },
              { href: '/vapt', icon: Swords, label: 'Start VAPT', desc: 'Full assessment' },
              { href: '/reports', icon: FileText, label: 'Generate Report', desc: 'PDF, XLSX, DOCX' },
            ].map((item) => (
              <a key={item.href} href={item.href} className="rounded-lg border p-4 hover:border-brand-300 hover:bg-brand-50/50 dark:hover:bg-brand-900/20 transition-colors text-center space-y-1">
                <item.icon className="mx-auto h-5 w-5 text-brand-700" />
                <p className="font-medium text-sm text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </a>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

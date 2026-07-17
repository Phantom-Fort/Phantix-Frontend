import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { SubPageNav } from '@/components/shared/SubPageNav'


export function ComplianceDashboard() {
  const { data: frameworks } = useQuery({
    queryKey: ['compliance', 'frameworks'],
    queryFn: async () => {
      const { data } = await api.get('/compliance/frameworks')
      return Array.isArray(data) ? data : data?.items || data?.frameworks || []
    },
  })

  const { data: status } = useQuery({
    queryKey: ['compliance', 'status'],
    queryFn: async () => {
      const { data } = await api.get('/compliance/status')
      return data as { overall_compliance?: number; framework_statuses?: Array<{ framework: string; score: number; status: string }> }
    },
  })

  const { data: gaps } = useQuery({
    queryKey: ['compliance', 'gaps'],
    queryFn: async () => {
      const { data } = await api.get('/compliance/gaps')
      return Array.isArray(data) ? data : data?.items || data?.gaps || []
    },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Compliance</h1>
        <p className="text-muted-foreground">Framework compliance assessments</p>
      </div>

      <SubPageNav items={[{ label: 'Reports', to: '/reports' }, { label: 'Tracker', to: '/tracker' }, { label: 'VAPT', to: '/vapt' }]} />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Overall Compliance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-brand-700">{status?.overall_compliance ?? '-'}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Frameworks</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-brand-700">{Array.isArray(frameworks) ? frameworks.length : '-'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Gaps Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-500">{Array.isArray(gaps) ? gaps.length : '-'}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Framework Scores</CardTitle></CardHeader>
          <CardContent>
            {!status?.framework_statuses ? (
              <p className="text-sm text-muted-foreground">Loading scores...</p>
            ) : status.framework_statuses.length === 0 ? (
              <p className="text-sm text-muted-foreground">No frameworks assessed yet.</p>
            ) : (
              <div className="space-y-3">
                {status.framework_statuses.map((fs) => (
                  <div key={fs.framework} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{fs.framework}</span>
                      <span className="text-muted-foreground">{fs.score}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${fs.score >= 80 ? 'bg-green-500' : fs.score >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                        style={{ width: `${fs.score}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Framework Definitions</CardTitle></CardHeader>
          <CardContent>
            {!Array.isArray(frameworks) ? (
              <p className="text-sm text-muted-foreground">Loading frameworks...</p>
            ) : frameworks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No frameworks configured.</p>
            ) : (
              <div className="divide-y text-sm">
                {frameworks.map((f: any) => (
                  <div key={f.id || f.name} className="py-2.5 flex items-center justify-between">
                    <div>
                      <p className="font-medium">{f.name}</p>
                      <p className="text-xs text-muted-foreground">v{f.version} · {f.controls_count || '-'} controls</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

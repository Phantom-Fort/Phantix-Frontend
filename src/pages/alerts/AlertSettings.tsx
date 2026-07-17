import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Save, Bell } from 'lucide-react'
import { useState, useEffect } from 'react'
import { SubPageNav } from '@/components/shared/SubPageNav'

export function AlertSettings() {
  const queryClient = useQueryClient()

  const { data: settings, isLoading } = useQuery({
    queryKey: ['alerts', 'settings'],
    queryFn: async () => {
      const { data } = await api.get('/alerts/settings') as any
      return data as {
        alerts_enabled?: boolean
        smtp?: { enabled?: boolean; host?: string; port?: number; from_email?: string }
        email_recipients?: string[]
      }
    },
  })

  const [smtpHost, setSmtpHost] = useState('')
  const [smtpPort, setSmtpPort] = useState(587)
  const [fromEmail, setFromEmail] = useState('')
  const [recipients, setRecipients] = useState('')

  useEffect(() => {
    if (settings?.smtp?.host) setSmtpHost(settings.smtp.host)
    if (settings?.smtp?.port) setSmtpPort(settings.smtp.port)
    if (settings?.smtp?.from_email) setFromEmail(settings.smtp.from_email)
    if (settings?.email_recipients) setRecipients(settings.email_recipients.join(', '))
  }, [settings])

  const saveMutation = useMutation({
    mutationFn: async () => {
      await api.put('/alerts/settings', {
        alerts_enabled: true,
        smtp: { enabled: true, host: smtpHost, port: smtpPort, from_email: fromEmail, from_name: 'Phantix Alerts', use_tls: true },
        email_recipients: recipients.split(',').map((r: string) => r.trim()).filter(Boolean),
      })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts', 'settings'] }),
  })

  const testMutation = useMutation({
    mutationFn: async () => {
      await api.post('/alerts/test', {})
    },
  })

  const { data: eventsData } = useQuery({
    queryKey: ['alerts', 'events'],
    queryFn: async () => {
      const { data } = await api.get('/alerts/events?limit=20')
      return data as { items: any[]; total: number }
    },
    refetchInterval: 10000,
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Alert Settings</h1>
        <p className="text-muted-foreground">Configure email notifications</p>
      </div>

      <SubPageNav items={[{ label: 'Dashboard', to: '/dashboard' }, { label: 'Audit', to: '/audit' }]} />

      <Card>
        <CardHeader><CardTitle>SMTP Configuration</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading settings...</p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium mb-1 block">SMTP Host</label>
                  <Input value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} placeholder="smtp-relay.brevo.com" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Port</label>
                  <Input type="number" value={smtpPort} onChange={(e) => setSmtpPort(Number(e.target.value))} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">From Email</label>
                  <Input value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} placeholder="alerts@company.com" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Recipients (comma-separated)</label>
                  <Input value={recipients} onChange={(e) => setRecipients(e.target.value)} placeholder="admin@company.com, security@company.com" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? 'Saving...' : <><Save className="mr-1 h-4 w-4" /> Save</>}
                </Button>
                <Button variant="outline" onClick={() => testMutation.mutate()} disabled={testMutation.isPending}>
                  {testMutation.isPending ? 'Sending...' : 'Test Email'}
                </Button>
              </div>
              {saveMutation.isSuccess && <p className="text-xs text-green-600">Settings saved.</p>}
              {testMutation.isSuccess && <p className="text-xs text-green-600">Test email sent.</p>}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Bell className="h-4 w-4" /> Recent Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          {!eventsData?.items?.length ? (
            <p className="text-sm text-muted-foreground">No alerts yet. Use "Test Email" to generate one.</p>
          ) : (
            <div className="space-y-2 text-sm">
              {eventsData.items.slice(0, 8).map((ev: any) => (
                <div key={ev.id} className="flex items-start justify-between border rounded p-2">
                  <div>
                    <div className="font-medium">{ev.title} <span className="text-xs text-muted-foreground">({ev.severity})</span></div>
                    <div className="text-muted-foreground text-xs line-clamp-1">{ev.body}</div>
                  </div>
                  <div className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">{new Date(ev.created_at).toLocaleTimeString()}</div>
                </div>
              ))}
            </div>
          )}
          <p className="text-[10px] text-muted-foreground mt-3">Pop-up toasts appear automatically for high/critical alerts across the app.</p>
        </CardContent>
      </Card>
    </div>
  )
}

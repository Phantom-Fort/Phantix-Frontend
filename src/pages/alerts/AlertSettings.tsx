import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Save, Bell, KeyRound } from 'lucide-react'
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
        smtp?: {
          enabled?: boolean
          host?: string
          port?: number
          username?: string
          from_email?: string
          from_name?: string
          use_tls?: boolean
          use_ssl?: boolean
          password_configured?: boolean
        }
        email_recipients?: string[]
        whatsapp?: {
          enabled?: boolean
          recipients?: string[]
          provider?: string
        }
        telegram?: {
          enabled?: boolean
          recipients?: string[]
          provider?: string
          bot_token_configured?: boolean
        }
      }
    },
  })

  const [smtpHost, setSmtpHost] = useState('')
  const [smtpPort, setSmtpPort] = useState(587)
  const [smtpUsername, setSmtpUsername] = useState('')
  const [smtpPassword, setSmtpPassword] = useState('')
  const [fromEmail, setFromEmail] = useState('')
  const [fromName, setFromName] = useState('')
  const [useTls, setUseTls] = useState(true)
  const [recipients, setRecipients] = useState('')
  const [whatsappRecipients, setWhatsappRecipients] = useState('')
  const [telegramRecipients, setTelegramRecipients] = useState('')
  const [telegramBotToken, setTelegramBotToken] = useState('')

  useEffect(() => {
    if (!settings) return
    if (settings.smtp?.host) setSmtpHost(settings.smtp.host)
    if (settings.smtp?.port) setSmtpPort(settings.smtp.port)
    if (settings.smtp?.username) setSmtpUsername(settings.smtp.username)
    if (settings.smtp?.from_email) setFromEmail(settings.smtp.from_email)
    if (settings.smtp?.from_name) setFromName(settings.smtp.from_name)
    if (settings.smtp?.use_tls !== undefined) setUseTls(settings.smtp.use_tls)
    if (settings.email_recipients) setRecipients(settings.email_recipients.join(', '))
    if (settings.whatsapp?.recipients) setWhatsappRecipients(settings.whatsapp.recipients.join(', '))
    if (settings.telegram?.recipients) setTelegramRecipients(settings.telegram.recipients.join(', '))
  }, [settings])

  const hasPassword = settings?.smtp?.password_configured
  const hasBotToken = settings?.telegram?.bot_token_configured

  const saveMutation = useMutation({
    mutationFn: async () => {
      const smtp: Record<string, unknown> = {
        enabled: true,
        host: smtpHost,
        port: smtpPort,
        username: smtpUsername,
        from_email: fromEmail,
        from_name: fromName || 'Phantix Alerts',
        use_tls: useTls,
      }
      if (smtpPassword) smtp.password = smtpPassword
      const whatsapp: Record<string, unknown> = {
        enabled: true,
        provider: 'log',
      }
      const waRecipients = whatsappRecipients.split(',').map((r) => r.trim()).filter(Boolean)
      if (waRecipients.length) whatsapp.recipients = waRecipients
      const telegram: Record<string, unknown> = {
        enabled: true,
        provider: 'log',
      }
      const tgRecipients = telegramRecipients.split(',').map((r) => r.trim()).filter(Boolean)
      if (tgRecipients.length) telegram.recipients = tgRecipients
      if (telegramBotToken) telegram.bot_token = telegramBotToken
      await api.put('/alerts/settings', {
        alerts_enabled: true,
        smtp,
        email_recipients: recipients.split(',').map((r: string) => r.trim()).filter(Boolean),
        whatsapp,
        telegram,
      })
    },
    onSuccess: () => {
      setSmtpPassword('')
      setTelegramBotToken('')
      queryClient.invalidateQueries({ queryKey: ['alerts', 'settings'] })
    },
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
                  <label className="text-sm font-medium mb-1 block">Username</label>
                  <Input value={smtpUsername} onChange={(e) => setSmtpUsername(e.target.value)} placeholder="smtp user" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block flex items-center gap-1.5">
                    Password
                    {hasPassword && <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground"><KeyRound className="h-3 w-3" /> configured</span>}
                  </label>
                  <Input type="password" value={smtpPassword} onChange={(e) => setSmtpPassword(e.target.value)} placeholder={hasPassword ? 'Leave blank to keep current' : 'SMTP password'} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">From Email</label>
                  <Input value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} placeholder="support@phantix.site" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">From Name</label>
                  <Input value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="Phantix Alerts" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Recipients (comma-separated)</label>
                  <Input value={recipients} onChange={(e) => setRecipients(e.target.value)} placeholder="admin@company.com, security@company.com" />
                </div>
                <div className="flex items-end gap-4 pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={useTls} onChange={(e) => setUseTls(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
                    <span className="text-sm font-medium">Use TLS</span>
                  </label>
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
        <CardHeader><CardTitle>WhatsApp Notifications</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading settings...</p>
          ) : (
            <>
              <div>
                <label className="text-sm font-medium mb-1 block">Recipients (comma-separated usernames or phones)</label>
                <Input value={whatsappRecipients} onChange={(e) => setWhatsappRecipients(e.target.value)} placeholder="+2348012345678, +2348098765432" />
              </div>
              <p className="text-xs text-muted-foreground">Critical alerts only. Provider: log (no external API configured yet).</p>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Telegram Notifications</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading settings...</p>
          ) : (
            <>
              <div>
                <label className="text-sm font-medium mb-1 block">Recipients (comma-separated usernames or chat IDs)</label>
                <Input value={telegramRecipients} onChange={(e) => setTelegramRecipients(e.target.value)} placeholder="@username1, @username2" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block flex items-center gap-1.5">
                  Bot Token
                  {hasBotToken && <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground"><KeyRound className="h-3 w-3" /> configured</span>}
                </label>
                <Input type="password" value={telegramBotToken} onChange={(e) => setTelegramBotToken(e.target.value)} placeholder={hasBotToken ? 'Leave blank to keep current' : 'Telegram Bot API token'} />
              </div>
              <p className="text-xs text-muted-foreground">Critical alerts only. Provider: log (no external API configured yet).</p>
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

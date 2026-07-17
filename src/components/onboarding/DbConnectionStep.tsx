import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CheckCircle2, ArrowRight, Database, Loader2 } from 'lucide-react'

interface DbConnectionStepProps {
  onComplete: () => void
  connected: boolean
}

const DEFAULT_DB = {
  name: 'Security Storage',
  description: 'Security data storage for Phantix',
  db_type: 'postgresql',
  host: 'localhost',
  port: 5432,
  database_name: 'phantix_security',
  username: 'phantix',
  password: 'phantix',
  ssl_mode: 'disable',
  connection_purpose: 'security_data_storage',
  environment: 'development',
  is_primary: true,
}

export function DbConnectionStep({ onComplete, connected }: DbConnectionStepProps) {
  const [config, setConfig] = useState(DEFAULT_DB)

  const createConn = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/db-connections', config)
      return data as { id: number }
    },
  })

  const testConn = useMutation({
    mutationFn: async (connId: number) => {
      await api.post(`/db-connections/${connId}/test`)
    },
  })

  const bootstrap = useMutation({
    mutationFn: async (connId: number) => {
      await api.post(`/db-connections/${connId}/bootstrap`, {}, { timeout: 180_000 })
    },
  })

  const fullSetup = async () => {
    const conn = await createConn.mutateAsync()
    await testConn.mutateAsync(conn.id)
    await bootstrap.mutateAsync(conn.id)
    onComplete()
  }

  const running = createConn.isPending || testConn.isPending || bootstrap.isPending

  if (connected) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-green-600">
          <CheckCircle2 className="h-5 w-5" />
          <p className="font-medium">Security database connected</p>
        </div>
        <Button onClick={onComplete} variant="outline">
          Continue <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold flex items-center gap-2"><Database className="h-5 w-5" /> Security Database</h3>
      <p className="text-sm text-muted-foreground">Connect a PostgreSQL database for storing security findings and scan data.</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium mb-1 block">Host</label>
          <Input value={config.host} onChange={(e) => setConfig({ ...config, host: e.target.value })} />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Port</label>
          <Input type="number" value={config.port} onChange={(e) => setConfig({ ...config, port: Number(e.target.value) })} />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Database</label>
          <Input value={config.database_name} onChange={(e) => setConfig({ ...config, database_name: e.target.value })} />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Username</label>
          <Input value={config.username} onChange={(e) => setConfig({ ...config, username: e.target.value })} />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Password</label>
          <Input type="password" value={config.password} onChange={(e) => setConfig({ ...config, password: e.target.value })} />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">SSL Mode</label>
          <Input value={config.ssl_mode} onChange={(e) => setConfig({ ...config, ssl_mode: e.target.value })} />
        </div>
      </div>

      {createConn.isError && <p className="text-sm text-destructive">Connection failed. Check your database credentials.</p>}
      {testConn.isError && <p className="text-sm text-destructive">Connection test failed. Ensure the database is reachable.</p>}
      {bootstrap.isError && <p className="text-sm text-destructive">Schema bootstrap failed.</p>}

      {running && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {createConn.isPending ? 'Creating connection...' : testConn.isPending ? 'Testing connection...' : 'Bootstrapping schema...'}
        </div>
      )}

      <Button onClick={fullSetup} disabled={running}>
        {running ? 'Setting up...' : 'Connect & Bootstrap'}
      </Button>
    </div>
  )
}

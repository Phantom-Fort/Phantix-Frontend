import { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { api } from '@/lib/api'
import { toastApiError, toastError } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CheckCircle2, ArrowRight, Database, Loader2, AlertCircle } from 'lucide-react'

interface DbConnectionStepProps {
  onComplete: () => void
}

interface ConnInfo {
  id: number
  bootstrap_status: string
  bootstrap_error?: string
  host: string
  port: number
  database_name: string
  username: string
  ssl_mode: string
}

const DEFAULT_DB = {
  name: 'Security Storage',
  description: 'Security data storage for Phantix',
  db_type: 'postgresql',
  host: 'localhost',
  port: 5432,
  database_name: 'phantix_security',
  username: '',
  password: '',
  ssl_mode: 'disable',
  connection_purpose: 'security_data_storage',
  environment: 'development',
  is_primary: true,
}

export function DbConnectionStep({ onComplete }: DbConnectionStepProps) {
  const [config, setConfig] = useState(DEFAULT_DB)

  const { data: existing, isLoading: connLoading, refetch: refetchConn } = useQuery({
    queryKey: ['db-connections', 'primary-security-storage'],
    queryFn: async () => {
      try {
        const { data } = await api.get('/db-connections/primary-security-storage')
        return data as ConnInfo
      } catch (err) {
        const status = (err as AxiosError)?.response?.status
        if (status === 404) return null
        throw err
      }
    },
    retry: false,
  })

  // Pre-fill form from existing connection when found but not ready
  useEffect(() => {
    if (existing && existing.bootstrap_status !== 'ready') {
      setConfig((prev) => ({
        ...prev,
        host: existing.host || prev.host,
        port: existing.port ?? prev.port,
        database_name: existing.database_name || prev.database_name,
        username: existing.username || prev.username,
        ssl_mode: existing.ssl_mode || prev.ssl_mode,
      }))
    }
  }, [existing])

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

  const updateConn = useMutation({
    mutationFn: async (connId: number) => {
      const { data } = await api.put(`/db-connections/${connId}`, {
        host: config.host,
        port: config.port,
        database_name: config.database_name,
        username: config.username,
        password: config.password || undefined,
        ssl_mode: config.ssl_mode,
      })
      return data
    },
  })

  const bootstrap = useMutation({
    mutationFn: async (connId: number) => {
      const { data } = await api.post(`/db-connections/${connId}/bootstrap`, {}, { timeout: 180_000 })
      return data as { bootstrap_status: string; success: boolean; message?: string }
    },
    onSuccess: async (result) => {
      if (result.bootstrap_status === 'ready') {
        try { sessionStorage.setItem('phantix_wizard_db_done', '1') } catch { /* noop */ }
        onComplete()
      } else {
        toastError('Bootstrap incomplete', result.message || `Status is ${result.bootstrap_status}`)
      }
      await refetchConn()
    },
    onError: (err: any) => toastApiError(err, 'Schema bootstrap failed'),
  })

  // Create new connection from scratch
  const handleCreate = async () => {
    try {
      const conn = await createConn.mutateAsync()
      await testConn.mutateAsync(conn.id)
      await bootstrap.mutateAsync(conn.id)
    } catch (err: any) {
      if (createConn.isError && !testConn.isError) {
        toastApiError(err, 'Connection failed. Check credentials.')
      } else if (testConn.isError) {
        toastApiError(err, 'Connection test failed.')
      }
    }
  }

  // Update existing connection then bootstrap
  const handleUpdateBootstrap = async () => {
    if (!existing) return
    try {
      await updateConn.mutateAsync(existing.id)
      await bootstrap.mutateAsync(existing.id)
    } catch {
      // errors handled by mutation onError
    }
  }

  const isExistingNotReady = existing && existing.bootstrap_status !== 'ready'
  const processing =
    createConn.isPending || testConn.isPending || updateConn.isPending || bootstrap.isPending

  if (connLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-8">
        <Loader2 className="h-4 w-4 animate-spin" /> Checking database status...
      </div>
    )
  }

  if (existing && existing.bootstrap_status === 'ready') {
    try { sessionStorage.setItem('phantix_wizard_db_done', '1') } catch { /* noop */ }
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-green-600">
          <CheckCircle2 className="h-5 w-5" />
          <p className="font-medium">Security database connected and bootstrapped</p>
        </div>
        <Button onClick={onComplete} variant="outline">
          Continue <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <Database className="h-5 w-5" /> Security Database
      </h3>

      {isExistingNotReady && existing?.bootstrap_status === 'failed' && (
        <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{existing.bootstrap_error || 'Schema bootstrap failed'}</span>
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        {isExistingNotReady
          ? 'Update the database credentials below, then bootstrap the schema.'
          : 'Connect a PostgreSQL database for storing security findings and scan data.'}
      </p>

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
          <Input
            type="password"
            value={config.password}
            onChange={(e) => setConfig({ ...config, password: e.target.value })}
            placeholder={isExistingNotReady ? 'Enter new password (leave blank to keep existing)' : ''}
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">SSL Mode</label>
          <Input value={config.ssl_mode} onChange={(e) => setConfig({ ...config, ssl_mode: e.target.value })} />
        </div>
      </div>

      {processing && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {createConn.isPending ? 'Creating connection...' : testConn.isPending ? 'Testing connection...' : updateConn.isPending ? 'Updating connection...' : 'Bootstrapping schema...'}
        </div>
      )}

      <Button
        onClick={isExistingNotReady ? handleUpdateBootstrap : handleCreate}
        disabled={processing || !config.host || !config.database_name || !config.username}
      >
        {processing
          ? 'Working...'
          : isExistingNotReady
            ? 'Update & Bootstrap'
            : 'Connect & Bootstrap'}
      </Button>
    </div>
  )
}

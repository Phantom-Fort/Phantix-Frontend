import { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toastApiError, toastSuccess } from '@/lib/toast'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SeverityBadge } from '@/components/shared/SeverityBadge'
import { DataTable } from '@/components/shared/DataTable'
import { FileUpload } from '@/components/shared/FileUpload'
import { formatRelativeTime, getNmapIP, summarizeNmap } from '@/lib/format'
import { Plus, Search, X, Globe, Monitor, Network, FileCode, Smartphone, Inbox } from 'lucide-react'
import { SubPageNav } from '@/components/shared/SubPageNav'
import { ScanEvidence } from '@/components/shared/ScanEvidence'

const ASSET_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'domain', label: 'Domain' },
  { value: 'subdomain', label: 'Subdomain' },
  { value: 'ip_address', label: 'IP Address' },
  { value: 'web_app', label: 'Web App' },
  { value: 'api', label: 'API' },
  { value: 'port_service', label: 'Port/Service' },
  { value: 'github_repo', label: 'GitHub Repo' },
  { value: 'mobile_apk', label: 'Mobile APK' },
  { value: 'cloud_resource', label: 'Cloud Resource' },
  { value: 'database_connection', label: 'DB Connection' },
  { value: 'aws_account', label: 'AWS Account' },
  { value: 'azure_subscription', label: 'Azure Subscription' },
  { value: 'gcp_project', label: 'GCP Project' },
  { value: 'container_image', label: 'Container Image' },
  { value: 'k8s_cluster', label: 'K8s Cluster' },
  { value: 'domain_controller', label: 'Domain Controller' },
  { value: 'ldap_server', label: 'LDAP Server' },
  { value: 'windows_server', label: 'Windows Server' },
  { value: 'linux_server', label: 'Linux Server' },
  { value: 'network_device', label: 'Network Device' },
  { value: 'dns_server', label: 'DNS Server' },
  { value: 'wazuh_agent', label: 'Wazuh Agent' },
  { value: 'saas_tenant', label: 'SaaS Tenant' },
  { value: 'other', label: 'Other' },
]

const typeIcons: Record<string, any> = {
  domain: Globe,
  subdomain: Globe,
  ip_address: Network,
  web_app: FileCode,
  api: FileCode,
  port_service: Monitor,
  github_repo: FileCode,
  mobile_apk: Smartphone,
  cloud_resource: Globe,
  database_connection: Monitor,
  aws_account: Globe,
  azure_subscription: Globe,
  gcp_project: Globe,
  container_image: FileCode,
  k8s_cluster: Monitor,
  domain_controller: Network,
  ldap_server: Network,
  windows_server: Monitor,
  linux_server: Monitor,
  network_device: Network,
  dns_server: Globe,
  wazuh_agent: Monitor,
  saas_tenant: Globe,
  other: Globe,
}

const PAGE_SIZE = 30

export function AssetList() {
  const queryClient = useQueryClient()
  const [assetType, setAssetType] = useState('')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [showApkUpload, setShowApkUpload] = useState(false)
  const [offset, setOffset] = useState(0)
  const [form, setForm] = useState({ asset_type: 'domain', value: '', name: '', criticality: 'medium', environment: '', owner: '' })
  const [showGithub, setShowGithub] = useState(false)
  const [githubPat, setGithubPat] = useState('')
  const [githubLabel, setGithubLabel] = useState('default')
  const [githubImportRepo, setGithubImportRepo] = useState('')
  const [showApiImport, setShowApiImport] = useState(false)
  const [apiFormat, setApiFormat] = useState('openapi')
  const [apiContent, setApiContent] = useState('')
  const [showDbForm, setShowDbForm] = useState(false)
  const [dbConfig, setDbConfig] = useState({
    name: 'Security Storage',
    description: 'Security data storage for Phantix',
    db_type: 'postgresql',
    host: 'localhost',
    port: 5432,
    database_name: 'phantix_security',
    username: 'phantix',
    password: '',
    ssl_mode: 'disable',
    connection_purpose: 'security_data_storage',
    environment: 'production',
    is_primary: true,
  })
  const [selectedAsset, setSelectedAsset] = useState<any>(null)
  const [tags, setTags] = useState<any[]>([])
  const [newTagName, setNewTagName] = useState('')
  const [assetTagsMap, setAssetTagsMap] = useState<Record<number, any[]>>({})

  const { data, isLoading } = useQuery({
    queryKey: ['assets', 'list', assetType, offset],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) })
      if (assetType) params.set('asset_type', assetType)
      const { data } = await api.get(`/assets?${params}`)
      return data as { items: any[]; total: number }
    },
  })

  const assets = data?.items ?? []
  const total = data?.total ?? 0

  const { data: nmapResultsData } = useQuery({
    queryKey: ['scans', 'results', 'nmap'],
    queryFn: async () => {
      const { data } = await api.get('/scans/results?limit=200')
      const items = Array.isArray(data) ? data : data?.items || []
      return items.filter((r: any) => (r.tool || '').toLowerCase() === 'nmap')
    },
    refetchInterval: 30000,
  })

  const nmapByIP = useMemo(() => {
    const map: Record<string, any> = {}
    const results = (nmapResultsData || []).slice().sort((a: any, b: any) => (b.created_at || '').localeCompare(a.created_at || ''))
    for (const r of results) {
      const ip = getNmapIP(r.evidence) || getNmapIP(r) 
      if (ip && !map[ip]) {
        map[ip] = r
      }
    }
    return map
  }, [nmapResultsData])

  // Tags
  useQuery({
    queryKey: ['asset-tags'],
    queryFn: async () => {
      const { data } = await api.get('/asset-tags')
      const items = data?.items || data || []
      setTags(items)
      return items
    },
  })

  // Fetch tags for visible assets
  useEffect(() => {
    const fetchTagsForAssets = async () => {
      const map: Record<number, any[]> = {}
      for (const a of assets) {
        if (a.id) {
          try {
            const { data } = await api.get(`/asset-tags/assets/${a.id}`)
            map[a.id] = data || []
          } catch {}
        }
      }
      setAssetTagsMap(map)
    }
    if (assets.length) fetchTagsForAssets()
  }, [assets])

  const createAsset = useMutation({
    mutationFn: async () => {
      await api.post('/assets', {
        asset_type: form.asset_type,
        value: form.value,
        name: form.name || form.value,
        criticality: form.criticality,
        environment: form.environment || undefined,
        owner: form.owner || undefined,
        confirm_ownership: true,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      setShowForm(false)
      setForm({ asset_type: 'domain', value: '', name: '', criticality: 'medium', environment: '', owner: '' })
      toastSuccess('Asset created')
    },
    onError: (err: any) => toastApiError(err, 'Failed to create asset'),
  })

  const githubSave = useMutation({
    mutationFn: async () => {
      await api.post('/assets/integrations/github', { personal_access_token: githubPat, label: githubLabel })
    },
    onSuccess: () => {
      toastSuccess('GitHub PAT saved')
      setShowGithub(false)
    },
    onError: (err: any) => toastApiError(err, 'Failed to save GitHub PAT'),
  })

  const githubImport = useMutation({
    mutationFn: async () => {
      await api.post('/assets/import/github', githubImportRepo ? { repo: githubImportRepo } : { discover_all: true })
      queryClient.invalidateQueries({ queryKey: ['assets'] })
    },
    onSuccess: () => toastSuccess('GitHub import started'),
    onError: (err: any) => toastApiError(err, 'GitHub import failed'),
  })

  const apiImport = useMutation({
    mutationFn: async () => {
      await api.post('/assets/import/api', {
        format: apiFormat,
        content: apiContent,
        confirm_ownership: true,
      })
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      setShowApiImport(false)
      setApiContent('')
    },
    onSuccess: () => toastSuccess('API import complete'),
    onError: (err: any) => toastApiError(err, 'API import failed'),
  })

  const createDb = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/db-connections', dbConfig)
      return data as { id: number }
    },
  })

  const testDb = useMutation({
    mutationFn: async (id: number) => {
      await api.post(`/db-connections/${id}/test`)
    },
  })

  const bootstrapDb = useMutation({
    mutationFn: async (id: number) => {
      await api.post(`/db-connections/${id}/bootstrap`, {}, { timeout: 180000 })
    },
  })

  const setupDb = useMutation({
    mutationFn: async () => {
      const conn = await createDb.mutateAsync()
      await testDb.mutateAsync(conn.id)
      await bootstrapDb.mutateAsync(conn.id)
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      setShowDbForm(false)
    },
    onSuccess: () => toastSuccess('Database connected and bootstrapped'),
    onError: (err: any) => toastApiError(err, 'Database setup failed'),
  })

  const verifyAsset = useMutation({
    mutationFn: async (id: number) => {
      await api.post(`/assets/${id}/verify`, { confirm_ownership: true })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['assets'] }),
    onError: (err: any) => toastApiError(err, 'Verify failed'),
  })

  const deleteAsset = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/assets/${id}`)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['assets'] }),
  })

  const createTag = useMutation({
    mutationFn: async () => {
      await api.post('/asset-tags', { name: newTagName, color: '#38BDF8' })
      setNewTagName('')
      queryClient.invalidateQueries({ queryKey: ['asset-tags'] })
    },
  })

  const assignTag = useMutation({
    mutationFn: async ({ assetId, tagId }: { assetId: number; tagId: number }) => {
      await api.post(`/asset-tags/assets/${assetId}/assign`, { tag_id: tagId })
      queryClient.invalidateQueries({ queryKey: ['assets'] })
    },
  })

  const unassignTag = useMutation({
    mutationFn: async ({ assetId, tagId }: { assetId: number; tagId: number }) => {
      await api.delete(`/asset-tags/assets/${assetId}/${tagId}`)
      queryClient.invalidateQueries({ queryKey: ['assets'] })
    },
  })

  const filtered = assets.filter((a: any) => !search || a.name?.toLowerCase().includes(search.toLowerCase()) || a.value?.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Assets</h1>
          <p className="text-muted-foreground">Your organization's asset inventory</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setShowApkUpload(!showApkUpload); setShowForm(false) }}>
            <Smartphone className="mr-1 h-4 w-4" /> {showApkUpload ? 'Cancel' : 'Upload APK'}
          </Button>
          <Button onClick={() => { setShowForm(!showForm); setShowApkUpload(false) }}>
            <Plus className="mr-1 h-4 w-4" /> {showForm ? 'Cancel' : 'Add Asset'}
          </Button>
        </div>
      </div>

      <SubPageNav items={[{ label: 'Assets', to: '/assets' }, { label: 'Discovery', to: '/discovery' }]} />

      {/* APK Upload */}
      {showApkUpload && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Upload Android APK</h3>
              <button onClick={() => setShowApkUpload(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <p className="text-xs text-muted-foreground">Upload an APK for static analysis and inventory mapping.</p>
            <FileUpload
              endpoint="/assets/upload/apk"
              accept=".apk"
              maxSizeMB={200}
              label="Select APK file"
              extraFields={{ criticality: 'medium', confirm_ownership: 'true' }}
              onSuccess={() => queryClient.invalidateQueries({ queryKey: ['assets'] })}
            />
          </CardContent>
        </Card>
      )}

      {/* Create Asset Form */}
      {showForm && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">New Asset</h3>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              <div>
                <label className="text-xs font-medium mb-1 block">Type</label>
                <select className="flex h-9 w-full rounded-md border border-input bg-background text-foreground px-3 py-1 text-sm" value={form.asset_type} onChange={(e) => setForm({ ...form, asset_type: e.target.value })}>
                  {ASSET_TYPES.filter(t => t.value).map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Value</label>
                <Input placeholder="example.com" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Display Name</label>
                <Input placeholder="Optional" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Criticality</label>
                <select className="flex h-9 w-full rounded-md border border-input bg-background text-foreground px-3 py-1 text-sm" value={form.criticality} onChange={(e) => setForm({ ...form, criticality: e.target.value })}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Environment</label>
                <Input placeholder="production" value={form.environment} onChange={(e) => setForm({ ...form, environment: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Owner</label>
                <Input placeholder="team@company" value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} />
              </div>
            </div>

            <Button onClick={() => createAsset.mutate()} disabled={!form.value || createAsset.isPending}>
              {createAsset.isPending ? 'Creating...' : 'Create Asset'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Integrations */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => { setShowGithub(!showGithub); setShowApiImport(false); setShowDbForm(false) }}>
          GitHub Integration
        </Button>
        <Button variant="outline" onClick={() => { setShowApiImport(!showApiImport); setShowGithub(false); setShowDbForm(false) }}>
          Import API Spec
        </Button>
        <Button variant="outline" onClick={() => { setShowDbForm(!showDbForm); setShowGithub(false); setShowApiImport(false) }}>
          Add Security DB
        </Button>
      </div>

      {showGithub && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <h3 className="font-semibold">GitHub Integration</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input placeholder="ghp_..." value={githubPat} onChange={e => setGithubPat(e.target.value)} />
              <Input placeholder="label" value={githubLabel} onChange={e => setGithubLabel(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button onClick={() => githubSave.mutate()} disabled={!githubPat || githubSave.isPending}>Save PAT</Button>
              <Input placeholder="owner/repo or leave for all" value={githubImportRepo} onChange={e => setGithubImportRepo(e.target.value)} className="w-64" />
              <Button variant="outline" onClick={() => githubImport.mutate()} disabled={githubImport.isPending}>Import Repos</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {showApiImport && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <h3 className="font-semibold">Import OpenAPI / Postman</h3>
            <div className="flex gap-2">
              <select value={apiFormat} onChange={e => setApiFormat(e.target.value)} className="border p-1 rounded bg-background text-foreground">
                <option value="openapi">OpenAPI</option>
                <option value="postman">Postman</option>
              </select>
              <Button onClick={() => apiImport.mutate()} disabled={!apiContent || apiImport.isPending}>Import</Button>
            </div>
            <textarea value={apiContent} onChange={e => setApiContent(e.target.value)} className="w-full h-32 border rounded p-2 font-mono text-xs" placeholder="Paste JSON/YAML spec here..." />
          </CardContent>
        </Card>
      )}

      {showDbForm && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <h3 className="font-semibold flex items-center gap-2"><Monitor className="h-4 w-4" /> Add Security Database for Analysis</h3>
            <p className="text-xs text-muted-foreground">Connect PostgreSQL for storing scan results, findings, etc. (purpose: security_data_storage)</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className="text-xs">Host</label><Input value={dbConfig.host} onChange={e=>setDbConfig({...dbConfig, host:e.target.value})} /></div>
              <div><label className="text-xs">Port</label><Input type="number" value={dbConfig.port} onChange={e=>setDbConfig({...dbConfig, port:Number(e.target.value)})} /></div>
              <div><label className="text-xs">Database Name</label><Input value={dbConfig.database_name} onChange={e=>setDbConfig({...dbConfig, database_name:e.target.value})} /></div>
              <div><label className="text-xs">Username</label><Input value={dbConfig.username} onChange={e=>setDbConfig({...dbConfig, username:e.target.value})} /></div>
              <div><label className="text-xs">Password</label><Input type="password" value={dbConfig.password} onChange={e=>setDbConfig({...dbConfig, password:e.target.value})} /></div>
              <div><label className="text-xs">SSL Mode</label><Input value={dbConfig.ssl_mode} onChange={e=>setDbConfig({...dbConfig, ssl_mode:e.target.value})} /></div>
            </div>
             <Button onClick={() => setupDb.mutate()} disabled={setupDb.isPending || createDb.isPending || testDb.isPending || bootstrapDb.isPending}>
               {(setupDb.isPending || createDb.isPending || testDb.isPending || bootstrapDb.isPending) ? 'Setting up...' : 'Connect, Test & Bootstrap'}
             </Button>

          </CardContent>
        </Card>
      )}

       {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {ASSET_TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => setAssetType(t.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${assetType === t.value ? 'bg-brand-700 text-white' : 'bg-muted text-muted-foreground hover:bg-accent'}`}
          >
            {t.label}
          </button>
        ))}
        <button onClick={() => { /* could filter verified true */ }} className="rounded-full px-3 py-1 text-xs bg-muted">Verified only</button>
        <div className="relative ml-auto">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="w-48 pl-8 h-8 text-sm" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={[
          { key: 'asset', label: 'Asset', width: '3fr', render: (a: any) => {
            const Icon = typeIcons[a.asset_type] || Globe
            const aTags = assetTagsMap[a.id] || []
            return (
              <div className="flex items-center gap-3 min-w-0 cursor-pointer" onClick={() => setSelectedAsset(a)}>
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="font-medium truncate">{a.name || a.value}</p>
                  <p className="text-xs text-muted-foreground truncate">{a.value}</p>
                  {aTags.length > 0 && <div className="flex gap-1 mt-0.5">{aTags.slice(0,3).map((t:any) => <span key={t.id} className="text-[9px] px-1 bg-muted rounded">{t.name}</span>)}</div>}
                </div>
              </div>
            )
          }},
           { key: 'type', label: 'Type', width: '110px', render: (a: any) => <span className="text-xs text-muted-foreground">{a.asset_type?.replace(/_/g, ' ')}</span> },
           { key: 'nmap', label: 'Nmap (IP)', width: '160px', render: (a: any) => {
             if (a.asset_type !== 'ip_address') return <span className="text-xs text-muted-foreground">—</span>
             const res = nmapByIP[a.value]
             if (!res) return <span className="text-xs text-muted-foreground">no recent nmap</span>
             const summary = summarizeNmap(res.evidence)
             const portsCount = (res.evidence?.open_ports || res.evidence?.port_findings || []).length || (res.evidence?.port ? 1 : 0)
             return (
               <div className="text-xs">
                 <span>{summary || `${portsCount} ports`}</span>
                 {res.severity && res.severity !== 'info' && <SeverityBadge severity={res.severity} />}
               </div>
             )
           }},
           { key: 'criticality', label: 'Criticality', width: '100px', render: (a: any) => <SeverityBadge severity={a.criticality} /> },
          { key: 'verified', label: 'Verified', width: '80px', render: (a: any) => a.is_verified ? <span className="text-green-600 text-xs">✓</span> : <span className="text-xs text-muted-foreground">—</span> },
          { key: 'source', label: 'Source', width: '100px', render: (a: any) => <span className="text-xs text-muted-foreground">{a.source || 'manual'}</span> },
          { key: 'updated', label: 'Updated', width: '120px', render: (a: any) => <span className="text-xs text-muted-foreground">{formatRelativeTime(a.created_at || a.updated_at)}</span> },
          { key: 'actions', label: '', width: '160px', render: (a: any) => (
            <div className="flex gap-1" onClick={e => e.stopPropagation()}>
              <Button size="sm" variant="outline" onClick={() => verifyAsset.mutate(a.id)}>Verify</Button>
              <Button size="sm" variant="outline" onClick={() => deleteAsset.mutate(a.id)}>Del</Button>
              <Button size="sm" onClick={() => setSelectedAsset(a)}>Detail</Button>
            </div>
          )},
        ]}
        data={filtered}
        total={total}
        offset={offset}
        limit={PAGE_SIZE}
        isLoading={isLoading}
        isEmpty={filtered.length === 0}
        emptyIcon={Inbox}
        emptyTitle={search || assetType ? 'No matches' : 'No assets yet'}
        emptyDescription={search || assetType ? 'Try adjusting your filters.' : 'Add your first asset above.'}
        onPageChange={!search ? setOffset : undefined}
        keyExtractor={(a: any) => a.id}
      />

      {/* Tags Management */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-2 items-center mb-2">
            <h3 className="font-semibold text-sm">Tags</h3>
            <Input placeholder="New tag name" value={newTagName} onChange={e=>setNewTagName(e.target.value)} className="w-40 h-7" />
            <Button size="sm" onClick={() => createTag.mutate()} disabled={!newTagName}>Create Tag</Button>
          </div>
          <div className="flex flex-wrap gap-1">
            {tags.map((t: any) => (
              <span key={t.id} className="text-xs px-2 py-0.5 bg-muted rounded flex items-center gap-1">{t.name} <button onClick={() => { /* delete if needed */ }} className="text-red-500">×</button></span>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Asset Detail Modal / Panel */}
      {selectedAsset && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelectedAsset(null)}>
          <div className="bg-background p-6 rounded max-w-2xl w-full m-4" onClick={e=>e.stopPropagation()}>
            <div className="flex justify-between mb-4">
              <h3 className="text-xl font-bold">{selectedAsset.name || selectedAsset.value}</h3>
              <button onClick={() => setSelectedAsset(null)}><X /></button>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>Type: {selectedAsset.asset_type}</div>
              <div>Value: {selectedAsset.value}</div>
              <div>Criticality: <SeverityBadge severity={selectedAsset.criticality} /></div>
              <div>Verified: {selectedAsset.is_verified ? 'Yes' : 'No'}</div>
              <div>Source: {selectedAsset.source}</div>
              <div>Environment: {selectedAsset.environment || '-'}</div>
            </div>
            <div className="mt-4">
              <h4 className="font-medium mb-1">Tags</h4>
              <div className="flex gap-1 flex-wrap mb-2">
                {(assetTagsMap[selectedAsset.id] || []).map((t:any) => (
                  <span key={t.id} className="bg-muted px-2 py-0.5 text-xs rounded flex items-center gap-1">
                    {t.name}
                    <button onClick={() => unassignTag.mutate({assetId: selectedAsset.id, tagId: t.id})} className="text-red-500">×</button>
                  </span>
                ))}
              </div>
              <select onChange={e => { if (e.target.value) assignTag.mutate({assetId: selectedAsset.id, tagId: Number(e.target.value)}) }} className="border p-1 text-xs bg-background text-foreground">
                <option value="">Assign tag...</option>
                {tags.filter((t:any) => !(assetTagsMap[selectedAsset.id]||[]).some((at:any)=>at.id===t.id)).map((t:any) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="mt-4 text-xs text-muted-foreground">
              Metadata: {JSON.stringify(selectedAsset.metadata || {}, null, 2)}
            </div>
            {selectedAsset.asset_type === 'ip_address' && nmapByIP[selectedAsset.value] && (
              <div className="mt-4 border-t pt-3">
                <div className="text-xs font-medium mb-1">Latest Nmap for {selectedAsset.value}</div>
                <div className="text-xs bg-muted/50 p-2 rounded">
                  <ScanEvidence result={nmapByIP[selectedAsset.value]} />
                </div>
              </div>
            )}
            <div className="mt-4 flex gap-2">
              <Button onClick={() => verifyAsset.mutate(selectedAsset.id)}>Re-verify</Button>
              <Button variant="outline" onClick={() => deleteAsset.mutate(selectedAsset.id)}>Delete</Button>
              <Button variant="ghost" onClick={() => setSelectedAsset(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

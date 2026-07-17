import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowRight, Globe, Loader2 } from 'lucide-react'

interface FirstAssetStepProps {
  onComplete: () => void
}

export function FirstAssetStep({ onComplete }: FirstAssetStepProps) {
  const queryClient = useQueryClient()
  const [asset, setAsset] = useState({ asset_type: 'domain', value: '', name: '', criticality: 'medium' })

  const createAsset = useMutation({
    mutationFn: async () => {
      await api.post('/assets', {
        asset_type: asset.asset_type,
        value: asset.value,
        name: asset.name || asset.value,
        criticality: asset.criticality,
        confirm_ownership: true,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org', 'setup'] })
      onComplete()
    },
  })

  const handleSubmit = () => {
    if (!asset.value) return
    createAsset.mutate()
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Globe className="h-5 w-5" /> Add Your First Asset
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Start by adding a domain, IP, or web app to monitor. This unlocks scans and reports.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-xs font-medium mb-1 block">Type</label>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-background text-foreground px-3 py-1 text-sm"
            value={asset.asset_type}
            onChange={(e) => setAsset({ ...asset, asset_type: e.target.value })}
          >
            <option value="domain">Domain</option>
            <option value="ip_address">IP Address</option>
            <option value="web_app">Web App</option>
            <option value="api">API</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block">Value</label>
          <Input
            placeholder="example.com or 192.168.1.1"
            value={asset.value}
            onChange={(e) => setAsset({ ...asset, value: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block">Display Name (optional)</label>
          <Input
            placeholder="Main Website"
            value={asset.name}
            onChange={(e) => setAsset({ ...asset, name: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block">Criticality</label>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-background text-foreground px-3 py-1 text-sm"
            value={asset.criticality}
            onChange={(e) => setAsset({ ...asset, criticality: e.target.value })}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
      </div>

      {createAsset.isError && (
        <p className="text-sm text-destructive">Failed to add asset. Please try again.</p>
      )}

      <Button
        onClick={handleSubmit}
        disabled={!asset.value || createAsset.isPending}
        className="w-full"
      >
        {createAsset.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Adding Asset...
          </>
        ) : (
          <>
            Add Asset & Continue <ArrowRight className="ml-2 h-4 w-4" />
          </>
        )}
      </Button>

      <p className="text-xs text-center text-muted-foreground">
        You can add more assets later from the Assets page.
      </p>
    </div>
  )
}

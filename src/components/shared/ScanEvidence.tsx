import { useState } from 'react'
import { JsonViewer } from './JsonViewer'
import { stripSensitiveEvidence } from '@/lib/format'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface ScanEvidenceProps {
  result: any
}

export function ScanEvidence({ result }: ScanEvidenceProps) {
  const [expanded, setExpanded] = useState(false)
  if (!result) return null

  const tool = (result.tool || '').toLowerCase()
  const ev = stripSensitiveEvidence(result.evidence || {})

  const isNmap = tool === 'nmap' || ev.type === 'nmap' || ev['template-id']?.includes('nmap')

  let content: any = null

  if (isNmap) {
    if (ev['template-id'] === 'nmap-host-summary' || ev.open_ports || ev.port_findings) {
      const ports = ev.open_ports || ev.port_findings || []
      content = (
        <div className="space-y-2 text-sm">
          <div>
            <span className="font-medium">Host:</span> {ev.ip || ev.host} {ev.hostnames?.length ? `(${ev.hostnames.join(', ')})` : ''}
          </div>
          <div className="text-xs text-muted-foreground">
            {ev.nmap_version && `Nmap ${ev.nmap_version} · `}
            {ev.elapsed_seconds && `${ev.elapsed_seconds}s · `}
            {ports.length} open port(s)
          </div>
          {ports.length > 0 && (
            <table className="text-xs w-full border-collapse">
              <thead>
                <tr className="text-muted-foreground border-b">
                  <th className="text-left pr-2">Port</th>
                  <th className="text-left pr-2">Service</th>
                  <th className="text-left">Product / Version</th>
                </tr>
              </thead>
              <tbody>
                {ports.slice(0, 8).map((p: any, i: number) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="pr-2 font-mono">{p.port}/{p.protocol}</td>
                    <td className="pr-2">{p.service}</td>
                    <td>{p.product || ''} {p.version ? `(${p.version})` : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {ports.length > 8 && <div className="text-xs text-muted-foreground">+{ports.length - 8} more</div>}
        </div>
      )
    } else if (ev.port != null) {
      // single port finding
      content = (
        <div className="text-sm space-x-3">
          <span className="font-mono">{ev.port}/{ev.protocol || 'tcp'}</span>
          <span>{ev.service}</span>
          {ev.product && <span className="text-muted-foreground">{ev.product} {ev.version}</span>}
          {ev.cpe?.length > 0 && <span className="text-[10px] text-muted-foreground">cpe:{ev.cpe[0]}</span>}
          {ev.state && <span className="text-xs">({ev.state})</span>}
        </div>
      )
    }
  }

  // Fallback generic normalized view for other tools
  if (!content) {
    const keys = Object.keys(ev).filter(k => !['template-id', 'info', 'finding_types'].includes(k)).slice(0, 6)
    content = (
      <div className="text-sm grid grid-cols-2 gap-x-4 gap-y-1">
        {result.description && <div className="col-span-2 text-foreground/90">{result.description}</div>}
        {keys.map(k => (
          <div key={k} className="flex gap-1 text-xs">
            <span className="text-muted-foreground w-20 shrink-0">{k}:</span>
            <span className="truncate">{typeof ev[k] === 'object' ? JSON.stringify(ev[k]).slice(0,60) : String(ev[k])}</span>
          </div>
        ))}
      </div>
    )
  }

  const cleanedForRaw = stripSensitiveEvidence(result)

  return (
    <div>
      {content}
      <button
        onClick={() => setExpanded(!expanded)}
        className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
      >
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {expanded ? 'hide' : 'show'} sanitized raw
      </button>
      {expanded && <div className="mt-1"><JsonViewer data={cleanedForRaw} collapsed={false} maxHeight={200} /></div>}
    </div>
  )
}

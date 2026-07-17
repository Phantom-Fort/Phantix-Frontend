import { useState } from 'react'
import { ChevronDown, ChevronRight, Copy, Check } from 'lucide-react'

interface JsonViewerProps {
  data: unknown
  collapsed?: boolean
  maxHeight?: number
}

export function JsonViewer({ data, collapsed = false, maxHeight = 400 }: JsonViewerProps) {
  const [isCollapsed, setIsCollapsed] = useState(collapsed)
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-lg border bg-muted/30">
      <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/50">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          {isCollapsed ? 'Show raw data' : 'Hide raw data'}
        </button>
        <button onClick={handleCopy} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      {!isCollapsed && (
        <div className="overflow-auto p-3" style={{ maxHeight }}>
          <pre className="text-xs font-mono leading-relaxed whitespace-pre-wrap text-foreground/80" dangerouslySetInnerHTML={{ __html: renderJson(data) }} />
        </div>
      )}
    </div>
  )
}

function renderJson(data: unknown, indent = ''): string {
  if (data === null || data === undefined) return '<span class="text-muted-foreground">null</span>'
  if (typeof data === 'string') return `<span class="text-green-600 dark:text-green-400">"${escapeHtml(data)}"</span>`
  if (typeof data === 'number') return `<span class="text-blue-600 dark:text-blue-400">${data}</span>`
  if (typeof data === 'boolean') return `<span class="text-purple-600 dark:text-purple-400">${data}</span>`
  if (Array.isArray(data)) {
    if (data.length === 0) return '[]'
    const items = data.map((item) => `${indent}  ${renderJson(item, indent + '  ')}`).join(',\n')
    return `[\n${items}\n${indent}]`
  }
  if (typeof data === 'object') {
    const keys = Object.keys(data as Record<string, unknown>)
    if (keys.length === 0) return '{}'
    const items = keys.map((k) => {
      const val = renderJson((data as Record<string, unknown>)[k], indent + '  ')
      return `${indent}  <span class="text-foreground">"${k}"</span>: ${val}`
    }).join(',\n')
    return `{\n${items}\n${indent}}`
  }
  return String(data)
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

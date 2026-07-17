export function formatDate(raw: string | null | undefined): string {
  if (!raw) return '—'
  try {
    return new Date(raw).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch { return '—' }
}

export function formatDateTime(raw: string | null | undefined): string {
  if (!raw) return '—'
  try {
    return new Date(raw).toLocaleString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return '—' }
}

export function formatRelativeTime(raw: string | null | undefined): string {
  if (!raw) return '—'
  const diff = Date.now() - new Date(raw).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return formatDate(raw)
}

export function normalizeEnum(raw: string | null | undefined): string {
  if (!raw) return '—'
  return raw
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function truncate(str: string | null | undefined, max = 80): string {
  if (!str) return '—'
  return str.length > max ? str.slice(0, max) + '…' : str
}

export function prettyJson(raw: unknown): string {
  try {
    return JSON.stringify(raw, null, 2)
  } catch {
    return String(raw)
  }
}

export function capitalize(str: string): string {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function normalizeAuditEvent(e: any) {
  if (!e) return e
  return {
    ...e,
    action: e.action_label || e.action_key || e.action || e.event_type || `Event #${e.id || ''}`,
    actor: e.initiator_name || e.performed_by || e.actor || '—',
    authorizer: e.authorizer_name || '—',
    time: e.initiated_at || e.created_at || e.completed_at || e.authorised_at,
    summaryText: e.summary || (typeof e.details === 'string' ? e.details : ''),
    category: e.category || 'general',
  }
}

export function normalizeAuditPending(p: any) {
  if (!p) return p
  return {
    ...p,
    action: p.action_label || p.action || `Action #${p.id}`,
    actor: p.initiator_name || p.initiator || '—',
    time: p.initiated_at || p.created_at,
  }
}

const SENSITIVE_EVIDENCE_KEYS = [
  'command',
  'raw_xml',
  'stdout',
  'stderr',
  'used_docker',
  'raw',
  'raw_output',
]

export function stripSensitiveEvidence(ev: any): any {
  if (!ev || typeof ev !== 'object') return ev
  const copy = Array.isArray(ev) ? [...ev] : { ...ev }
  SENSITIVE_EVIDENCE_KEYS.forEach((k) => {
    if (k in copy) delete (copy as any)[k]
  })
  // Recurse for nested
  Object.keys(copy).forEach((k) => {
    const v = (copy as any)[k]
    if (v && typeof v === 'object') {
      (copy as any)[k] = stripSensitiveEvidence(v)
    }
  })
  return copy
}

export function normalizeScanResult(result: any) {
  if (!result) return result
  const cleaned = {
    ...result,
    evidence: stripSensitiveEvidence(result.evidence || {}),
  }
  // Remove top level raw sensitive
  delete cleaned.raw_output
  return cleaned
}

export function getNmapIP(evidence: any): string | null {
  if (!evidence) return null
  return evidence.ip || evidence.host || evidence.matched_at?.split(':')[0] || null
}

export function summarizeNmap(evidence: any): string {
  if (!evidence) return ''
  if (evidence['template-id'] === 'nmap-host-summary' || evidence.open_ports) {
    const count = (evidence.open_ports || evidence.port_findings || []).length
    return `${count} open port${count === 1 ? '' : 's'}`
  }
  if (evidence.port) {
    return `${evidence.port}/${evidence.protocol || 'tcp'} ${evidence.service || ''}`.trim()
  }
  return evidence.title || ''
}

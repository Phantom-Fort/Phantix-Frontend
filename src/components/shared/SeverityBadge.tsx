import { cn } from '@/lib/utils'
import { normalizeEnum } from '@/lib/format'
import { AlertTriangle, ArrowUp, ArrowDown, Info } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const severityConfig: Record<string, { icon: LucideIcon; bg: string; dot: string }> = {
  critical: { icon: AlertTriangle, bg: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800', dot: 'bg-red-500' },
  high: { icon: ArrowUp, bg: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800', dot: 'bg-orange-500' },
  medium: { icon: ArrowDown, bg: 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800', dot: 'bg-yellow-500' },
  low: { icon: Info, bg: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800', dot: 'bg-blue-500' },
  info: { icon: Info, bg: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700', dot: 'bg-gray-400' },
}

export function SeverityBadge({ severity }: { severity: string }) {
  const s = severity.toLowerCase()
  const config = severityConfig[s] || severityConfig.info

  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium', config.bg)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', config.dot)} />
      {normalizeEnum(s)}
    </span>
  )
}

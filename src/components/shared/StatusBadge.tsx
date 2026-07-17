import { cn } from '@/lib/utils'
import { normalizeEnum } from '@/lib/format'
import { CheckCircle2, XCircle, Clock, Play, Pause, FileText, AlertTriangle, CircleDot } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const statusConfig: Record<string, { icon: LucideIcon; bg: string }> = {
  completed: { icon: CheckCircle2, bg: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  complete: { icon: CheckCircle2, bg: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  active: { icon: Play, bg: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  running: { icon: CircleDot, bg: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  pending: { icon: Clock, bg: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' },
  failed: { icon: XCircle, bg: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  cancelled: { icon: XCircle, bg: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  paused: { icon: Pause, bg: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
  draft: { icon: FileText, bg: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' },
  generating: { icon: Clock, bg: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
}

export function StatusBadge({ status, pulse }: { status: string; pulse?: boolean }) {
  const s = status.toLowerCase()
  const config = statusConfig[s]
  const Icon = config?.icon || AlertTriangle
  const bg = config?.bg || 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'

  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', bg, pulse && 'animate-pulse')}>
      {pulse ? <span className="h-1.5 w-1.5 rounded-full bg-current animate-ping" /> : <Icon className="h-3 w-3" />}
      {normalizeEnum(s)}
    </span>
  )
}

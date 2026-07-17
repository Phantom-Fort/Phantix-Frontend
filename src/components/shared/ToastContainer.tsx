import { useToastStore, type ToastType } from '@/store/toast'
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react'

const ICONS: Record<ToastType, any> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
}

const STYLES: Record<ToastType, string> = {
  success: 'border-green-400 bg-green-50 dark:bg-green-900/20',
  error: 'border-red-400 bg-red-50 dark:bg-red-900/20',
  info: 'border-brand-400 bg-brand-50 dark:bg-brand-900/20',
  warning: 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20',
}

const ICON_COLORS: Record<ToastType, string> = {
  success: 'text-green-600',
  error: 'text-red-600',
  info: 'text-brand-600',
  warning: 'text-yellow-600',
}

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore()

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => {
        const Icon = ICONS[t.type]
        return (
          <div
            key={t.id}
            className={`flex items-start gap-3 rounded-lg border p-3 shadow-lg ${STYLES[t.type]}`}
          >
            <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${ICON_COLORS[t.type]}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{t.title}</p>
              {t.message && <p className="text-xs text-muted-foreground mt-0.5">{t.message}</p>}
            </div>
            <button onClick={() => removeToast(t.id)} className="shrink-0 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}

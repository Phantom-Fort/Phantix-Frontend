import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ErrorStateProps {
  title?: string
  message?: string
  onRetry?: () => void
}

export function ErrorState({ title = 'Something went wrong', message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <AlertCircle className="h-10 w-10 text-destructive/60 mb-3" />
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {message && <p className="text-xs text-muted-foreground mt-1 max-w-sm">{message}</p>}
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-4">
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Retry
        </Button>
      )}
    </div>
  )
}

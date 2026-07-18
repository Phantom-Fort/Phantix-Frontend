import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { toastError } from '@/lib/toast'

interface ErrorStateProps {
  title?: string
  message?: string
  onRetry?: () => void
}

/** Errors are shown as toasts only — no inline error copy. */
export function ErrorState({ title = 'Something went wrong', message, onRetry }: ErrorStateProps) {
  const lastKey = useRef('')

  useEffect(() => {
    const key = `${title}|${message || ''}`
    if (key === lastKey.current) return
    lastKey.current = key
    toastError(title, message)
  }, [title, message])

  if (!onRetry) return null

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <Button variant="outline" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  )
}

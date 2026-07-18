import { Component, type ReactNode } from 'react'
import { RefreshCw } from 'lucide-react'
import { toastError } from '@/lib/toast'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error) {
    toastError('Something went wrong', error.message || 'An unexpected error occurred.')
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-1.5 text-sm text-brand-700 hover:underline"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Reload page
            </button>
          </div>
        )
      )
    }
    return this.props.children
  }
}

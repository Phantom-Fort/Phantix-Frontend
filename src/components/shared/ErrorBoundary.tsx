import { Component, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

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

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive mb-3" />
          <h2 className="text-lg font-semibold text-foreground mb-1">Something went wrong</h2>
          <p className="text-sm text-muted-foreground mb-4 max-w-md">
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-1.5 text-sm text-brand-700 hover:underline"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Reload page
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

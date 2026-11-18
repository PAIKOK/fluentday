import type { ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert } from './Alert'

interface LoadStateProps {
  isLoading: boolean
  error: string | null
  onRetry?: () => void
  /** True once data exists; shows children even while refreshing. */
  hasData: boolean
  children: ReactNode
}

/** Standard loading / error wrapper for data-backed sections. */
export function LoadState({ isLoading, error, onRetry, hasData, children }: LoadStateProps) {
  if (error && !hasData) {
    return (
      <Alert tone="error">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>{error}</span>
          {onRetry && (
            <Button size="sm" variant="outline" onClick={onRetry}>
              Try again
            </Button>
          )}
        </div>
      </Alert>
    )
  }
  if (isLoading && !hasData) {
    return (
      <div className="flex justify-center py-16" role="status">
        <Loader2 className="size-6 animate-spin text-forest" />
        <span className="sr-only">Loading</span>
      </div>
    )
  }
  return children
}

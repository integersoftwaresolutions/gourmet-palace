import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Button, Card } from '../ui'
import { DefaultLoader } from './skeletons'

export function QueryError({
  message,
  onRetry,
  className,
}: {
  message: string
  onRetry?: () => void
  className?: string
}) {
  return (
    <Card accentBorder="brand" className={className} role="alert">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-danger-subtle-text">{message}</p>
        {onRetry ? (
          <Button size="sm" variant="outline" onClick={onRetry}>
            Retry
          </Button>
        ) : null}
      </div>
    </Card>
  )
}

function RefreshingBar() {
  return (
    <div className="pointer-events-none absolute inset-x-0 -top-3 h-0.5 overflow-hidden rounded-full bg-card-hover" aria-hidden>
      <div className="h-full w-1/3 animate-pulse bg-accent" />
    </div>
  )
}

export function QueryState<T>({
  data,
  error,
  isLoading,
  isRefreshing = false,
  onRetry,
  loader,
  children,
  className,
}: {
  data: T | null
  error: string | null
  isLoading: boolean
  isRefreshing?: boolean
  onRetry: () => void
  loader?: ReactNode
  children: (data: T) => ReactNode
  className?: string
}) {
  if (isLoading) {
    return (
      <div className={cn('mt-5', className)} role="status" aria-live="polite" aria-busy="true">
        <span className="sr-only">Loading</span>
        {loader ?? <DefaultLoader />}
      </div>
    )
  }

  if (error && data == null) {
    return (
      <div className={cn('mt-5', className)}>
        <QueryError message={error} onRetry={onRetry} />
      </div>
    )
  }

  if (data == null) return null

  return (
    <div className={cn('relative mt-5', className)}>
      {isRefreshing ? <RefreshingBar /> : null}
      {error ? <QueryError message={error} onRetry={onRetry} className="mb-4" /> : null}
      {children(data)}
    </div>
  )
}

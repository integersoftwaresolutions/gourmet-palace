import { cn } from '../../lib/cn'
import { Card } from '../ui'

function Pulse({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-card-hover', className)} />
}

export function DefaultLoader() {
  return (
    <div className="space-y-5" aria-hidden>
      <KpiRowSkeleton count={4} />
      <Card>
        <Pulse className="h-4 w-40" />
        <Pulse className="mt-4 h-24 w-full" />
        <Pulse className="mt-3 h-3 w-2/3" />
      </Card>
    </div>
  )
}

export function KpiRowSkeleton({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('grid gap-4 sm:grid-cols-2 xl:grid-cols-4', count === 3 && 'md:grid-cols-3 xl:grid-cols-3', count === 6 && 'lg:grid-cols-3 min-[1600px]:grid-cols-6', className)}>
      {Array.from({ length: count }, (_, i) => (
        <Card key={i}>
          <Pulse className="h-3 w-24" />
          <Pulse className="mt-4 h-8 w-32" />
          <Pulse className="mt-3 h-3 w-40" />
        </Card>
      ))}
    </div>
  )
}

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <Card>
      <div className="space-y-4">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center justify-between gap-4 border-b border-card-border pb-4 last:border-0 last:pb-0">
            <div className="min-w-0 flex-1">
              <Pulse className="h-4 w-1/2" />
              <Pulse className="mt-2 h-3 w-2/3" />
            </div>
            <Pulse className="h-8 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </Card>
  )
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <Card>
      <Pulse className="mb-4 h-3 w-32" />
      <div className="space-y-3">
        {Array.from({ length: rows }, (_, i) => (
          <Pulse key={i} className="h-10 w-full" />
        ))}
      </div>
    </Card>
  )
}

export function CommandCenterSkeleton() {
  return (
    <div className="space-y-5" aria-hidden>
      <Card padding="lg">
        <Pulse className="h-5 w-40" />
        <Pulse className="mt-4 h-6 w-3/4" />
        <div className="mt-6 grid gap-4 lg:grid-cols-4">
          <Pulse className="h-16" />
          <Pulse className="h-16" />
          <Pulse className="h-16" />
          <Pulse className="h-16" />
        </div>
      </Card>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card padding="lg"><Pulse className="mx-auto size-28 rounded-full" /><Pulse className="mt-4 h-4 w-1/2" /></Card>
        <Card><Pulse className="h-4 w-40" /><div className="mt-4 space-y-3">{Array.from({ length: 5 }, (_, i) => <Pulse key={i} className="h-10 w-full" />)}</div></Card>
      </div>
      <KpiRowSkeleton count={4} />
    </div>
  )
}

export function PerformanceSkeleton() {
  return (
    <div className="space-y-5" aria-hidden>
      <KpiRowSkeleton count={6} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card><Pulse className="h-4 w-32" /><Pulse className="mt-4 h-40 w-full" /></Card>
        <Card><Pulse className="h-4 w-40" /><Pulse className="mt-4 h-40 w-full" /></Card>
      </div>
    </div>
  )
}

export function SplitDetailSkeleton() {
  return (
    <div className="grid gap-5 xl:grid-cols-[18rem_1fr]" aria-hidden>
      <ListSkeleton rows={5} />
      <div className="space-y-5">
        <KpiRowSkeleton count={3} />
        <Card><Pulse className="h-32 w-full" /></Card>
      </div>
    </div>
  )
}

export function DualPanelSkeleton() {
  return (
    <div className="space-y-5" aria-hidden>
      <Card><Pulse className="h-4 w-40" /><Pulse className="mt-4 h-24 w-full" /></Card>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card><Pulse className="h-40 w-full" /></Card>
        <Card><Pulse className="h-40 w-full" /></Card>
      </div>
    </div>
  )
}

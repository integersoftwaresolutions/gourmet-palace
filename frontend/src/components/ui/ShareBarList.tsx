import { cn } from '../../lib/cn'
import { seriesPalette } from './charts/chartTheme'

export type ShareBarItem = {
  key: string
  label: string
  value: number
}

export type ShareBarListProps = {
  items: ShareBarItem[]
  formatValue?: (value: number) => string
  className?: string
  emptyMessage?: string
}

export function ShareBarList({
  items,
  formatValue,
  className,
  emptyMessage = 'No share data is available.',
}: ShareBarListProps) {
  const total = items.reduce((sum, item) => sum + Math.max(0, item.value), 0)
  if (!items.length || total <= 0) {
    return <p className="text-sm text-card-text-muted">{emptyMessage}</p>
  }

  return (
    <div className={cn('space-y-3', className)}>
      {items.map((item, index) => {
        const share = (Math.max(0, item.value) / total) * 100
        return (
          <div key={item.key}>
            <div className="mb-1 flex items-center justify-between gap-3">
              <span className="text-sm text-card-text">{item.label}</span>
              <span className="text-xs tabular-nums text-card-text-muted">
                {formatValue ? `${formatValue(item.value)} · ${share.toFixed(0)}%` : `${share.toFixed(0)}%`}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-card-subtle">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(share, share > 0 ? 2 : 0)}%`,
                  background: seriesPalette[index % seriesPalette.length],
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Card } from '../ui'
import { TrendBadge } from './TrendBadge'

export type CommandCenterMetricProps = {
  label: string
  value: ReactNode
  delta?: number | null
  deltaLabel?: string
  invert?: boolean
  meta?: ReactNode
  className?: string
  hideTrend?: boolean
}

export function CommandCenterMetric({
  label,
  value,
  delta,
  deltaLabel,
  invert = false,
  meta,
  className,
  hideTrend = false,
}: CommandCenterMetricProps) {
  const unavailable = value === 'Unavailable'

  return (
    <Card className={cn('min-w-0 border-card-border bg-card', className)} padding="md" hoverable>
      <p className="truncate text-[10px] font-semibold tracking-[0.2em] text-card-text-faint uppercase">
        {label}
      </p>

      <p
        className={cn(
          'mt-3 truncate font-semibold tracking-tight text-card-text tabular-nums',
          unavailable ? 'text-base text-card-text-muted' : 'text-2xl',
        )}
        title={typeof value === 'string' ? value : undefined}
      >
        {value}
      </p>

      {!hideTrend && (
        <div className="mt-2 flex min-w-0 items-center gap-2">
          <TrendBadge value={delta ?? null} label={deltaLabel} invert={invert} />
        </div>
      )}

      {meta != null && (
        <p className="mt-2 truncate text-[11px] text-card-text-faint">{meta}</p>
      )}
    </Card>
  )
}

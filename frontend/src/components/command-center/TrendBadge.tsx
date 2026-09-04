import { Pill } from '../ui'
import { percent } from '../../lib/format'

export type TrendBadgeProps = {
  value: number | null
  label?: string
  invert?: boolean
  /** Shown when no comparable history exists. Kept short so KPI cards do not overflow. */
  nullLabel?: string
}

export function TrendBadge({
  value,
  label,
  invert = false,
  nullLabel = 'No comparison',
}: TrendBadgeProps) {
  if (value == null) {
    return (
      <Pill
        tone="neutral"
        variant="outline"
        size="sm"
        className="max-w-full truncate"
        title="No comparable history is available for this period"
      >
        {nullLabel}
      </Pill>
    )
  }

  const positive = value >= 0
  const tone = invert
    ? positive
      ? 'danger'
      : 'success'
    : positive
      ? 'success'
      : 'danger'
  const prefix = positive ? '▲' : '▼'

  return (
    <Pill tone={tone} variant="outline" size="sm" className="max-w-full truncate">
      {prefix} {percent(Math.abs(value))}
      {label ? ` ${label}` : ''}
    </Pill>
  )
}

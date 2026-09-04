import { cn } from '../../lib/cn'

export type PriorityChipProps = {
  severity: 'info' | 'warning' | 'critical'
  title: string
  detail: string
  className?: string
}

const dotClass = {
  critical: 'bg-danger',
  warning: 'bg-warning',
  info: 'bg-info',
} as const

export function PriorityChip({ severity, title, detail, className }: PriorityChipProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-2.5 rounded-lg bg-card-subtle px-3 py-2.5',
        className,
      )}
    >
      <span className={cn('size-2 shrink-0 rounded-full', dotClass[severity])} aria-hidden />
      <p className="min-w-0 flex-1 truncate text-sm font-semibold text-card-text">{title}</p>
      <p className="max-w-[55%] shrink-0 truncate text-right text-xs text-card-text-muted">{detail}</p>
    </div>
  )
}

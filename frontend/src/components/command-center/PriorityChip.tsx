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
        'grid min-w-0 grid-cols-[0.5rem_minmax(0,1fr)] items-start gap-x-2.5 gap-y-1 rounded-lg bg-card-subtle px-3 py-2.5',
        className,
      )}
    >
      <span className={cn('mt-1.5 size-2 rounded-full', dotClass[severity])} aria-hidden />
      <p className="min-w-0 break-words text-sm font-semibold text-card-text">{title}</p>
      <p className="col-start-2 min-w-0 break-words text-xs leading-relaxed text-card-text-muted">{detail}</p>
    </div>
  )
}

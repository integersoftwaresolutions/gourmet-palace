import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Pill } from '../ui'
import type { Tone } from '../../lib/tones'

export type AlertRowProps = {
  severity: 'info' | 'warning' | 'critical'
  title: string
  detail: string
  statusLabel?: string
  trailing?: ReactNode
  className?: string
}

const severityTone: Record<AlertRowProps['severity'], Tone> = {
  critical: 'danger',
  warning: 'warning',
  info: 'info',
}

export function AlertRow({
  severity,
  title,
  detail,
  statusLabel,
  trailing,
  className,
}: AlertRowProps) {
  const tone = severityTone[severity]

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 rounded-lg border border-card-border bg-card-subtle/40 px-4 py-3',
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span
          className={cn(
            'mt-1.5 size-2 shrink-0 rounded-full',
            tone === 'danger' && 'bg-danger',
            tone === 'warning' && 'bg-warning',
            tone === 'info' && 'bg-info',
          )}
          aria-hidden
        />
        <div className="min-w-0">
          <p className="text-sm font-medium text-card-text">{title}</p>
          <p className="mt-0.5 text-xs text-card-text-muted">{detail}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {statusLabel && (
          <Pill tone={tone} variant="outline" size="sm">
            {statusLabel}
          </Pill>
        )}
        {trailing}
      </div>
    </div>
  )
}

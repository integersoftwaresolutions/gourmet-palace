import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Card, type CardProps } from './Card'
import { Pill } from './Pill'

export type KpiDelta = {
  value: string
  direction: 'up' | 'down' | 'flat'
}

export type KpiCardProps = Omit<CardProps, 'title' | 'children' | 'footer'> & {
  label: string
  value: ReactNode
  delta?: KpiDelta
  meta?: ReactNode
  pill?: ReactNode
}

const deltaTone = {
  up: 'success',
  down: 'danger',
  flat: 'neutral',
} as const

const deltaPrefix = {
  up: '▲',
  down: '▼',
  flat: '●',
} as const

export function KpiCard({
  label,
  value,
  delta,
  meta,
  pill,
  className,
  ...cardProps
}: KpiCardProps) {
  return (
    <Card
      className={cn(className)}
      hoverable
      padding="md"
      {...cardProps}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-medium tracking-widest text-card-text-faint uppercase">
          {label}
        </p>
        {pill}
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-3">
        <span className="text-2xl font-semibold tracking-tight text-card-text">
          {value}
        </span>
        {delta && (
          <Pill variant="subtle" tone={deltaTone[delta.direction]} size="sm">
            {deltaPrefix[delta.direction]} {delta.value}
          </Pill>
        )}
      </div>

      {meta != null && (
        <p className="mt-2 text-xs text-card-text-muted">{meta}</p>
      )}
    </Card>
  )
}

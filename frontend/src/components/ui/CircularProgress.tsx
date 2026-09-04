import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export type CircularProgressProps = {
  value: number | null
  max?: number
  size?: number
  strokeWidth?: number
  label?: ReactNode
  className?: string
  trackClassName?: string
  progressClassName?: string
}

export function CircularProgress({
  value,
  max = 100,
  size = 96,
  strokeWidth = 8,
  label,
  className,
  trackClassName,
  progressClassName,
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const normalized = value == null ? 0 : Math.max(0, Math.min(max, value))
  const dashOffset = circumference * (1 - normalized / max)

  return (
    <div
      className={cn('relative inline-grid shrink-0 place-items-center', className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={value == null ? 'Value unavailable' : `${normalized} of ${max}`}
    >
      <svg className="-rotate-90" width={size} height={size} aria-hidden>
        <circle
          className={cn('stroke-card-border', trackClassName)}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
        />
        <circle
          className={cn('stroke-accent transition-[stroke-dashoffset] duration-500', progressClassName)}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{label}</div>
    </div>
  )
}

import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/cn'

export type CardAccentBorder = 'accent' | 'brand' | false

export type CardProps = Omit<HTMLAttributes<HTMLDivElement>, 'title'> & {
  title?: ReactNode
  action?: ReactNode
  footer?: ReactNode
  padding?: 'none' | 'sm' | 'md' | 'lg'
  hoverable?: boolean
  accentBorder?: CardAccentBorder
  children?: ReactNode
}

const paddingClasses = {
  none: '',
  sm: 'p-3 sm:p-4',
  md: 'p-4 sm:p-5',
  lg: 'p-4 sm:p-6',
} as const

export function Card({
  className,
  title,
  action,
  footer,
  padding = 'md',
  hoverable = false,
  accentBorder = false,
  children,
  ...props
}: CardProps) {
  const hasHeader = title != null || action != null

  return (
    <div
      className={cn(
        'min-w-0 rounded-xl border bg-card text-card-text',
        accentBorder === 'accent' && 'border-accent-border',
        accentBorder === 'brand' && 'border-brand-border',
        !accentBorder && 'border-card-border',
        hoverable && 'transition-colors hover:bg-card-hover',
        className,
      )}
      {...props}
    >
      {hasHeader && (
        <div
          className={cn(
            'flex min-w-0 flex-wrap items-start justify-between gap-3 sm:items-center',
            padding !== 'none' ? paddingClasses[padding] : 'p-4 sm:p-5',
            children || footer ? 'pb-0' : undefined,
          )}
        >
          {title != null && (
            <div className="min-w-0 text-sm font-semibold tracking-widest break-words text-card-text-faint uppercase">
              {title}
            </div>
          )}
          {action}
        </div>
      )}

      {children != null && (
        <div className={cn(paddingClasses[padding], hasHeader && padding !== 'none' && 'pt-4')}>
          {children}
        </div>
      )}

      {footer != null && (
        <div
          className={cn(
            'border-t border-card-border',
            padding !== 'none' ? paddingClasses[padding] : 'p-4 sm:p-5',
          )}
        >
          {footer}
        </div>
      )}
    </div>
  )
}

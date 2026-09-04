import { useId, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

export type TabItem = {
  id: string
  label: string
  badge?: ReactNode
  disabled?: boolean
}

export type TabsVariant = 'underline' | 'pill'

export type TabsProps = {
  items: TabItem[]
  value: string
  onChange: (id: string) => void
  variant?: TabsVariant
  className?: string
  'aria-label'?: string
}

export function Tabs({
  items,
  value,
  onChange,
  variant = 'underline',
  className,
  'aria-label': ariaLabel = 'Tabs',
}: TabsProps) {
  const baseId = useId()

  const enabled = items.filter((i) => !i.disabled)
  const currentIndex = enabled.findIndex((i) => i.id === value)

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!enabled.length) return
    let next: number | null = null
    if (e.key === 'ArrowRight') next = (currentIndex + 1) % enabled.length
    else if (e.key === 'ArrowLeft')
      next = (currentIndex - 1 + enabled.length) % enabled.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = enabled.length - 1
    if (next == null) return
    e.preventDefault()
    onChange(enabled[next].id)
  }

  if (variant === 'pill') {
    return (
      <div
        role="tablist"
        aria-label={ariaLabel}
        onKeyDown={onKeyDown}
        className={cn(
          'inline-flex items-center gap-1 rounded-full border border-card-border bg-card-subtle p-1',
          className,
        )}
      >
        {items.map((item) => {
          const active = item.id === value
          return (
            <button
              key={item.id}
              id={`${baseId}-${item.id}`}
              type="button"
              role="tab"
              aria-selected={active}
              disabled={item.disabled}
              tabIndex={active ? 0 : -1}
              onClick={() => !item.disabled && onChange(item.id)}
              className={cn(
                'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold tracking-wider uppercase transition-colors',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ring',
                'disabled:cursor-not-allowed disabled:opacity-40',
                active
                  ? 'bg-brand text-brand-text'
                  : 'text-card-text-muted hover:text-card-text',
              )}
            >
              {item.label}
              {item.badge}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={cn(
        'flex items-center gap-6 border-b border-surface-border',
        className,
      )}
    >
      {items.map((item) => {
        const active = item.id === value
        return (
          <button
            key={item.id}
            id={`${baseId}-${item.id}`}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={item.disabled}
            tabIndex={active ? 0 : -1}
            onClick={() => !item.disabled && onChange(item.id)}
            className={cn(
              'relative -mb-px inline-flex items-center gap-2 pb-3 text-xs font-semibold tracking-widest uppercase transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ring',
              'disabled:cursor-not-allowed disabled:opacity-40',
              active
                ? 'text-surface-text after:absolute after:right-0 after:bottom-0 after:left-0 after:h-0.5 after:bg-accent'
                : 'text-surface-text-faint hover:text-surface-text-muted',
            )}
          >
            {item.label}
            {item.badge}
          </button>
        )
      })}
    </div>
  )
}

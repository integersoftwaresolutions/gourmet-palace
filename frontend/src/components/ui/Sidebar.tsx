import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export type SidebarItem = {
  id: string
  label: string
  icon?: ReactNode
  badge?: ReactNode
  active?: boolean
  disabled?: boolean
}

export type SidebarBrand = {
  logo?: ReactNode
  title: string
  subtitle?: string
}

export type SidebarFooter = {
  avatar?: ReactNode
  name: string
  role?: string
}

export type SidebarProps = {
  brand: SidebarBrand
  items: SidebarItem[]
  onNavigate?: (id: string) => void
  footer?: SidebarFooter
  className?: string
}

export function Sidebar({
  brand,
  items,
  onNavigate,
  footer,
  className,
}: SidebarProps) {
  return (
    <aside
      className={cn(
        'flex h-full w-60 shrink-0 flex-col border-r border-canvas-border bg-canvas p-4',
        className,
      )}
    >
      <div className="mb-8 flex items-center gap-3 px-1">
        {brand.logo ?? (
          <div className="flex size-9 items-center justify-center rounded-lg bg-brand text-sm font-bold text-brand-text">
            GP
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-wide text-canvas-text">
            {brand.title}
          </p>
          {brand.subtitle && (
            <p className="truncate text-[11px] tracking-widest text-accent-subtle-text">
              {brand.subtitle}
            </p>
          )}
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1" aria-label="Main">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={item.disabled}
            onClick={() => onNavigate?.(item.id)}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ring',
              'disabled:cursor-not-allowed disabled:opacity-40',
              item.active
                ? 'bg-brand text-brand-text'
                : 'text-canvas-text-muted hover:bg-canvas-hover hover:text-canvas-text active:bg-canvas-active',
            )}
          >
            {item.icon && (
              <span className="inline-flex size-5 shrink-0 items-center justify-center text-[1.1em]">
                {item.icon}
              </span>
            )}
            <span className="flex-1 truncate">{item.label}</span>
            {item.badge}
          </button>
        ))}
      </nav>

      {footer && (
        <div className="mt-auto flex items-center gap-3 border-t border-canvas-border pt-4">
          {footer.avatar ?? (
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-text">
              {footer.name
                .split(' ')
                .map((p) => p[0])
                .slice(0, 2)
                .join('')
                .toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm text-canvas-text">{footer.name}</p>
            {footer.role && (
              <p className="truncate text-xs text-canvas-text-faint">
                {footer.role}
              </p>
            )}
          </div>
        </div>
      )}
    </aside>
  )
}

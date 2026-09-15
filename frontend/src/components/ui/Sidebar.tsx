import type { ReactNode } from 'react'
import { FiLogOut, FiSidebar } from 'react-icons/fi'
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
  onSignOut?: () => void
}

export type SidebarProps = {
  brand: SidebarBrand
  items: SidebarItem[]
  onNavigate?: (id: string) => void
  footer?: SidebarFooter
  className?: string
  collapsed?: boolean
  onToggle?: () => void
}

export function Sidebar({
  brand,
  items,
  onNavigate,
  footer,
  className,
  collapsed = false,
  onToggle,
}: SidebarProps) {
  return (
    <aside
      className={cn(
        'flex h-full w-60 shrink-0 flex-col overflow-hidden border-r border-canvas-border bg-canvas p-4 transition-[width,padding] duration-300 ease-in-out motion-reduce:transition-none',
        collapsed && 'w-20 px-3',
        className,
      )}
    >
      {onToggle && <div className="mb-3 flex shrink-0 justify-end">
        <button type="button" onClick={onToggle} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!collapsed} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} className="flex size-7 items-center justify-center rounded-md text-canvas-text-muted transition-colors hover:bg-canvas-hover hover:text-canvas-text">
          <FiSidebar className="size-4" aria-hidden="true" />
        </button>
      </div>}
      <div className="mb-6 flex shrink-0 items-center gap-3 overflow-hidden px-1">
        {brand.logo ?? (
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand text-sm font-bold text-brand-text">
            GP
          </div>
        )}
        <div aria-hidden={collapsed} className={cn('min-w-0 transition-opacity duration-200 motion-reduce:transition-none', collapsed ? 'opacity-0' : 'opacity-100')}>
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

      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto" aria-label="Main">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={item.disabled}
            aria-label={item.label}
            aria-current={item.active ? 'page' : undefined}
            title={collapsed ? item.label : undefined}
            onClick={() => onNavigate?.(item.id)}
            className={cn(
              'flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors',
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
            <span aria-hidden={collapsed} className={cn('flex-1 truncate transition-opacity duration-200 motion-reduce:transition-none', collapsed ? 'opacity-0' : 'opacity-100')}>{item.label}</span>
            {!collapsed && item.badge}
          </button>
        ))}
      </nav>

      {footer && (
        <div className="mt-4 flex shrink-0 flex-col gap-3 overflow-hidden border-t border-canvas-border pt-4">
          <div title={collapsed ? `${footer.name} · ${footer.role || ''}` : undefined} className="flex items-center gap-3 overflow-hidden">
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
            <div aria-hidden={collapsed} className={cn('min-w-0 transition-opacity duration-200 motion-reduce:transition-none', collapsed ? 'opacity-0' : 'opacity-100')}>
              <p className="truncate text-sm text-canvas-text">{footer.name}</p>
              {footer.role && (
                <p className="truncate text-xs text-canvas-text-faint">
                  {footer.role}
                </p>
              )}
            </div>
          </div>
          {footer.onSignOut && (
            <button
              type="button"
              onClick={footer.onSignOut}
              aria-label="Sign out"
              title="Sign out"
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-canvas-text-muted transition-colors',
                'hover:bg-canvas-hover hover:text-canvas-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ring',
                collapsed && 'justify-center px-0',
              )}
            >
              <FiLogOut className="size-4 shrink-0" aria-hidden="true" />
              <span aria-hidden={collapsed} className={cn('truncate transition-opacity duration-200 motion-reduce:transition-none', collapsed ? 'sr-only opacity-0' : 'opacity-100')}>
                Sign out
              </span>
            </button>
          )}
        </div>
      )}
    </aside>
  )
}

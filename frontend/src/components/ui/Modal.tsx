import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type MouseEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { FiX } from 'react-icons/fi'
import { cn } from '../../lib/cn'

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl'

export type ModalProps = {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children?: ReactNode
  footer?: ReactNode
  size?: ModalSize
  className?: string
}

const sizeClasses: Record<ModalSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-[96vw]',
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  className,
}: ModalProps) {
  const titleId = useId()
  const descId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    previouslyFocused.current = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    const focusables = panel?.querySelectorAll<HTMLElement>(FOCUSABLE)
    focusables?.[0]?.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab' || !panel) return
      const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (!nodes.length) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prevOverflow
      previouslyFocused.current?.focus()
    }
  }, [open])

  if (!open) return null

  const onScrimClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose()
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex cursor-pointer items-end justify-center bg-canvas/65 p-0 sm:items-center sm:p-4"
      onMouseDown={onScrimClick}
      role="presentation"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className={cn(
          'max-h-[92dvh] w-full cursor-auto overflow-y-auto rounded-t-2xl border border-card-border bg-card shadow-xl sm:max-h-[90dvh] sm:rounded-2xl',
          sizeClasses[size],
          className,
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-card-border px-4 py-4 sm:gap-4 sm:px-6">
          <div>
            <h2
              id={titleId}
              className="text-lg font-semibold text-card-text"
            >
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-1 text-sm text-card-text-muted">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-card-text-faint transition-colors hover:bg-card-hover hover:text-card-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ring"
            aria-label="Close"
          >
            <FiX className="size-5" />
          </button>
        </div>

        {children && <div className="px-4 py-4 text-card-text sm:px-6">{children}</div>}

        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-card-border px-4 py-4 sm:px-6">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

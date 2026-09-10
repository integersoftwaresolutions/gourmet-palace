import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../../lib/cn'

export type DrawerProps = {
  open: boolean
  onClose: () => void
  labelledBy: string
  children: ReactNode
  side?: 'left' | 'right'
}

export function Drawer({ open, onClose, labelledBy, children, side = 'right' }: DrawerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current!
    const panel = panelRef.current!
    const backdrop = backdropRef.current!
    if (!open && !dialog.open) return

    if (open) dialog.showModal()
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 280
    const options: KeyframeAnimationOptions = { duration, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' }
    const offscreen = side === 'left' ? 'translateX(-100%)' : 'translateX(100%)'
    const slide = panel.animate(
      { transform: open ? [offscreen, 'translateX(0)'] : ['translateX(0)', offscreen] },
      options,
    )
    const fade = backdrop.animate({ opacity: open ? [0, 1] : [1, 0] }, options)
    slide.onfinish = () => { if (!open) dialog.close() }
    return () => {
      slide.cancel()
      fade.cancel()
    }
  }, [open, side])

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [open])

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-labelledby={labelledBy}
      aria-modal="true"
      onCancel={(event) => { event.preventDefault(); onClose() }}
      className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none overflow-hidden border-0 bg-transparent p-0 text-card-text backdrop:bg-transparent"
    >
      <div ref={backdropRef} className="absolute inset-0 cursor-pointer bg-canvas/65" onClick={onClose} aria-hidden="true" />
      <aside ref={panelRef} className={cn('absolute inset-y-0 flex flex-col border-card-border bg-card shadow-xl', side === 'left' ? 'left-0 w-72 max-w-[85vw] border-r' : 'right-0 w-full max-w-md border-l')}>
        {children}
      </aside>
    </dialog>,
    document.body,
  )
}

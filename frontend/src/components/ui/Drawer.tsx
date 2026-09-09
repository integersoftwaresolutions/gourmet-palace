import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export type DrawerProps = {
  open: boolean
  onClose: () => void
  labelledBy: string
  children: ReactNode
}

export function Drawer({ open, onClose, labelledBy, children }: DrawerProps) {
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
    const slide = panel.animate(
      { transform: open ? ['translateX(100%)', 'translateX(0)'] : ['translateX(0)', 'translateX(100%)'] },
      options,
    )
    const fade = backdrop.animate({ opacity: open ? [0, 1] : [1, 0] }, options)
    slide.onfinish = () => { if (!open) dialog.close() }
    return () => {
      slide.cancel()
      fade.cancel()
    }
  }, [open])

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
      <aside ref={panelRef} className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-card-border bg-card shadow-xl">
        {children}
      </aside>
    </dialog>,
    document.body,
  )
}

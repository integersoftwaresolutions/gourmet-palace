import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  FiAlertTriangle,
  FiCheck,
  FiFileText,
  FiInfo,
  FiX,
  FiZoomIn,
} from 'react-icons/fi'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'
import { Button, Input, Pill, Tabs } from '../components/ui'
import { cn } from '../lib/cn'

type FieldTone = 'success' | 'accent' | 'warning'

type ExtractedField = {
  id: string
  label: string
  value: string
  confidence: string
  tone: FieldTone
  confirm?: boolean
}

const initialFields: ExtractedField[] = [
  {
    id: 'vendor',
    label: 'Vendor',
    value: 'Sysco',
    confidence: '98%',
    tone: 'success',
  },
  {
    id: 'invoice',
    label: 'Invoice #',
    value: 'INV-10482',
    confidence: '99%',
    tone: 'success',
  },
  {
    id: 'date',
    label: 'Invoice date',
    value: '2026-07-28',
    confidence: '97%',
    tone: 'success',
  },
  {
    id: 'location',
    label: 'Location',
    value: 'Sherman Oaks',
    confidence: '82%',
    tone: 'accent',
    confirm: true,
  },
  {
    id: 'total',
    label: 'Total',
    value: '$596.64',
    confidence: '99%',
    tone: 'success',
  },
  {
    id: 'currency',
    label: 'Currency',
    value: 'USD',
    confidence: '99%',
    tone: 'success',
  },
]

const sourceLines = [
  { item: 'Chicken Breast', qty: '40 lb', price: '$3.85', highlight: true },
  { item: 'Jasmine Rice', qty: '2 × 50 lb', price: '$48.00', highlight: false },
  { item: 'Cooking Oil', qty: '6 gal', price: '$72.40', highlight: false },
  { item: 'Beef Chuck', qty: '28 lb', price: '$4.10', highlight: false },
  { item: 'Shrimp 21/25', qty: '12 lb', price: '$9.85', highlight: true },
]

function ConfidencePill({
  label,
  tone,
}: {
  label: string
  tone: FieldTone
}) {
  return (
    <Pill tone={tone} variant="subtle" size="sm">
      {label}
    </Pill>
  )
}

export function InvoiceOCR() {
  const navigate = useNavigate()
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)

  const [fields, setFields] = useState(initialFields)
  const [linePrice, setLinePrice] = useState('$9.85 / lb')
  const [notice, setNotice] = useState<string | null>(null)

  const close = () => navigate('/operations')

  useEffect(() => {
    const panel = panelRef.current
    const focusables = panel?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled])',
    )
    focusables?.[0]?.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prevOverflow
    }
  }, [])

  const updateField = (id: string, value: string) => {
    setFields((prev) =>
      prev.map((field) => (field.id === id ? { ...field, value } : field)),
    )
    setNotice(null)
  }

  const onReject = () => {
    setNotice('Invoice rejected for this session (frontend only).')
  }

  const onSave = () => {
    setNotice('Corrections saved for this session (frontend only).')
  }

  const onApprove = () => {
    setNotice('Invoice approved & committed for this session (frontend only).')
    window.setTimeout(() => navigate('/operations'), 700)
  }

  return (
    <AppShell
      title="Operations"
      subtitle="Upload, OCR review and approval — nothing enters cost analytics unapproved"
      activeNav="operations"
    >
      <div className="pointer-events-none select-none opacity-35">
        <Tabs
          value="invoices"
          onChange={() => undefined}
          items={[
            { id: 'invoices', label: 'Invoices' },
            { id: 'inventory', label: 'Ingredient inventory' },
            { id: 'vendors', label: 'Vendors' },
            { id: 'food-cost', label: 'Food cost' },
          ]}
          className="mb-6"
        />
        <p className="text-sm text-surface-text-muted">
          Review queue · INV-10482 awaiting disposition
        </p>
      </div>

      {createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/70 p-3 sm:p-6"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close()
          }}
        >
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="flex max-h-[min(920px,calc(100vh-2rem))] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-card-border bg-card shadow-xl"
          >
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-card-border px-5 py-4 sm:px-6">
              <div className="flex min-w-0 flex-wrap items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-subtle text-brand-subtle-text">
                  <FiFileText className="size-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h2
                    id={titleId}
                    className="text-sm font-semibold tracking-wide text-card-text uppercase sm:text-base"
                  >
                    Review extracted invoice · INV-10482 · Sysco
                  </h2>
                </div>
                <Pill tone="accent" variant="outline" size="sm">
                  Possible duplicate of INV-10455
                </Pill>
              </div>
              <button
                type="button"
                onClick={close}
                className="rounded-lg p-1.5 text-card-text-faint transition-colors hover:bg-card-hover hover:text-card-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ring"
                aria-label="Close"
              >
                <FiX className="size-5" />
              </button>
            </div>

            {notice && (
              <p className="border-b border-success-border bg-success-subtle px-5 py-2 text-sm text-success-subtle-text sm:px-6">
                {notice}
              </p>
            )}

            <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-2">
              <section className="border-b border-card-border p-5 sm:p-6 lg:border-r lg:border-b-0">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-[11px] font-medium tracking-widest text-card-text-faint uppercase">
                  <span>Source document · Page 1 of 2</span>
                  <span className="inline-flex items-center gap-1.5">
                    <FiZoomIn className="size-3.5" aria-hidden />
                    Zoom
                  </span>
                </div>

                <div className="rounded-xl border border-card-border bg-[#f3ebe0] p-5 text-[#2a2118] shadow-inner">
                  <div className="mb-4 flex items-start justify-between gap-3 border-b border-[#d8cbb8] pb-3">
                    <div>
                      <p className="text-lg font-semibold tracking-wide">
                        SYSCO
                      </p>
                      <p className="mt-1 text-xs text-[#6b5b4a]">
                        Foodservice · Delivery invoice
                      </p>
                    </div>
                    <div className="text-right text-xs">
                      <p className="font-semibold">INV-10482</p>
                      <p className="text-[#6b5b4a]">07/28/2026</p>
                    </div>
                  </div>

                  <p className="mb-3 text-xs text-[#6b5b4a]">
                    Ship to · Gourmet Palace · Sherman Oaks
                  </p>

                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-[#d8cbb8] text-left text-[10px] tracking-wider text-[#6b5b4a] uppercase">
                        <th className="py-2 pr-2 font-medium">Item</th>
                        <th className="py-2 pr-2 font-medium">Qty</th>
                        <th className="py-2 text-right font-medium">Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sourceLines.map((line) => (
                        <tr
                          key={line.item}
                          className={cn(
                            'border-b border-[#e6dccf]',
                            line.highlight && 'bg-[#f0d9a8]/70',
                          )}
                        >
                          <td className="py-2.5 pr-2 font-medium">{line.item}</td>
                          <td className="py-2.5 pr-2 text-[#6b5b4a]">
                            {line.qty}
                          </td>
                          <td className="py-2.5 text-right tabular-nums">
                            {line.price}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="mt-4 flex justify-end border-t border-[#d8cbb8] pt-3 text-sm font-semibold">
                    Total · $596.64
                  </div>
                </div>
              </section>

              <section className="flex flex-col gap-5 p-5 sm:p-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  {fields.map((field) => (
                    <div key={field.id} className="flex flex-col gap-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label
                          htmlFor={`ocr-${field.id}`}
                          className="text-[11px] font-medium tracking-widest text-card-text-faint uppercase"
                        >
                          {field.label}
                        </label>
                        <ConfidencePill
                          tone={field.tone}
                          label={
                            field.confirm
                              ? `${field.confidence} Confirm`
                              : field.confidence
                          }
                        />
                      </div>
                      <Input
                        id={`ocr-${field.id}`}
                        value={field.value}
                        onChange={(e) => updateField(field.id, e.target.value)}
                        size="sm"
                      />
                    </div>
                  ))}
                </div>

                <div className="rounded-xl border border-accent-border bg-accent-subtle/40 p-4">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[11px] font-medium tracking-widest text-card-text uppercase">
                      Line 5 — Shrimp 21/25 · Unit price
                    </p>
                    <ConfidencePill
                      tone="warning"
                      label="61% · Low confidence"
                    />
                  </div>
                  <Input
                    value={linePrice}
                    onChange={(e) => {
                      setLinePrice(e.target.value)
                      setNotice(null)
                    }}
                    size="sm"
                  />
                </div>

                <div className="flex gap-3 rounded-xl border border-card-border bg-canvas/40 px-4 py-3">
                  <FiAlertTriangle
                    className="mt-0.5 size-4 shrink-0 text-accent-subtle-text"
                    aria-hidden
                  />
                  <p className="text-sm text-card-text-muted">
                    Arithmetic check: line 5 qty × unit = $118.20 · total within
                    tolerance · 1 field needs your confirmation.
                  </p>
                </div>

                <div className="rounded-xl border border-card-border px-4 py-3">
                  <p className="mb-1 text-[11px] font-medium tracking-widest text-card-text-faint uppercase">
                    Duplicate check
                  </p>
                  <div className="flex gap-2">
                    <FiInfo
                      className="mt-0.5 size-4 shrink-0 text-success-subtle-text"
                      aria-hidden
                    />
                    <p className="text-sm text-card-text">
                      Not a duplicate — different delivery (INV-10455 was Jul
                      25).
                    </p>
                  </div>
                </div>

                <p className="text-xs text-card-text-faint">
                  Nothing enters cost analytics until you approve. Corrections
                  are audited (before/after).
                </p>
              </section>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-card-border px-5 py-4 sm:px-6">
              <p className="text-xs text-card-text-faint">
                Extraction: ocr-1.0 · high-risk fields always shown
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" tone="neutral" size="sm" onClick={onReject}>
                  Reject
                </Button>
                <Button variant="outline" tone="neutral" size="sm" onClick={onSave}>
                  Save corrections
                </Button>
                <Button
                  tone="brand"
                  size="sm"
                  leftIcon={<FiCheck className="size-3.5" />}
                  onClick={onApprove}
                >
                  Approve & commit
                </Button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </AppShell>
  )
}

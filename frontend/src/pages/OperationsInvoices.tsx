import { useRef, useState, type PointerEvent } from 'react'
import { AppShell } from '../components/layout/AppShell'
import { OperationsTabs } from '../components/layout/SectionTabs'
import { QueryError, QueryState, ListSkeleton } from '../components/query'
import { Button, Card, Input, Modal, Pill, Select } from '../components/ui'
import { invoicesApi, type InvoiceAdjustment, type InvoiceLine, type InvoiceRecord } from '../lib/api'
import { asyncMessage } from '../lib/asyncError'
import { useAsyncResource } from '../hooks/useAsyncResource'
import { generalDate, money } from '../lib/format'
import { useAppState } from '../context/useAppState'

const centsInput = (value: number | null) => value == null ? '' : (value / 100).toFixed(2)
const toCents = (value: string) => value.trim() === '' ? null : Math.round(Number(value) * 100)

function OriginalInvoiceViewer({ invoice }: { invoice: InvoiceRecord }) {
  const [zoom, setZoom] = useState(1)
  const viewport = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null)
  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!viewport.current) return
    drag.current = { x: event.clientX, y: event.clientY, left: viewport.current.scrollLeft, top: viewport.current.scrollTop }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current || !viewport.current) return
    viewport.current.scrollLeft = drag.current.left - (event.clientX - drag.current.x)
    viewport.current.scrollTop = drag.current.top - (event.clientY - drag.current.y)
  }
  if (!invoice.sourceUrl) return <p className="text-card-text-muted">The original file is unavailable.</p>
  if (invoice.mimeType === 'application/pdf') return <iframe title="Original invoice PDF" src={invoice.sourceUrl} className="h-[70vh] w-full rounded-lg bg-white" />
  return <div>
    <div className="mb-3 flex items-center justify-between"><p className="text-sm text-card-text-muted">Drag the image to inspect details.</p><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setZoom((value) => Math.max(.5, value - .25))}>−</Button><Button size="sm" variant="outline" onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</Button><Button size="sm" variant="outline" onClick={() => setZoom((value) => Math.min(4, value + .25))}>+</Button></div></div>
    <div ref={viewport} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }} className="flex h-[68vh] w-full cursor-grab items-start justify-center overflow-auto rounded-lg bg-black/70 active:cursor-grabbing">
      <img src={invoice.sourceUrl} alt={invoice.originalName || 'Original invoice'} draggable={false} className="max-w-none select-none object-contain" style={{ width: `${zoom * 100}%`, minHeight: '100%' }} />
    </div>
  </div>
}

function SavedInvoiceData({ invoice }: { invoice: InvoiceRecord }) {
  return <div className="space-y-4"><div className="grid gap-2 sm:grid-cols-3"><p>Vendor: {invoice.vendorName || '—'}</p><p>Invoice number: {invoice.invoiceNumber || '—'}</p><p>Date: {invoice.invoiceDate || '—'}</p><p>Subtotal: {money(invoice.subtotalMoney, 2)}</p><p>Tax: {money(invoice.taxMoney, 2)}</p><p>Total: {money(invoice.totalMoney, 2)}</p></div>
    <div><p className="font-medium">Saved line items ({invoice.lineItems?.length || 0})</p><table className="mt-2 w-full table-fixed text-left text-xs"><thead><tr><th className="w-2/5">Description</th><th>Qty</th><th>Unit</th><th>Unit price</th><th>Total</th></tr></thead><tbody>{invoice.lineItems?.map((line) => <tr key={line._id} className="border-t border-card-border"><td className="break-words py-2 pr-2">{line.description}</td><td>{line.quantity}</td><td>{line.unit}</td><td>{money(line.unitPrice, 2)}</td><td>{money(line.totalMoney, 2)}</td></tr>)}</tbody></table></div>
    <div><p className="font-medium">Saved adjustments ({invoice.adjustments?.length || 0})</p>{invoice.adjustments?.map((row) => <p key={row._id || `${row.type}-${row.label}`}>{row.label} ({row.type}): {money(row.amountMoney, 2)}</p>)}</div>
  </div>
}

function InvoiceReviewForm({ invoice, onSaved }: { invoice: InvoiceRecord; onSaved: () => void }) {
  const [vendorName, setVendorName] = useState(invoice.vendorName || '')
  const [invoiceNumber, setInvoiceNumber] = useState(invoice.invoiceNumber || '')
  const [invoiceDate, setInvoiceDate] = useState(invoice.invoiceDate || '')
  const [subtotal, setSubtotal] = useState(centsInput(invoice.subtotalMoney))
  const [tax, setTax] = useState(centsInput(invoice.taxMoney))
  const [total, setTotal] = useState(centsInput(invoice.totalMoney))
  const [lines, setLines] = useState<InvoiceLine[]>(invoice.lineItems || [])
  const [adjustments, setAdjustments] = useState<InvoiceAdjustment[]>(invoice.adjustments || (invoice.taxMoney == null ? [] : [{ label: 'Tax', type: 'tax', amountMoney: invoice.taxMoney }]))
  const [overrideReason, setOverrideReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const lineTotal = lines.reduce((sum, line) => sum + Number(line.totalMoney || 0), 0)
  const subtotalCents = toCents(subtotal)
  const taxCents = toCents(tax)
  const totalCents = toCents(total)
  const linesMismatch = subtotalCents != null && Math.abs(lineTotal - subtotalCents) > 1
  const adjustmentsTotal = adjustments.reduce((sum, row) => sum + Number(row.amountMoney || 0), 0)
  const totalMismatch = subtotalCents != null && totalCents != null && Math.abs(subtotalCents + adjustmentsTotal - totalCents) > 1
  const setLine = (index: number, patch: Partial<InvoiceLine>) => setLines((current) => current.map((line, i) => i === index ? { ...line, ...patch } : line))
  const saveAndApprove = async () => {
    setSaving(true); setFormError('')
    try {
      await invoicesApi.review(invoice._id, { vendorName, invoiceNumber, invoiceDate, subtotalMoney: subtotalCents, taxMoney: taxCents, totalMoney: totalCents, lineItems: lines, adjustments, reconciliationOverrideReason: overrideReason, highRiskConfirmed: true, duplicateDisposition: invoice.duplicateCandidateIds?.length ? 'not_duplicate' : '' })
      await invoicesApi.approve(invoice._id)
      onSaved()
    } catch (error) { setFormError(asyncMessage(error, 'Unable to approve invoice')) }
    finally { setSaving(false) }
  }
  return <div className="mt-3 rounded-lg border border-card-border p-4 text-sm">
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <label>Vendor<Input value={vendorName} onChange={(e) => setVendorName(e.target.value)} /></label>
      <label>Invoice number<Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} /></label>
      <label>Invoice date<Input value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} /></label>
      <label>Subtotal ($)<Input type="number" step="0.01" value={subtotal} onChange={(e) => setSubtotal(e.target.value)} /></label>
      <label>Tax ($)<Input type="number" step="0.01" value={tax} onChange={(e) => setTax(e.target.value)} /></label>
      <label>Total ($)<Input type="number" step="0.01" value={total} onChange={(e) => setTotal(e.target.value)} /></label>
    </div>
    {(linesMismatch || totalMismatch) && <div className="mt-4 rounded-lg border border-red-500 bg-red-950/40 p-3 text-red-200"><p className="font-semibold">Invoice totals do not reconcile</p>{linesMismatch && <p>Line items total {money(lineTotal, 2)}, but subtotal is {money(subtotalCents, 2)}.</p>}{totalMismatch && <p>Subtotal plus adjustments is {money((subtotalCents || 0) + adjustmentsTotal, 2)}, but total is {money(totalCents, 2)}.</p>}<p className="mt-1 text-xs">Add/correct an adjustment, or provide an explicit override reason.</p><Input className="mt-2" placeholder="Override reason (required to approve mismatch)" value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} /></div>}
    {invoice.sourceUrl && <a className="mt-3 inline-block text-brand underline" href={invoice.sourceUrl} target="_blank" rel="noreferrer">Open original invoice</a>}
    <p className="mt-4 font-medium">Extracted line items ({lines.length})</p>
    <div className="mt-2 overflow-x-auto"><table className="w-full min-w-[850px] text-left text-xs"><thead><tr><th>Description</th><th>Qty</th><th>Unit</th><th>Unit price ($)</th><th>Total ($)</th><th>Category</th></tr></thead><tbody>{lines.map((line, index) => <tr key={line._id || index} className="border-t border-card-border"><td><Input size="sm" value={line.description || ''} onChange={(e) => setLine(index, { description: e.target.value })} /></td><td><Input size="sm" type="number" step="any" value={line.quantity ?? ''} onChange={(e) => setLine(index, { quantity: e.target.value === '' ? null : Number(e.target.value) })} /></td><td><Input size="sm" value={line.unit || ''} onChange={(e) => setLine(index, { unit: e.target.value })} /></td><td><Input size="sm" type="number" step="0.01" value={centsInput(line.unitPrice)} onChange={(e) => setLine(index, { unitPrice: toCents(e.target.value) })} /></td><td><Input size="sm" type="number" step="0.01" value={centsInput(line.totalMoney)} onChange={(e) => setLine(index, { totalMoney: toCents(e.target.value) })} /></td><td><Input size="sm" value={line.category || ''} onChange={(e) => setLine(index, { category: e.target.value })} /></td></tr>)}</tbody></table></div>
    {formError && <p className="mt-3 text-red-300">{formError}</p>}
    <p className="mt-4 font-medium">Charges, discounts & adjustments ({adjustments.length})</p>
    <div className="mt-2 space-y-2">{adjustments.map((row, index) => <div className="grid grid-cols-[1fr_150px_150px_auto] gap-2" key={row._id || index}><Input value={row.label} onChange={(e) => setAdjustments((all) => all.map((x, i) => i === index ? { ...x, label: e.target.value } : x))} /><Input value={row.type} onChange={(e) => setAdjustments((all) => all.map((x, i) => i === index ? { ...x, type: e.target.value } : x))} /><Input type="number" step="0.01" value={centsInput(row.amountMoney)} onChange={(e) => setAdjustments((all) => all.map((x, i) => i === index ? { ...x, amountMoney: toCents(e.target.value) || 0 } : x))} /><Button size="sm" variant="outline" onClick={() => setAdjustments((all) => all.filter((_, i) => i !== index))}>Remove</Button></div>)}</div>
    <Button className="mt-2" size="sm" variant="outline" onClick={() => setAdjustments((all) => [...all, { label: '', type: 'other', amountMoney: 0 }])}>Add adjustment</Button>
    <div className="mt-4 flex items-center justify-between"><p className="text-card-text-muted">Line items total: {money(lineTotal, 2)} · Adjustments: {money(adjustmentsTotal, 2)}</p><Button disabled={saving || linesMismatch || (totalMismatch && !overrideReason.trim())} onClick={() => void saveAndApprove()}>{saving ? 'Saving…' : 'Save & approve'}</Button></div>
  </div>
}

export function OperationsInvoices() {
  const { query, locations, selectedLocationId } = useAppState()
  const { data, error, isLoading, isRefreshing, reload } = useAsyncResource(
    () => invoicesApi.list(query).then((r) => r.data.invoices),
    [query],
    { fallbackError: 'Unable to load invoices' },
  )
  const [actionError, setActionError] = useState('')
  const [reviewId, setReviewId] = useState<string | null>(null)
  const [sourceId, setSourceId] = useState<string | null>(null)
  const [sourceView, setSourceView] = useState<'original' | 'data'>('data')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadLocation, setUploadLocation] = useState(selectedLocationId === 'all' ? '' : selectedLocationId)
  const [uploadError, setUploadError] = useState('')
  const [uploading, setUploading] = useState(false)
  const selectedReview = data?.find((row) => row._id === reviewId)
  const selectedSource = data?.find((row) => row._id === sourceId)
  const selectedDelete = data?.find((row) => row._id === deleteId)
  const upload = async (file: File | null) => {
    if (!file || !uploadLocation) return
    setUploading(true); setUploadError('')
    try {
      const base64 = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result || '').split(',')[1] || ''); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file) })
      await invoicesApi.upload({ locationId: uploadLocation, fileName: file.name, mimeType: file.type, base64 })
      setUploadOpen(false); reload()
    } catch (error) { setUploadError(asyncMessage(error, 'Invoice upload failed')) }
    finally { setUploading(false) }
  }

  const names = Object.fromEntries(locations.map((l) => [l.id, l.name]))
  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn()
      setActionError('')
      reload()
    } catch (e) {
      setActionError(asyncMessage(e, 'Invoice action failed'))
    }
  }
  return (
    <AppShell title="Invoices" subtitle="Approved invoices only feed food-cost and vendor spend" activeNav="operations" actions={<Button size="sm" onClick={() => setUploadOpen(true)}>Upload invoice</Button>}>
      <OperationsTabs value="invoices" />
      {actionError ? <QueryError message={actionError} className="mt-4" /> : null}
      <QueryState data={data} error={error} isLoading={isLoading} isRefreshing={isRefreshing} onRetry={reload} loader={<ListSkeleton />}>
        {(rows) => (
        <Card>
          {rows.length === 0 ? <p className="text-sm text-card-text-muted">No invoices in this scope.</p> : false && rows.map((invoice) => (
            <div key={invoice._id} className="flex flex-wrap items-center justify-between gap-3 border-b border-card-border py-3 last:border-0">
              <div className="text-left">
                <p className="text-sm font-medium text-card-text">{invoice.vendorName || 'Unknown vendor'} · {invoice.invoiceNumber || 'No number'}</p>
                <p className="text-xs text-card-text-muted">{generalDate(invoice.invoiceDate)} · {names[invoice.locationId] || invoice.locationId} · {money(invoice.totalMoney)}</p>
              </div>
              <div className="flex items-center gap-2">
                <Pill tone={invoice.status === 'APPROVED' ? 'success' : invoice.status === 'FAILED' || invoice.status === 'REJECTED' ? 'danger' : 'warning'} variant="outline">{invoice.status}</Pill>
                <Button size="sm" variant="outline" onClick={() => { setSourceView('original'); setSourceId(invoice._id) }}>View invoice</Button>
                {['PENDING_REVIEW', 'FAILED'].includes(invoice.status) && <Button size="sm" onClick={() => setReviewId(invoice._id)}>Review</Button>}
                {invoice.status !== 'APPROVED' && invoice.status !== 'REJECTED' && <Button size="sm" variant="outline" onClick={() => void act(() => invoicesApi.reject(invoice._id, 'Rejected in Operations'))}>Reject</Button>}
                {invoice.status !== 'APPROVED' && <Button size="sm" variant="outline" onClick={() => setDeleteId(invoice._id)}>Delete</Button>}
              </div>
              {false && ['PENDING_REVIEW', 'FAILED'].includes(invoice.status) && <InvoiceReviewForm invoice={invoice} onSaved={reload} />}
              {false && !['PENDING_REVIEW', 'FAILED'].includes(invoice.status) && <div className="mt-3 rounded-lg border border-card-border p-4 text-sm">
                <div className="grid gap-2 sm:grid-cols-2"><p>Vendor: {invoice.vendorName || '—'}</p><p>Invoice number: {invoice.invoiceNumber || '—'}</p><p>Invoice date: {invoice.invoiceDate || '—'}</p><p>Subtotal: {money(invoice.subtotalMoney)}</p><p>Tax: {money(invoice.taxMoney)}</p><p>Total: {money(invoice.totalMoney)}</p></div>
                {invoice.sourceUrl && <a className="mt-3 inline-block text-brand underline" href={invoice.sourceUrl} target="_blank" rel="noreferrer">Open original invoice</a>}
                <p className="mt-4 font-medium">Extracted line items ({invoice.lineItems?.length || 0})</p>
                {invoice.lineItems?.length ? <div className="mt-2 overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr><th>Description</th><th>Qty</th><th>Unit</th><th>Unit price</th><th>Total</th></tr></thead><tbody>{invoice.lineItems.map((line) => <tr key={line._id}><td>{line.description || '—'}</td><td>{line.quantity ?? '—'}</td><td>{line.unit || '—'}</td><td>{money(line.unitPrice)}</td><td>{money(line.totalMoney)}</td></tr>)}</tbody></table></div> : <p className="mt-2 text-xs text-card-text-muted">No line items were extracted.</p>}
                {Boolean(invoice.ocrFields?.error) && <p className="mt-3 text-xs text-red-300">Extraction error: {String(invoice.ocrFields.error)}</p>}
              </div>}
            </div>
          ))}
          {rows.length > 0 && <div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-sm">
            <thead><tr className="border-b border-card-border text-[11px] uppercase tracking-[.16em] text-card-text-muted"><th className="pb-4 pr-4">Vendor</th><th className="pb-4 pr-4">Invoice #</th><th className="pb-4 pr-4">Date</th><th className="pb-4 pr-4">Location</th><th className="pb-4 pr-4">Total</th><th className="pb-4 pr-4">Status</th><th className="pb-4 text-right">Actions</th></tr></thead>
            <tbody>{rows.map((invoice) => <tr key={invoice._id} className="border-b border-card-border last:border-0"><td className="py-4 pr-4 font-semibold text-card-text">{invoice.vendorName || 'Unknown vendor'}</td><td className="py-4 pr-4 text-card-text-muted">{invoice.invoiceNumber || 'No number'}</td><td className="py-4 pr-4 text-card-text-muted">{generalDate(invoice.invoiceDate)}</td><td className="py-4 pr-4 text-card-text-muted">{names[invoice.locationId] || invoice.locationId}</td><td className="py-4 pr-4 font-semibold text-card-text">{money(invoice.totalMoney, 2)}</td><td className="py-4 pr-4"><Pill size="md" tone={invoice.status === 'APPROVED' ? 'success' : invoice.status === 'FAILED' || invoice.status === 'REJECTED' ? 'danger' : 'warning'}>{invoice.status === 'PENDING_REVIEW' ? 'Review required' : invoice.status.replaceAll('_', ' ')}</Pill></td><td className="py-4"><div className="flex justify-end gap-2"><Button size="sm" variant="outline" onClick={() => { setSourceView('original'); setSourceId(invoice._id) }}>View</Button>{['PENDING_REVIEW', 'FAILED'].includes(invoice.status) && <Button size="sm" onClick={() => setReviewId(invoice._id)}>Review</Button>}{invoice.status !== 'APPROVED' && invoice.status !== 'REJECTED' && <Button size="sm" variant="outline" onClick={() => void act(() => invoicesApi.reject(invoice._id, 'Rejected in Operations'))}>Reject</Button>}{invoice.status !== 'APPROVED' && <Button size="sm" variant="ghost" onClick={() => setDeleteId(invoice._id)}>Delete</Button>}</div></td></tr>)}</tbody>
          </table></div>}
        </Card>
        )}
      </QueryState>
      <Modal open={Boolean(selectedSource)} onClose={() => setSourceId(null)} title="Invoice" description={`${selectedSource?.originalName || ''} · ${selectedSource?.status || ''}`} size="xl">
    <div className="mb-4 flex gap-2"><Button size="sm" variant={sourceView === 'original' ? 'fill' : 'outline'} onClick={() => setSourceView('original')}>Original invoice</Button><Button size="sm" variant={sourceView === 'data' ? 'fill' : 'outline'} onClick={() => setSourceView('data')}>Saved data</Button></div>
        {selectedSource && (sourceView === 'original' ? <OriginalInvoiceViewer invoice={selectedSource} /> : <SavedInvoiceData invoice={selectedSource} />)}
      </Modal>
      <Modal open={uploadOpen} onClose={() => !uploading && setUploadOpen(false)} title="Upload invoice" description="Upload a PDF, JPG, or PNG for extraction." size="sm">
        <div className="space-y-4"><div><p className="mb-1 text-xs text-card-text-muted">Canonical location</p><Select value={uploadLocation} onChange={setUploadLocation} options={locations.filter((location) => location.status === 'active').map((location) => ({ value: location.id, label: location.name }))} /></div>{uploadError && <p className="text-sm text-red-300">{uploadError}</p>}<label className={`inline-flex h-10 items-center rounded-lg bg-brand px-4 text-sm font-semibold text-brand-text ${uploadLocation && !uploading ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}>{uploading ? 'Uploading…' : 'Choose invoice file'}<input type="file" accept="application/pdf,image/jpeg,image/png" disabled={!uploadLocation || uploading} className="hidden" onChange={(event) => void upload(event.target.files?.[0] || null)} /></label></div>
      </Modal>
      <Modal open={Boolean(selectedReview)} onClose={() => setReviewId(null)} title="Review invoice" description="Correct extracted values, adjustments, and line items before approval." size="xl">
        {selectedReview && <InvoiceReviewForm invoice={selectedReview} onSaved={() => { setReviewId(null); reload() }} />}
      </Modal>
      <Modal open={Boolean(selectedDelete)} onClose={() => setDeleteId(null)} title="Delete invoice" description="This action cannot be undone." size="sm" footer={<><Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button><Button onClick={() => { if (selectedDelete) void act(() => invoicesApi.remove(selectedDelete._id)); setDeleteId(null) }}>Delete invoice</Button></>}>
        <p>Delete <strong>{selectedDelete?.vendorName || 'this invoice'}</strong> and its uploaded source file?</p>
      </Modal>
    </AppShell>
  )
}

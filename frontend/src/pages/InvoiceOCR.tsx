import { useState } from 'react'
import { AppShell } from '../components/layout/AppShell'
import { OperationsTabs } from '../components/layout/SectionTabs'
import { QueryError } from '../components/query'
import { Card, Modal, Select } from '../components/ui'
import { invoicesApi } from '../lib/api'
import { asyncMessage } from '../lib/asyncError'
import { useAppState } from '../context/useAppState'

export function InvoiceOCR() {
  const { locations, selectedLocationId } = useAppState()
  const [locationId, setLocationId] = useState(selectedLocationId === 'all' ? '' : selectedLocationId)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  // This route is opened by the primary Operations "Upload invoice" action.
  // Open the modal immediately so there is no duplicate upload button on the page.
  const [open, setOpen] = useState(true)

  const upload = async (file: File | null) => {
    if (!file || !locationId) return
    setError(''); setNotice('Uploading and extracting…')
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => resolve(String(r.result || '').split(',')[1] || '')
        r.onerror = () => reject(r.error)
        r.readAsDataURL(file)
      })
      const res = await invoicesApi.upload({ locationId, fileName: file.name, mimeType: file.type, base64 })
      setNotice(`Invoice ${res.data.invoice.invoiceNumber || res.data.invoice._id} stored as ${res.data.invoice.status}.`)
      setOpen(false)
    } catch (e) {
      setNotice(''); setError(asyncMessage(e, 'Upload failed'))
    }
  }

  return (
    <AppShell title="Invoice OCR" subtitle="PDF/JPG/PNG originals stay private; OCR is a candidate until human confirmation" activeNav="operations">
      <OperationsTabs value="invoices" />
      {error && <QueryError message={error} className="mt-4" />}
      {notice && <Card accentBorder="accent" className="mt-4"><p className="text-sm text-card-text-muted">{notice}</p></Card>}
      <Modal open={open} onClose={() => setOpen(false)} title="Upload invoice" description="Upload a PDF, JPG, or PNG for extraction." size="sm">
        <div>
        <div className="max-w-sm">
          <p className="mb-1 text-xs text-card-text-muted">Canonical location</p>
          <Select value={locationId} onChange={setLocationId} options={locations.filter((l) => l.status === 'active').map((l) => ({ value: l.id, label: l.name }))} />
        </div>
        <label className="mt-4 inline-flex h-10 cursor-pointer items-center rounded-lg bg-brand px-4 text-sm font-semibold text-brand-text">
          Upload invoice
          <input type="file" accept="application/pdf,image/jpeg,image/png" className="hidden" onChange={(e) => void upload(e.target.files?.[0] || null)} />
        </label>
        </div>
      </Modal>
    </AppShell>
  )
}

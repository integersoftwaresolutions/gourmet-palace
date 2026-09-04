import { useRef, useState, type FormEvent } from 'react'
import { FiEdit3, FiPlus, FiUpload } from 'react-icons/fi'
import { useNavigate } from 'react-router-dom'
import {
  Button,
  Card,
  Input,
  Modal,
  Pill,
  Select,
  Table,
  Tabs,
  type TableColumn,
} from '../components/ui'
import { AppShell } from '../components/layout/AppShell'

type InvoiceStatus = 'Review required' | 'Processing' | 'Approved'
type EntryMode = 'upload' | 'manual'

type InvoiceRow = {
  vendor: string
  invoice: string
  date: string
  location: string
  total: string
  status: InvoiceStatus
  reviewNote: string
} & Record<string, unknown>

const initialInvoices: InvoiceRow[] = [
  {
    vendor: 'Sysco',
    invoice: 'INV-10482',
    date: 'Jul 28',
    location: 'Sherman Oaks',
    total: '$2,214.80',
    status: 'Review required',
    reviewNote: 'Possible dup',
  },
  {
    vendor: 'US Foods',
    invoice: 'INV-88231',
    date: 'Jul 28',
    location: 'Woodland Hills',
    total: '$1,806.12',
    status: 'Processing',
    reviewNote: '',
  },
  {
    vendor: 'Sysco',
    invoice: 'INV-10455',
    date: 'Jul 25',
    location: 'Simi Valley',
    total: '$2,001.44',
    status: 'Approved',
    reviewNote: '',
  },
  {
    vendor: 'Pacific Produce',
    invoice: 'PP-3312',
    date: 'Jul 25',
    location: 'Sherman Oaks',
    total: '$684.20',
    status: 'Approved',
    reviewNote: '',
  },
]

const statusTone = {
  'Review required': 'accent',
  Processing: 'info',
  Approved: 'success',
} as const

const vendorOptions = [
  { value: 'Sysco', label: 'Sysco' },
  { value: 'US Foods', label: 'US Foods' },
  { value: 'Pacific Produce', label: 'Pacific Produce' },
  { value: 'Other', label: 'Other' },
]

const locationOptions = [
  { value: 'Sherman Oaks', label: 'Sherman Oaks' },
  { value: 'Woodland Hills', label: 'Woodland Hills' },
  { value: 'Simi Valley', label: 'Simi Valley' },
]

function buildInvoiceColumns(
  onReview: (invoice: string) => void,
): TableColumn<InvoiceRow>[] {
  return [
    {
      key: 'vendor',
      header: 'Vendor',
      render: (row) => (
        <span className="font-medium text-card-text">{row.vendor}</span>
      ),
    },
    {
      key: 'invoice',
      header: 'Invoice #',
      render: (row) =>
        row.status === 'Review required' ? (
          <button
            type="button"
            onClick={() => onReview(row.invoice)}
            className="tabular-nums text-accent-subtle-text underline-offset-2 hover:underline"
          >
            {row.invoice}
          </button>
        ) : (
          <span className="tabular-nums text-card-text-muted">{row.invoice}</span>
        ),
    },
    {
      key: 'date',
      header: 'Date',
      render: (row) => (
        <span className="text-card-text-muted">{row.date}</span>
      ),
    },
    {
      key: 'location',
      header: 'Location',
      render: (row) => (
        <span className="text-card-text">{row.location}</span>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      render: (row) => (
        <span className="font-semibold tabular-nums text-card-text">
          {row.total}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Pill tone={statusTone[row.status]} variant="outline" size="sm">
          {row.status}
        </Pill>
      ),
    },
    {
      key: 'reviewNote',
      header: 'Review note',
      render: (row) =>
        row.reviewNote ? (
          <button
            type="button"
            onClick={() => onReview(row.invoice)}
            className="text-xs font-semibold tracking-wider text-accent-subtle-text uppercase underline-offset-2 hover:underline"
          >
            {row.reviewNote}
          </button>
        ) : (
          <span className="text-card-text-faint">—</span>
        ),
    },
  ]
}

function formatToday() {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(new Date())
}

function formatAmount(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return '—'
  return trimmed.startsWith('$') ? trimmed : `$${trimmed}`
}

function nextInvoiceNumber(existing: InvoiceRow[]) {
  const nums = existing
    .map((row) => {
      const match = row.invoice.match(/(\d+)$/)
      return match ? Number(match[1]) : 0
    })
    .filter((n) => Number.isFinite(n))
  const max = nums.length ? Math.max(...nums) : 10000
  return `INV-${max + 1}`
}

export function OperationsInvoices() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [rows, setRows] = useState<InvoiceRow[]>(initialInvoices)
  const [entryOpen, setEntryOpen] = useState(false)
  const [entryMode, setEntryMode] = useState<EntryMode>('upload')
  const [vendor, setVendor] = useState('Sysco')
  const [location, setLocation] = useState('Sherman Oaks')
  const [total, setTotal] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceDate, setInvoiceDate] = useState('')
  const [reviewNote, setReviewNote] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const openEntry = (mode: EntryMode) => {
    setEntryMode(mode)
    setEntryOpen(true)
  }

  const resetForm = () => {
    setVendor('Sysco')
    setLocation('Sherman Oaks')
    setTotal('')
    setInvoiceNumber('')
    setInvoiceDate('')
    setReviewNote('')
    setFileName(null)
    setFormError(null)
    setSubmitting(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const closeEntry = () => {
    setEntryOpen(false)
    resetForm()
  }

  const queueInvoice = (next: InvoiceRow) => {
    setSubmitting(true)
    window.setTimeout(() => {
      setRows((prev) => [next, ...prev])
      closeEntry()
    }, 400)
  }

  const onSubmitUpload = (e?: FormEvent) => {
    e?.preventDefault()
    if (!fileName) {
      setFormError('Choose an invoice file to continue.')
      return
    }

    queueInvoice({
      vendor,
      invoice: nextInvoiceNumber(rows),
      date: formatToday(),
      location,
      total: formatAmount(total),
      status: 'Processing',
      reviewNote: '',
    })
  }

  const onSubmitManual = (e?: FormEvent) => {
    e?.preventDefault()
    if (!invoiceNumber.trim()) {
      setFormError('Invoice number is required.')
      return
    }
    if (!total.trim()) {
      setFormError('Total is required for manual entry.')
      return
    }
    if (rows.some((row) => row.invoice === invoiceNumber.trim())) {
      setFormError('That invoice number is already in the list.')
      return
    }

    queueInvoice({
      vendor,
      invoice: invoiceNumber.trim(),
      date: invoiceDate.trim() || formatToday(),
      location,
      total: formatAmount(total),
      status: 'Review required',
      reviewNote: reviewNote.trim() || 'Manual entry',
    })
  }

  const isUpload = entryMode === 'upload'

  const columns = buildInvoiceColumns(() => {
    navigate('/operations/invoice-ocr')
  })

  return (
    <AppShell
      title="Operations"
      subtitle="Upload, OCR review and approval — nothing enters cost analytics unapproved"
      activeNav="operations"
    >
      <div className="flex flex-col gap-5">
        <Tabs
          value="invoices"
          onChange={(id) => {
            if (id === 'invoices') navigate('/operations')
            if (id === 'inventory') navigate('/operations/inventory')
            if (id === 'vendors') navigate('/operations/vendors')
            if (id === 'food-cost') navigate('/operations/food-cost')
          }}
          items={[
            { id: 'invoices', label: 'Invoices' },
            { id: 'inventory', label: 'Ingredient inventory' },
            { id: 'vendors', label: 'Vendors' },
            { id: 'food-cost', label: 'Food cost' },
          ]}
        />

        <div className="flex flex-wrap items-center gap-3">
          <Button
            tone="brand"
            size="sm"
            leftIcon={<FiPlus className="size-3.5" />}
            onClick={() => openEntry('upload')}
          >
            Upload invoice
          </Button>
          <Button
            variant="outline"
            size="sm"
            tone="neutral"
            leftIcon={<FiEdit3 className="size-3.5" />}
            onClick={() => openEntry('manual')}
          >
            Manual entry
          </Button>
          <Pill tone="neutral" variant="subtle" size="md">
            Email intake · invoices@gourmetpalace.com
          </Pill>
        </div>

        <Table rows={rows} columns={columns} getRowKey={(row) => row.invoice} />

        <Card accentBorder="accent" padding="md">
          <div className="flex items-start gap-3">
            <span
              className="mt-1 size-2 shrink-0 rotate-45 bg-accent"
              aria-hidden
            />
            <p className="text-sm text-card-text">
              Nothing enters cost analytics until you approve it. INV-10482 may
              duplicate INV-10455 (same vendor and a similar total), so it needs
              your disposition.
            </p>
          </div>
        </Card>
      </div>

      <Modal
        open={entryOpen}
        onClose={closeEntry}
        title={isUpload ? 'Upload invoice' : 'Manual invoice entry'}
        description={
          isUpload
            ? 'File stays on this device for now. OCR review is simulated locally — nothing is sent to the server.'
            : 'Enter invoice details by hand. The row is queued locally for review — nothing is sent to the server.'
        }
        footer={
          <>
            <Button variant="outline" onClick={closeEntry}>
              Cancel
            </Button>
            <Button
              tone="brand"
              loading={submitting}
              leftIcon={
                isUpload ? (
                  <FiUpload className="size-3.5" />
                ) : (
                  <FiEdit3 className="size-3.5" />
                )
              }
              onClick={() =>
                isUpload ? onSubmitUpload() : onSubmitManual()
              }
            >
              {isUpload ? 'Queue for review' : 'Add manual entry'}
            </Button>
          </>
        }
      >
        <Tabs
          variant="pill"
          value={entryMode}
          onChange={(id) => {
            setEntryMode(id as EntryMode)
            setFormError(null)
          }}
          aria-label="Invoice entry mode"
          className="mb-4"
          items={[
            { id: 'upload', label: 'Upload file' },
            { id: 'manual', label: 'Manual entry' },
          ]}
        />

        {isUpload ? (
          <form
            className="flex flex-col gap-4"
            onSubmit={onSubmitUpload}
            noValidate
          >
            <div>
              <p className="mb-1.5 text-[11px] font-medium tracking-widest text-card-text-faint uppercase">
                Invoice file
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                className="block w-full text-sm text-card-text-muted file:mr-3 file:rounded-full file:border-0 file:bg-brand file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-brand-text hover:file:bg-brand-hover"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null
                  setFileName(file?.name ?? null)
                  setFormError(null)
                }}
              />
              {fileName && (
                <p className="mt-2 text-xs text-card-text-muted">
                  Selected: {fileName}
                </p>
              )}
            </div>

            <Select
              label="Vendor"
              value={vendor}
              onChange={setVendor}
              options={vendorOptions}
            />

            <Select
              label="Location"
              value={location}
              onChange={setLocation}
              options={locationOptions}
            />

            <Input
              label="Total (optional)"
              placeholder="e.g. 1240.00"
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              hint="Leave blank if OCR should fill this later."
            />

            {formError && (
              <p className="text-xs text-danger-subtle-text">{formError}</p>
            )}
          </form>
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={onSubmitManual}
            noValidate
          >
            <Input
              label="Invoice #"
              placeholder="e.g. INV-10510"
              value={invoiceNumber}
              onChange={(e) => {
                setInvoiceNumber(e.target.value)
                setFormError(null)
              }}
              required
            />

            <Select
              label="Vendor"
              value={vendor}
              onChange={setVendor}
              options={vendorOptions}
            />

            <Select
              label="Location"
              value={location}
              onChange={setLocation}
              options={locationOptions}
            />

            <Input
              label="Date"
              placeholder="e.g. Aug 12"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              hint={`Leave blank to use today (${formatToday()}).`}
            />

            <Input
              label="Total"
              placeholder="e.g. 1240.00"
              value={total}
              onChange={(e) => {
                setTotal(e.target.value)
                setFormError(null)
              }}
              required
            />

            <Input
              label="Review note (optional)"
              placeholder="e.g. Hand-entered from paper invoice"
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
            />

            {formError && (
              <p className="text-xs text-danger-subtle-text">{formError}</p>
            )}
          </form>
        )}
      </Modal>
    </AppShell>
  )
}

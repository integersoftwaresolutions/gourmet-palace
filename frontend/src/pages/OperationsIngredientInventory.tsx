import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiCheck, FiPlus } from 'react-icons/fi'
import {
  Button,
  Input,
  Modal,
  Pill,
  Select,
  Table,
  Tabs,
  type TableColumn,
} from '../components/ui'
import { AppShell } from '../components/layout/AppShell'
import { cn } from '../lib/cn'
import { useAuth } from '../context/useAuth'

type StockStatus = 'Critical' | 'Low' | 'OK'

type InventoryRow = {
  item: string
  unit: string
  onHand: number
  par: number
  daysLeft: number
  cost: string
  vendor: string
  lastUpdated: string
  status: StockStatus
} & Record<string, unknown>

const initialInventory: InventoryRow[] = [
  {
    item: 'Chicken breast',
    unit: 'lb',
    onHand: 12,
    par: 40,
    daysLeft: 1.4,
    cost: '$4.04/lb',
    vendor: 'Sysco',
    lastUpdated: 'Jul 29 · M. Chen',
    status: 'Critical',
  },
  {
    item: 'Jasmine rice',
    unit: 'case',
    onHand: 9,
    par: 12,
    daysLeft: 6.2,
    cost: '$38.50',
    vendor: 'US Foods',
    lastUpdated: 'Jul 29 · M. Chen',
    status: 'Low',
  },
  {
    item: 'Cooking oil',
    unit: 'gal',
    onHand: 22,
    par: 20,
    daysLeft: 11.0,
    cost: '$21.10',
    vendor: 'Sysco',
    lastUpdated: 'Jul 28 · R. Diaz',
    status: 'OK',
  },
  {
    item: 'Shrimp 21/25',
    unit: 'lb',
    onHand: 31,
    par: 35,
    daysLeft: 3.8,
    cost: '$9.85',
    vendor: 'Pacific Seafood',
    lastUpdated: 'Jul 29 · M. Chen',
    status: 'OK',
  },
  {
    item: 'Takeout boxes (lg)',
    unit: 'case',
    onHand: 14,
    par: 18,
    daysLeft: 8.5,
    cost: '$52.00',
    vendor: 'China Direct',
    lastUpdated: 'Jul 27 · R. Diaz',
    status: 'OK',
  },
]

const statusTone = {
  Critical: 'danger',
  Low: 'warning',
  OK: 'success',
} as const

function navigateOperationsTab(
  navigate: ReturnType<typeof useNavigate>,
  id: string,
) {
  if (id === 'invoices') navigate('/operations')
  if (id === 'inventory') navigate('/operations/inventory')
  if (id === 'vendors') navigate('/operations/vendors')
  if (id === 'food-cost') navigate('/operations/food-cost')
}

const operationsTabs = [
  { id: 'invoices', label: 'Invoices' },
  { id: 'inventory', label: 'Ingredient inventory' },
  { id: 'vendors', label: 'Vendors' },
  { id: 'food-cost', label: 'Food cost' },
]

const unitOptions = [
  { value: 'lb', label: 'lb' },
  { value: 'case', label: 'case' },
  { value: 'gal', label: 'gal' },
  { value: 'each', label: 'each' },
]

const vendorOptions = [
  { value: 'Sysco', label: 'Sysco' },
  { value: 'US Foods', label: 'US Foods' },
  { value: 'Pacific Seafood', label: 'Pacific Seafood' },
  { value: 'China Direct', label: 'China Direct' },
  { value: 'Other', label: 'Other' },
]

function deriveStatus(onHand: number, par: number): StockStatus {
  if (par <= 0) return 'OK'
  const ratio = onHand / par
  if (ratio < 0.4) return 'Critical'
  if (ratio < 0.85) return 'Low'
  return 'OK'
}

function estimateDaysLeft(onHand: number, par: number) {
  if (onHand <= 0) return 0
  // Simple frontend estimate: par roughly equals ~10 days of use.
  const dailyUse = Math.max(par / 10, 0.1)
  return Math.round((onHand / dailyUse) * 10) / 10
}

function formatTodayStamp(name?: string) {
  const date = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(new Date())
  const initials = (name || 'User')
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  return `${date} · ${initials || 'U'}`
}

function formatCost(value: string, unit: string) {
  const trimmed = value.trim()
  if (!trimmed) return '—'
  if (trimmed.includes('/')) return trimmed.startsWith('$') ? trimmed : `$${trimmed}`
  const withDollar = trimmed.startsWith('$') ? trimmed : `$${trimmed}`
  return unit === 'lb' || unit === 'gal' ? `${withDollar}/${unit}` : withDollar
}

const columns: TableColumn<InventoryRow>[] = [
  {
    key: 'item',
    header: 'Item',
    render: (row) => (
      <span className="font-medium text-card-text">{row.item}</span>
    ),
  },
  {
    key: 'unit',
    header: 'Unit',
    render: (row) => (
      <span className="text-card-text-muted">{row.unit}</span>
    ),
  },
  {
    key: 'onHand',
    header: 'On hand',
    align: 'right',
    render: (row) => (
      <span className="tabular-nums text-card-text">{row.onHand}</span>
    ),
  },
  {
    key: 'par',
    header: 'Par',
    align: 'right',
    render: (row) => (
      <span className="tabular-nums text-card-text-muted">{row.par}</span>
    ),
  },
  {
    key: 'daysLeft',
    header: 'Days left',
    align: 'right',
    render: (row) => (
      <span
        className={cn(
          'font-semibold tabular-nums',
          row.status === 'Critical'
            ? 'text-danger-subtle-text'
            : 'text-card-text',
        )}
      >
        {row.daysLeft.toFixed(1)}
      </span>
    ),
  },
  {
    key: 'cost',
    header: 'Cost',
    align: 'right',
    render: (row) => (
      <span className="tabular-nums text-card-text">{row.cost}</span>
    ),
  },
  {
    key: 'vendor',
    header: 'Vendor',
    render: (row) => (
      <span className="text-card-text-muted">{row.vendor}</span>
    ),
  },
  {
    key: 'lastUpdated',
    header: 'Last updated',
    render: (row) => (
      <span className="text-xs text-card-text-muted">{row.lastUpdated}</span>
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
]

export function OperationsIngredientInventory() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [items, setItems] = useState<InventoryRow[]>(initialInventory)

  const [addOpen, setAddOpen] = useState(false)
  const [itemName, setItemName] = useState('')
  const [unit, setUnit] = useState('lb')
  const [onHand, setOnHand] = useState('')
  const [par, setPar] = useState('')
  const [daysLeft, setDaysLeft] = useState('')
  const [cost, setCost] = useState('')
  const [vendor, setVendor] = useState('Sysco')
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const rows = lowStockOnly
    ? items.filter((row) => row.status !== 'OK')
    : items

  const resetForm = () => {
    setItemName('')
    setUnit('lb')
    setOnHand('')
    setPar('')
    setDaysLeft('')
    setCost('')
    setVendor('Sysco')
    setFormError(null)
    setSubmitting(false)
  }

  const closeAdd = () => {
    setAddOpen(false)
    resetForm()
  }

  const onSubmitAdd = (e?: FormEvent) => {
    e?.preventDefault()

    const name = itemName.trim()
    const onHandNum = Number(onHand)
    const parNum = Number(par)
    const daysLeftNum = daysLeft.trim() === '' ? NaN : Number(daysLeft)

    if (!name) {
      setFormError('Item name is required.')
      return
    }
    if (items.some((row) => row.item.toLowerCase() === name.toLowerCase())) {
      setFormError('That item is already in inventory.')
      return
    }
    if (!Number.isFinite(onHandNum) || onHandNum < 0) {
      setFormError('On hand must be a valid number.')
      return
    }
    if (!Number.isFinite(parNum) || parNum <= 0) {
      setFormError('Par must be greater than zero.')
      return
    }
    if (
      daysLeft.trim() !== '' &&
      (!Number.isFinite(daysLeftNum) || daysLeftNum < 0)
    ) {
      setFormError('Days left must be a valid number.')
      return
    }

    const status = deriveStatus(onHandNum, parNum)
    const next: InventoryRow = {
      item: name,
      unit,
      onHand: onHandNum,
      par: parNum,
      daysLeft: Number.isFinite(daysLeftNum)
        ? Math.round(daysLeftNum * 10) / 10
        : estimateDaysLeft(onHandNum, parNum),
      cost: formatCost(cost, unit),
      vendor,
      lastUpdated: formatTodayStamp(user?.name),
      status,
    }

    setSubmitting(true)
    window.setTimeout(() => {
      setItems((prev) => [next, ...prev])
      closeAdd()
    }, 300)
  }

  return (
    <AppShell
      title="Operations"
      subtitle="Manual ingredient counts with clear par levels, provenance and days-remaining estimates"
      activeNav="operations"
    >
      <div className="flex flex-col gap-5">
        <Tabs
          value="inventory"
          onChange={(id) => navigateOperationsTab(navigate, id)}
          items={operationsTabs}
        />

        <div className="flex flex-wrap items-center gap-3">
          <Button
            tone="brand"
            size="sm"
            leftIcon={<FiCheck className="size-3.5" />}
          >
            Log stock count
          </Button>
          <Button
            variant="outline"
            size="sm"
            tone="neutral"
            leftIcon={<FiPlus className="size-3.5" />}
            onClick={() => setAddOpen(true)}
          >
            Add item
          </Button>
          <Pill tone="neutral" variant="subtle" size="md">
            {items.length} of ~45 core items tracked · manual entry
          </Pill>
          <button
            type="button"
            onClick={() => setLowStockOnly((v) => !v)}
            className="ml-auto"
          >
            <Pill
              tone={lowStockOnly ? 'accent' : 'neutral'}
              variant="outline"
              size="md"
            >
              Low stock only · {lowStockOnly ? 'On' : 'Off'}
            </Pill>
          </button>
        </div>

        <Table
          rows={rows}
          columns={columns}
          getRowKey={(row) => row.item}
        />

        <p className="text-xs text-surface-text-muted">
          Days remaining uses mapped-item sales as an estimate. Automated
          reordering, transfers and recipe-level depletion are V2.
        </p>
      </div>

      <Modal
        open={addOpen}
        onClose={closeAdd}
        title="Add inventory item"
        description="Adds the item to this session’s inventory list only — nothing is sent to the server."
        footer={
          <>
            <Button variant="outline" onClick={closeAdd}>
              Cancel
            </Button>
            <Button
              tone="brand"
              loading={submitting}
              leftIcon={<FiPlus className="size-3.5" />}
              onClick={() => onSubmitAdd()}
            >
              Add item
            </Button>
          </>
        }
      >
        <form className="flex flex-col gap-4" onSubmit={onSubmitAdd} noValidate>
          <Input
            label="Item"
            placeholder="e.g. Sesame oil"
            value={itemName}
            onChange={(e) => {
              setItemName(e.target.value)
              setFormError(null)
            }}
            required
          />

          <Select
            label="Unit"
            value={unit}
            onChange={setUnit}
            options={unitOptions}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="On hand"
              type="number"
              min={0}
              step="any"
              placeholder="e.g. 12"
              value={onHand}
              onChange={(e) => {
                setOnHand(e.target.value)
                setFormError(null)
              }}
              required
            />
            <Input
              label="Par"
              type="number"
              min={0}
              step="any"
              placeholder="e.g. 20"
              value={par}
              onChange={(e) => {
                setPar(e.target.value)
                setFormError(null)
              }}
              required
            />
          </div>

          <Input
            label="Days left"
            type="number"
            min={0}
            step="any"
            placeholder="e.g. 6.2"
            value={daysLeft}
            onChange={(e) => {
              setDaysLeft(e.target.value)
              setFormError(null)
            }}
            hint="Leave blank to estimate from on hand and par."
          />

          <Input
            label="Cost (optional)"
            placeholder="e.g. 4.50"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
          />

          <Select
            label="Vendor"
            value={vendor}
            onChange={setVendor}
            options={vendorOptions}
          />

          {formError && (
            <p className="text-xs text-danger-subtle-text">{formError}</p>
          )}
        </form>
      </Modal>
    </AppShell>
  )
}

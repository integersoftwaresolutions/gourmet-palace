import { useNavigate } from 'react-router-dom'
import { Card, Pill, Tabs } from '../components/ui'
import { AppShell } from '../components/layout/AppShell'
import { cn } from '../lib/cn'

type VendorItem = {
  label: string
  price: string
  trend?: 'up-danger' | 'up-warning'
}

type VendorCard = {
  name: string
  summary: string
  badge: { label: string; tone: 'danger' | 'success' | 'accent' }
  items: VendorItem[]
}

const vendors: VendorCard[] = [
  {
    name: 'Sysco',
    summary: '142 normalized items · 3 locations',
    badge: { label: '+18% chicken', tone: 'danger' },
    items: [
      { label: 'Chicken breast /lb', price: '$4.04', trend: 'up-danger' },
      { label: 'Jasmine rice /case', price: '$38.50' },
      { label: 'Cooking oil /gal', price: '$21.10' },
    ],
  },
  {
    name: 'US Foods',
    summary: '98 normalized items · 2 locations',
    badge: { label: 'Stable', tone: 'success' },
    items: [
      { label: 'Shrimp 21/25 /lb', price: '$9.62' },
      { label: 'Beef chuck /lb', price: '$6.18' },
      { label: 'Noodles /case', price: '$29.40' },
    ],
  },
  {
    name: 'Pacific Produce',
    summary: '61 normalized items · 3 locations',
    badge: { label: '+9% produce', tone: 'accent' },
    items: [
      { label: 'Bok choy /lb', price: '$2.86', trend: 'up-warning' },
      { label: 'Scallions /lb', price: '$3.10' },
      { label: 'Ginger /lb', price: '$4.02' },
    ],
  },
]

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

export function OperationsVendors() {
  const navigate = useNavigate()

  return (
    <AppShell
      title="Operations"
      subtitle="Normalized price visibility by vendor and unit across restaurant locations"
      activeNav="operations"
    >
      <div className="flex flex-col gap-5">
        <Tabs
          value="vendors"
          onChange={(id) => navigateOperationsTab(navigate, id)}
          items={operationsTabs}
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {vendors.map((vendor) => (
            <Card key={vendor.name} padding="lg">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-card-text">
                    {vendor.name}
                  </h2>
                  <p className="mt-1 text-xs text-card-text-muted">
                    {vendor.summary}
                  </p>
                </div>
                <Pill tone={vendor.badge.tone} variant="outline" size="sm">
                  {vendor.badge.label}
                </Pill>
              </div>

              <ul className="mt-5 flex flex-col divide-y divide-card-border">
                {vendor.items.map((item) => (
                  <li
                    key={item.label}
                    className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <span className="text-sm text-card-text-muted">
                      {item.label}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold tabular-nums text-card-text">
                      {item.trend && (
                        <span
                          className={cn(
                            'text-[10px]',
                            item.trend === 'up-danger'
                              ? 'text-danger-subtle-text'
                              : 'text-warning-subtle-text',
                          )}
                          aria-hidden
                        >
                          ▲
                        </span>
                      )}
                      {item.price}
                    </span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                className="mt-4 text-sm font-medium text-accent-subtle-text hover:text-accent-hover"
              >
                Full price history →
              </button>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  )
}

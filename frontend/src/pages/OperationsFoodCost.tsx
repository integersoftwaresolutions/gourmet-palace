import { useNavigate } from 'react-router-dom'
import { FiAlertCircle } from 'react-icons/fi'
import { Card, KpiCard, Pill, Tabs } from '../components/ui'
import { AppShell } from '../components/layout/AppShell'
import { cn } from '../lib/cn'

const locationCosts = [
  { name: 'Sherman Oaks', value: 24.1, tone: 'danger' as const },
  { name: 'Simi Valley', value: 21.8, tone: 'accent' as const },
  { name: 'Woodland Hills', value: 22.3, tone: 'accent' as const },
]

const barTone = {
  danger: 'bg-danger',
  accent: 'bg-accent',
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

export function OperationsFoodCost() {
  const navigate = useNavigate()

  return (
    <AppShell
      title="Operations"
      subtitle="Purchase-based food-cost visibility from approved invoices only"
      activeNav="operations"
      badge={
        <Pill tone="accent" variant="outline">
          Admin only
        </Pill>
      }
    >
      <div className="flex flex-col gap-5">
        <Tabs
          value="food-cost"
          onChange={(id) => navigateOperationsTab(navigate, id)}
          items={operationsTabs}
        />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Purchase spend · wk"
            value="$12,680"
            meta="Approved invoices only"
          />
          <KpiCard
            label="Purchase-based food cost %"
            value={
              <span className="text-danger-subtle-text">23.4%</span>
            }
            meta="91% invoice coverage"
          />
          <KpiCard
            label="Target band"
            value="20–22%"
            meta="Configurable per location"
          />
          <KpiCard
            label="Invoice coverage"
            value="91%"
            meta="Approved invoices + tracked purchases"
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Food cost % vs target · by location" padding="lg">
            <ul className="flex flex-col gap-5">
              {locationCosts.map((loc) => (
                <li key={loc.name}>
                  <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                    <span className="text-card-text">{loc.name}</span>
                    <span
                      className={cn(
                        'font-semibold tabular-nums',
                        loc.tone === 'danger'
                          ? 'text-danger-subtle-text'
                          : 'text-accent-subtle-text',
                      )}
                    >
                      {loc.value}%
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-card-border">
                    <div
                      className={cn('h-full rounded-full', barTone[loc.tone])}
                      style={{
                        width: `${Math.min((loc.value / 30) * 100, 100)}%`,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-5 text-xs text-card-text-muted">
              Target 22% · purchase-based basis · coverage shown per location
            </p>
          </Card>

          <Card title="Actual COGS" padding="lg">
            <div className="rounded-lg border border-card-border bg-card-hover px-4 py-4">
              <div className="flex items-start gap-3">
                <FiAlertCircle className="mt-0.5 size-4 shrink-0 text-accent-subtle-text" />
                <p className="text-sm text-card-text">
                  Unavailable — opening and closing ingredient counts are
                  required. Manual counts support days-remaining only; they do
                  not produce COGS.
                </p>
              </div>
            </div>
            <p className="mt-4 text-xs text-card-text-muted">
              Purchase spend is not COGS. The dashboard never presents an
              estimate as actual COGS.
            </p>
          </Card>
        </div>
      </div>
    </AppShell>
  )
}

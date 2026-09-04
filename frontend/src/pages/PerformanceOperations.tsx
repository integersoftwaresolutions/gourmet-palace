import { useNavigate } from 'react-router-dom'
import {
  Card,
  KpiCard,
  Pill,
  Tabs,
} from '../components/ui'
import { AppShell } from '../components/layout/AppShell'
import { cn } from '../lib/cn'

const trends = [
  {
    title: 'Refunds',
    detail: 'Woodland Hills dinner window',
    badge: '42% above baseline',
    tone: 'danger' as const,
  },
  {
    title: 'Voids',
    detail: 'Company-wide',
    badge: '6% below normal',
    tone: 'success' as const,
  },
  {
    title: 'Discounts',
    detail: 'Lunch promotion',
    badge: '2% above normal',
    tone: 'warning' as const,
  },
]

const exceptions = [
  {
    title: '9 refunds · delivery · 6:30–8:00 PM',
    detail: 'Woodland Hills',
    badge: 'Critical',
    tone: 'danger' as const,
  },
  {
    title: 'Guest count unavailable',
    detail: 'Simi Valley',
    badge: 'Data quality',
    tone: 'warning' as const,
  },
  {
    title: '2 comped meals · approval on file',
    detail: 'Sherman Oaks',
    badge: 'Info',
    tone: 'info' as const,
  },
]

const toneDot = {
  danger: 'bg-danger',
  warning: 'bg-warning',
  info: 'bg-info',
  success: 'bg-success',
} as const

export function PerformanceOperations() {
  const navigate = useNavigate()

  return (
    <AppShell
      title="Performance"
      activeNav="performance"

    >
      <div className="flex flex-col gap-5">
        <Tabs
          value="operations"
          onChange={(id) => {
            if (id === 'stores') navigate('/performance')
            if (id === 'operations') navigate('/performance/operations')
            if (id === 'finance') navigate('/performance/finance')
            if (id === 'forecast') navigate('/performance/forecast')
          }}
          items={[
            { id: 'stores', label: 'Stores' },
            { id: 'operations', label: 'Operations' },
            { id: 'finance', label: 'Finance' },
            { id: 'forecast', label: 'Forecast' },
          ]}
        />

        <div className="grid gap-3 md:grid-cols-3">
          <KpiCard
            label="Refunds"
            value="$1,240"
            meta="Order-level drill-down"
            pill={
              <Pill tone="danger" variant="subtle" size="sm">
                ▲ 42%
              </Pill>
            }
          />
          <KpiCard
            label="Voids"
            value="$312"
            meta="Order-level drill-down"
            pill={
              <Pill tone="success" variant="subtle" size="sm">
                ▼ 6%
              </Pill>
            }
          />
          <KpiCard
            label="Discounts"
            value="$1,876"
            meta="Order-level drill-down"
            pill={
              <Pill tone="warning" variant="subtle" size="sm">
                ▲ 2%
              </Pill>
            }
          />
        </div>

        <Card accentBorder="accent" padding="sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11px] font-semibold tracking-widest text-accent-subtle-text uppercase">
              Source & coverage
            </p>
            <Pill tone="accent" variant="outline">
              96% coverage
            </Pill>
          </div>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Trend explanation" padding="lg">
            <ul className="flex flex-col divide-y divide-card-border">
              {trends.map((item) => (
                <li
                  key={item.title}
                  className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-card-text">
                      {item.title}
                    </p>
                    <p className="text-xs text-card-text-muted">{item.detail}</p>
                  </div>
                  <Pill tone={item.tone} variant="outline">
                    {item.badge}
                  </Pill>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Operational exceptions" padding="lg">
            <ul className="flex flex-col divide-y divide-card-border">
              {exceptions.map((item) => (
                <li
                  key={item.title}
                  className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <span
                    className={cn(
                      'size-2 shrink-0 rounded-full',
                      toneDot[item.tone],
                    )}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-card-text">
                      {item.title}
                    </p>
                    <p className="text-xs text-card-text-muted">{item.detail}</p>
                  </div>
                  <Pill tone={item.tone} variant="outline">
                    {item.badge}
                  </Pill>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <Card
          title="One-line AI summary"
          padding="lg"
          action={
            <Pill tone="info" variant="outline">
              Displayed period
            </Pill>
          }
        >
          <p className="text-base font-semibold text-card-text">
            Woodland Hills is the only material outlier: its refund increase is
            concentrated in delivery and aligns with three cold-food reviews.
          </p>
          <p className="mt-2 text-sm text-card-text-muted">
            Voids and discounts remain within normal ranges.
          </p>
          <p className="mt-4 text-xs text-card-text-muted">
            Evidence: order-level refunds · reason codes · review feed
          </p>
          <p className="mt-2 text-xs text-accent-subtle-text">
            Does not contradict displayed KPIs · fallback text available
          </p>
        </Card>
      </div>
    </AppShell>
  )
}

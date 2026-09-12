import { AppShell } from '../components/layout/AppShell'
import { OperationsTabs } from '../components/layout/SectionTabs'
import { QueryState, KpiRowSkeleton } from '../components/query'
import { Card, KpiCard, Pill } from '../components/ui'
import { analyticsApi } from '../lib/api'
import { useAsyncResource } from '../hooks/useAsyncResource'
import { money } from '../lib/format'
import { useAppState } from '../context/useAppState'

export function OperationsFoodCost() {
  const { query } = useAppState()
  const { data, error, isLoading, isRefreshing, reload } = useAsyncResource(
    () => analyticsApi.finance(query).then((r) => r.data),
    [query],
    { fallbackError: 'Unable to load food cost' },
  )

  return (
    <AppShell title="Food cost" subtitle="Purchase-based estimate from approved invoices, not actual COGS" activeNav="operations">
      <OperationsTabs value="food-cost" />
      <QueryState data={data} error={error} isLoading={isLoading} isRefreshing={isRefreshing} onRetry={reload} loader={<KpiRowSkeleton count={3} />}>
        {(d) => (
        <div className="space-y-4"><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Purchase spend · period" value={money(d.approvedFoodPurchases, 2)} meta="Approved invoices only" />
          <KpiCard label="Food cost %" value={d.foodCostPercent == null ? 'Unavailable' : `${(d.foodCostPercent * 100).toFixed(1)}%`} meta={d.foodCostTarget ? `Target ${(d.foodCostTarget.min * 100).toFixed(0)}–${(d.foodCostTarget.max * 100).toFixed(0)}%` : 'Estimate'} />
          <KpiCard label="Target band" value={d.foodCostTarget ? `${(d.foodCostTarget.min * 100).toFixed(0)}–${(d.foodCostTarget.max * 100).toFixed(0)}%` : 'Unavailable'} meta="Configurable per location" />
          <KpiCard label="Invoice coverage" value={`${d.invoiceCoverage?.approved ?? 0}`} meta="Approved invoices in range" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2"><Card title="Food cost coverage · by location"><div className="space-y-4">{(d.locationComparisons || []).length ? d.locationComparisons.map((location) => <div key={location.locationId}><div className="mb-1 flex justify-between text-xs"><span>{location.locationName}</span><span className="text-card-text-muted">{location.coverage ?? 0}% coverage</span></div><div className="h-2 rounded-full bg-card-border"><div className="h-2 rounded-full bg-accent" style={{ width: `${Math.min(100, Math.max(0, Number(location.coverage || 0)))}%` }} /></div></div>) : <p className="text-sm text-card-text-muted">No location coverage data is available for this period.</p>}</div><p className="mt-6 text-xs text-card-text-muted">Coverage indicates reliable source data. It is not actual COGS.</p></Card><Card title="Actual COGS"><div className="rounded-lg border border-card-border bg-card-hover p-4"><div className="flex gap-3"><Pill tone="warning" variant="outline">Unavailable</Pill><p className="text-sm text-card-text-muted">Opening and closing ingredient counts are required. Manual counts support days remaining only; they do not produce actual COGS.</p></div></div><p className="mt-6 border-t border-card-border pt-4 text-xs text-card-text-muted">Purchase spend is not COGS. This dashboard does not present an estimate as actual COGS.</p></Card></div>
        </div>
        )}
      </QueryState>
    </AppShell>
  )
}

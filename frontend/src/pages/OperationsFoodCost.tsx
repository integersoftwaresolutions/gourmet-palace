import { AppShell } from '../components/layout/AppShell'
import { OperationsTabs } from '../components/layout/SectionTabs'
import { QueryState, KpiRowSkeleton } from '../components/query'
import { KpiCard } from '../components/ui'
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
        <div className="grid gap-4 md:grid-cols-3">
          <KpiCard label="Approved food purchases" value={money(d.approvedFoodPurchases)} meta={`${d.invoiceCoverage?.approved ?? 0} approved invoices`} />
          <KpiCard label="Food cost %" value={d.foodCostPercent == null ? 'Unavailable' : `${(d.foodCostPercent * 100).toFixed(1)}%`} meta={d.foodCostTarget ? `Target ${(d.foodCostTarget.min * 100).toFixed(0)}–${(d.foodCostTarget.max * 100).toFixed(0)}%` : 'Estimate'} />
          <KpiCard label="Net sales" value={money(d.current.netMoney)} meta={d.dataStatus} />
        </div>
        )}
      </QueryState>
    </AppShell>
  )
}

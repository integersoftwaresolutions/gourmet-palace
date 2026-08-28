import { useMemo } from 'react'
import { AppShell } from '../components/layout/AppShell'
import { PerformanceTabs } from '../components/layout/SectionTabs'
import { AlertRow } from '../components/command-center/AlertRow'
import { CommandCenterMetric } from '../components/command-center/CommandCenterMetric'
import { QueryState, DualPanelSkeleton, KpiRowSkeleton } from '../components/query'
import { Card, Pill, Table } from '../components/ui'
import { analyticsApi, type ExceptionCluster, type OrderRecord, type PerformanceData } from '../lib/api'
import { useAsyncResource } from '../hooks/useAsyncResource'
import { money } from '../lib/format'
import { comparisonWeekdayLabel, formatPriorBusinessDay } from '../lib/commandCenterHelpers'
import { useAppState } from '../context/useAppState'

const channelLabels: Record<string, string> = {
  dine_in: 'Dine-in',
  takeout: 'Takeout',
  delivery: 'Delivery',
  third_party: 'Third-party',
  direct_online: 'Online-direct',
  unknown: 'Unknown channel',
}

function channelLabel(channel: string) {
  return channelLabels[channel] || channel.replaceAll('_', ' ')
}

function locName(id: OrderRecord['locationId']) {
  return typeof id === 'object' && id ? id.name : 'Location'
}

function majority(
  clusters: ExceptionCluster[],
  kind: ExceptionCluster['kind'],
  field: 'locationName' | 'channel' | 'daypart',
) {
  const rows = clusters.filter((row) => row.kind === kind)
  const total = rows.reduce((sum, row) => sum + row.money, 0)
  if (!total) return null
  const by = new Map<string, number>()
  for (const row of rows) {
    const raw = row[field]
    if (!raw || raw === 'unknown') continue
    by.set(raw, (by.get(raw) || 0) + row.money)
  }
  if (!by.size) return null
  const [label, amount] = [...by.entries()].sort((a, b) => b[1] - a[1])[0]
  return amount / total >= 0.5 ? label : null
}

function whereLine(clusters: ExceptionCluster[], kind: ExceptionCluster['kind'], locationCount: number) {
  const named = locationCount === 1
    ? clusters.find((row) => row.kind === kind)?.locationName || clusters[0]?.locationName
    : majority(clusters, kind, 'locationName')
  const channel = majority(clusters, kind, 'channel')
  const daypart = majority(clusters, kind, 'daypart')
  return [named || 'All locations in scope', channel ? channelLabel(channel) : null, daypart].filter(Boolean).join(' · ')
}

function clusterLine(cluster: ExceptionCluster) {
  const windowLabel = cluster.daypart || 'time not attributed'
  return `${cluster.orderCount} ${cluster.kind} · ${channelLabel(cluster.channel)} · ${windowLabel}`
}

function comparableCopy(value: number | null) {
  if (value == null) return { label: 'No comparison', tone: 'neutral' as const }
  if (value >= 0) {
    return {
      label: `${value.toFixed(0)}% above comparable`,
      tone: value >= 25 ? ('warning' as const) : ('neutral' as const),
    }
  }
  return { label: `${Math.abs(value).toFixed(0)}% below comparable`, tone: 'success' as const }
}

function exceptionFeed(data: PerformanceData) {
  const clusters = data.exceptionClusters || []
  const items: Array<{
    key: string
    severity: 'info' | 'warning' | 'critical'
    title: string
    detail: string
    statusLabel: string
  }> = []
  const topRefund = clusters.find((row) => row.kind === 'refunds')
  const topVoid = clusters.find((row) => row.kind === 'voids')
  if (topRefund) {
    items.push({
      key: `refund-${topRefund.locationId}-${topRefund.channel}`,
      severity: (data.comparison.refundsPct ?? 0) >= 25 ? 'warning' : 'info',
      title: clusterLine(topRefund),
      detail: topRefund.locationName,
      statusLabel: 'Refunds',
    })
  }
  if (topVoid) {
    items.push({
      key: `void-${topVoid.locationId}-${topVoid.channel}`,
      severity: (data.comparison.voidsPct ?? 0) >= 25 ? 'warning' : 'info',
      title: clusterLine(topVoid),
      detail: topVoid.locationName,
      statusLabel: 'Voids',
    })
  }
  const missingGuest = data.locationComparisons.filter((location) => location.guestCount == null)
  if (missingGuest.length === 1) {
    items.push({
      key: `guest-${missingGuest[0].locationId}`,
      severity: 'warning',
      title: 'Guest count unavailable',
      detail: missingGuest[0].locationName,
      statusLabel: 'Data quality',
    })
  } else if (missingGuest.length > 1) {
    items.push({
      key: 'guest-scope',
      severity: 'warning',
      title: 'Guest count unavailable',
      detail: `${missingGuest.length} locations · labeled Unavailable, not zero`,
      statusLabel: 'Data quality',
    })
  }
  return items.slice(0, 5)
}

export function PerformanceOperations() {
  const { query, comparisonMode } = useAppState()
  const { data, error, isLoading, isRefreshing, reload } = useAsyncResource(
    async () => {
      const [performanceRes, ordersRes] = await Promise.all([
        analyticsApi.performance(query),
        analyticsApi.orders({ ...query, exception: 'true', limit: '50' }),
      ])
      return { performance: performanceRes.data, orders: ordersRes.data }
    },
    [query],
    { fallbackError: 'Unable to load operations performance' },
  )

  const performance = data?.performance ?? null
  const vsLabel = performance
    ? comparisonMode === 'prior-year'
      ? 'VS LY'
      : `VS ${comparisonWeekdayLabel(performance.comparison.previousRange.to)}`
    : undefined
  const exceptions = useMemo(() => (performance ? exceptionFeed(performance) : []), [performance])
  const trend = useMemo(() => {
    if (!performance) return []
    const clusters = performance.exceptionClusters || []
    const locationCount = performance.locationComparisons.length
    return (
      [
        ['Refunds', performance.comparison.refundsPct, performance.current.refundMoney, 'refunds'],
        ['Voids', performance.comparison.voidsPct, performance.current.voidMoney, 'voids'],
        ['Discounts', performance.comparison.discountsPct, performance.current.discountMoney, 'discounts'],
      ] as const
    ).map(([label, pct, moneyValue, kind]) => ({
      label,
      where: moneyValue ? whereLine(clusters, kind, locationCount) : 'No amount in this period',
      copy: comparableCopy(pct),
    }))
  }, [performance])
  const orderRows = useMemo(
    () =>
      (data?.orders.orders || []).map((row) => ({
        id: row._id,
        location: locName(row.locationId),
        channel: channelLabel(row.channel),
        date: row.businessDate,
        orderId: row.providerOrderId,
        refund: row.refundMoney,
        voidAmt: row.voidMoney,
        discount: row.discountMoney,
      })),
    [data],
  )

  return (
    <AppShell
      title="Performance"
      subtitle={
        performance
          ? `Exceptions through ${formatPriorBusinessDay(performance.range.to)} · refunds, voids and discounts from canonical POS facts`
          : 'Refunds, voids and discounts versus the comparable period'
      }
      activeNav="performance"
    >
      <PerformanceTabs value="operations" />
      <QueryState
        data={data}
        error={error}
        isLoading={isLoading}
        isRefreshing={isRefreshing}
        onRetry={reload}
        loader={
          <div className="space-y-5">
            <KpiRowSkeleton count={3} />
            <DualPanelSkeleton />
          </div>
        }
      >
        {({ performance: d, orders }) => (
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-3">
              <a href="#exception-orders" className="block h-full min-w-0">
                <CommandCenterMetric
                  className="h-full"
                  label="Refunds"
                  value={money(d.current.refundMoney)}
                  delta={d.comparison.refundsPct}
                  deltaLabel={vsLabel}
                  invert
                  meta="Order-level drill-down"
                />
              </a>
              <a href="#exception-orders" className="block h-full min-w-0">
                <CommandCenterMetric
                  className="h-full"
                  label="Voids"
                  value={money(d.current.voidMoney)}
                  delta={d.comparison.voidsPct}
                  deltaLabel={vsLabel}
                  invert
                  meta="Order-level drill-down"
                />
              </a>
              <a href="#exception-orders" className="block h-full min-w-0">
                <CommandCenterMetric
                  className="h-full"
                  label="Discounts"
                  value={money(d.current.discountMoney)}
                  delta={d.comparison.discountsPct}
                  deltaLabel={vsLabel}
                  invert
                  meta="Order-level drill-down"
                />
              </a>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-card-border px-4 py-3">
              <p className="text-[10px] font-semibold tracking-[0.2em] text-card-text-faint uppercase">Source & coverage</p>
              <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
                <div className="h-1.5 w-full max-w-56 overflow-hidden rounded-full bg-card-subtle">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(0, Math.min(100, d.coverage))}%` }} />
                </div>
                <Pill tone={d.dataStatus === 'COMPLETE' ? 'success' : d.dataStatus === 'UNAVAILABLE' ? 'neutral' : 'warning'} variant="outline" size="sm">
                  {d.coverage}% coverage
                </Pill>
                <Pill tone={d.dataStatus === 'COMPLETE' ? 'success' : 'warning'} variant="outline" size="sm">
                  {d.dataStatus}
                </Pill>
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <Card title="Where the change is">
                <div className="space-y-3">
                  {trend.map((row) => (
                    <div key={row.label} className="flex items-start justify-between gap-3 rounded-lg border border-card-border px-3 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-card-text">{row.label}</p>
                        <p className="mt-0.5 text-xs text-card-text-muted">{row.where}</p>
                      </div>
                      <Pill tone={row.copy.tone} variant="outline" size="sm" className="shrink-0">
                        {row.copy.label}
                      </Pill>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-card-text-faint">
                  Change is versus the comparable period, not a stored baseline. Daypart is shown only when order times vary enough to be reliable.
                </p>
              </Card>

              <Card title="Operational exceptions">
                <div className="space-y-2">
                  {exceptions.length === 0 ? (
                    <p className="text-sm text-card-text-muted">No refund, void or guest-count exception is recorded for this scope.</p>
                  ) : (
                    exceptions.map((row) => (
                      <AlertRow
                        key={row.key}
                        severity={row.severity}
                        title={row.title}
                        detail={row.detail}
                        statusLabel={row.statusLabel}
                      />
                    ))
                  )}
                </div>
              </Card>
            </div>

            <Card
              className="border-accent-border/50"
              title="One-line summary"
              action={<Pill tone="accent" variant="outline">{d.summaryMode === 'AI' ? 'AI insight' : 'Deterministic fallback'}</Pill>}
            >
              <p className="text-sm leading-6 text-card-text">{d.summaryLine}</p>
              <p className="mt-2 text-xs text-card-text-muted">
                Grounded in displayed refunds, voids, discounts and coverage. Does not contradict displayed KPIs
                {d.summaryMode === 'AI' ? ' · AI summary' : ' · fallback text available'}.
                It does not invent reason codes, promotions or review causes.
              </p>
            </Card>

            <div id="exception-orders">
              <Table
                columns={[
                  { key: 'location', header: 'Location' },
                  { key: 'channel', header: 'Channel' },
                  { key: 'date', header: 'Business date' },
                  { key: 'orderId', header: 'Order' },
                  { key: 'refund', header: 'Refund', align: 'right', render: (row) => money(Number(row.refund)) },
                  { key: 'voidAmt', header: 'Void', align: 'right', render: (row) => money(Number(row.voidAmt)) },
                  { key: 'discount', header: 'Discount', align: 'right', render: (row) => money(Number(row.discount)) },
                ]}
                rows={orderRows}
                getRowKey={(row) => String(row.id)}
                emptyMessage="No exception orders in this scope. Refunds, voids, discounts and canceled tickets appear here."
              />
              <p className="mt-2 text-xs text-card-text-faint">
                Showing {orderRows.length.toLocaleString()} of {orders.total.toLocaleString()} exception orders. Payment details are not stored or shown.
              </p>
            </div>
          </div>
        )}
      </QueryState>
    </AppShell>
  )
}

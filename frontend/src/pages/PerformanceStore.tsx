import { useMemo, useState } from 'react'
import { AppShell } from '../components/layout/AppShell'
import { PerformanceTabs } from '../components/layout/SectionTabs'
import { CommandCenterMetric } from '../components/command-center/CommandCenterMetric'
import { RankingRow } from '../components/command-center/RankingRow'
import { TrendBadge } from '../components/command-center/TrendBadge'
import { QueryState, PerformanceSkeleton } from '../components/query'
import {
  BarChart,
  Card,
  Pill,
  ShareBarList,
  Tabs,
} from '../components/ui'
import { chartColors } from '../components/ui/charts/chartTheme'
import { analyticsApi } from '../lib/api'
import { useAsyncResource } from '../hooks/useAsyncResource'
import { freshnessTime, money } from '../lib/format'
import { comparisonDeltaLabel, formatComparisonRangeLabel, formatPriorBusinessDay } from '../lib/commandCenterHelpers'
import { useAppState } from '../context/useAppState'

const channelLabels: Record<string, string> = {
  dine_in: 'Dine-in',
  takeout: 'Takeout',
  delivery: 'Delivery',
  third_party: 'Third-party',
  direct_online: 'Online-direct',
  unknown: 'Unknown',
}

const guestSourceLabel: Record<string, string> = {
  toast: 'Toast guest count',
  square: 'Square guest count',
  mixed: 'Guest count from mixed POS sources',
  unavailable: 'Unavailable, not zero',
}

type ItemView = 'top' | 'slow'

function locName(id: { _id: string; name: string } | string | undefined): string {
  if (!id) return 'Location'
  return typeof id === 'object' ? id.name : 'Location'
}

export function PerformanceStore() {
  const { query, locations, selectedLocationId, comparisonMode } = useAppState()
  const { data, error, isLoading, isRefreshing, reload } = useAsyncResource(
    () => analyticsApi.performance(query).then((response) => response.data),
    [query],
    { fallbackError: 'Unable to load performance' },
  )
  const [itemView, setItemView] = useState<ItemView>('top')

  const selectedLocation = locations.find((location) => location.id === selectedLocationId)
  const storeName = selectedLocationId === 'all' ? 'All locations' : selectedLocation?.name || 'Location'
  const score = data?.locationScores[0]
  const freshness = data?.freshnessAt
    ? `Fresh · ${freshnessTime(data.freshnessAt)} PT`
    : 'Source freshness unavailable'
  const vsLabel = data
    ? comparisonDeltaLabel({
        basis: comparisonMode,
        previousRange: data.comparison.previousRange,
      })
    : undefined
  const deltas = data?.comparison

  const channelItems = useMemo(
    () => Object.entries(data?.channels || {})
      .filter(([, value]) => Number(value) > 0)
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .map(([key, value]) => ({
        key,
        label: channelLabels[key] || key.replaceAll('_', ' '),
        value: Number(value),
      })),
    [data?.channels],
  )

  const categoryItems = useMemo(
    () => (data?.categories || []).map((category) => ({
      key: category.name,
      label: category.name,
      value: category.revenue,
    })),
    [data?.categories],
  )

  const itemRows = (itemView === 'top' ? data?.topItems : data?.slowItems)?.slice(0, 8) ?? []

  const daypartData = (data?.dayparts || [])
    .filter((row) => row.label !== 'Overnight' || row.netMoney > 0)
    .map((row) => ({ label: row.label, sales: Math.round(row.netMoney / 100) }))

  return (
    <AppShell
      title="Performance"
      subtitle={
        data
          ? `Data through ${formatPriorBusinessDay(data.range.to)}${
              data.freshnessAt ? ` · refreshed ${freshnessTime(data.freshnessAt)} PT` : ' · no source refresh recorded'
            }`
          : 'Sales, demand, channels, items and categories from canonical POS history'
      }
      activeNav="performance"
    >
      <PerformanceTabs value="stores" />
      <QueryState
        data={data}
        error={error}
        isLoading={isLoading}
        isRefreshing={isRefreshing}
        onRetry={reload}
        loader={<PerformanceSkeleton />}
      >
        {(data) => (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              {score && (
                <Pill tone="accent" variant="outline">
                  Daily score {score.score == null ? 'Unavailable' : Math.round(score.score)}
                  {score.rank ? ` • Rank #${score.rank}` : ''}
                </Pill>
              )}
              <h2 className="text-2xl font-semibold tracking-tight text-surface-text">{storeName}</h2>
            </div>
          </div>

            <p className="text-xs text-card-text-muted">
              KPI change is versus the header{' '}
              <span className="font-medium">{comparisonMode === 'prior-year' ? 'Prior year' : 'Prior period'}</span>
              {data.comparison.previousRange
                ? ` (${formatComparisonRangeLabel(data.comparison.previousRange)})`
                : ''}
              {comparisonMode === 'previous' ? ' — the equal-length window immediately before the selected dates' : ' — the same dates last year'}
              . Switch the header control to change this basis.
            </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 min-[1600px]:grid-cols-6">
            <CommandCenterMetric label="Gross sales" value={money(data.current.grossMoney)} delta={deltas?.grossPct ?? null} deltaLabel={vsLabel} meta={freshness} />
            <CommandCenterMetric label="Net sales" value={money(data.current.netMoney)} delta={deltas?.netSalesPct ?? null} deltaLabel={vsLabel} meta={freshness} />
            <CommandCenterMetric label="Avg ticket" value={money(data.current.averageTicket, 2)} delta={deltas?.averageTicketPct ?? null} deltaLabel={vsLabel} meta={freshness} />
            <CommandCenterMetric
              label="Tickets"
              value={data.current.orderCount == null ? 'Unavailable' : data.current.orderCount.toLocaleString()}
              delta={deltas?.ordersPct ?? null}
              deltaLabel={vsLabel}
              meta={freshness}
            />
            <CommandCenterMetric
              label="Guests"
              value={data.current.guestCount == null ? 'Unavailable' : data.current.guestCount.toLocaleString()}
              delta={deltas?.guestsPct ?? null}
              deltaLabel={vsLabel}
              meta={guestSourceLabel[data.guestSource] || freshness}
            />
            <CommandCenterMetric
              label="Refunds"
              value={money(data.current.refundMoney)}
              delta={deltas?.refundsPct ?? null}
              deltaLabel={vsLabel}
              invert
              meta={freshness}
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card title="Order channels">
              <ShareBarList items={channelItems} formatValue={money} emptyMessage="No channel revenue is available for this scope." />
              {data.channels.unknown ? (
                <p className="mt-3 text-xs text-card-text-faint">Unmapped traffic remains Unknown until Square channel mapping is approved.</p>
              ) : null}
            </Card>
            <Card title="Sales by menu category">
              <ShareBarList items={categoryItems} formatValue={money} emptyMessage="Menu categories are unavailable until item categories are present on canonical orders." />
            </Card>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card
              title="Top & slow-selling items"
              action={
                <Tabs
                  variant="pill"
                  aria-label="Item ranking"
                  value={itemView}
                  onChange={(id) => setItemView(id as ItemView)}
                  items={[
                    { id: 'top', label: 'Top' },
                    { id: 'slow', label: 'Slow' },
                  ]}
                />
              }
            >
              <p className="mb-3 text-xs text-card-text-muted">
                Ranked by net sales in the selected period. Change uses the comparable prior period. Sold items only.
              </p>
              {itemRows.length === 0 ? (
                <p className="text-sm text-card-text-muted">No sold items are available in this scope.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] text-sm">
                    <thead>
                      <tr className="border-b border-card-border text-left text-[11px] tracking-widest text-card-text-faint uppercase">
                        <th className="pb-2 font-medium">Item</th>
                        <th className="pb-2 text-right font-medium">Units</th>
                        <th className="pb-2 text-right font-medium">Net sales</th>
                        <th className="pb-2 text-right font-medium">Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itemRows.map((row) => (
                        <tr key={row.name} className="border-b border-card-border last:border-0">
                          <td className="py-2.5">
                            <span className="block font-medium text-card-text">{row.name}</span>
                            <span className="text-xs text-card-text-faint">{row.category || 'Uncategorized'}</span>
                          </td>
                          <td className="py-2.5 text-right tabular-nums text-card-text">{row.units.toLocaleString()}</td>
                          <td className="py-2.5 text-right tabular-nums text-card-text">{money(row.revenue)}</td>
                          <td className="py-2.5 text-right"><TrendBadge value={row.changePct} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
            <Card title={`Sales by daypart · ${formatPriorBusinessDay(data.range.to)}`}>
              {data.daypartStatus === 'UNAVAILABLE' ? (
                <p className="text-sm text-card-text-muted">
                  Daypart sales are unavailable because order timestamps are missing for this scope.
                </p>
              ) : (
                <>
                  <BarChart
                    data={daypartData}
                    categoryKey="label"
                    series={[{ key: 'sales', label: 'Net sales ($)', color: chartColors.accent }]}
                    height={260}
                    showLegend={false}
                  />
                  {data.daypartStatus === 'PARTIAL' ? (
                    <p className="mt-2 text-xs text-card-text-faint">Partial: some orders are missing timestamps and were omitted.</p>
                  ) : null}
                </>
              )}
            </Card>
          </div>

          {selectedLocationId === 'all' && data.locationScores.length > 1 && (
            <Card title={`Ending-day location scores · ${formatPriorBusinessDay(data.range.to)}`}>
              <div className="space-y-2">
                {data.locationScores.map((row) => (
                  <RankingRow
                    key={row._id}
                    rank={row.rank}
                    name={locName(row.locationId)}
                    subtitle={`Coverage ${row.coverage}%`}
                    score={row.score == null ? null : Math.round(row.score)}
                  />
                ))}
              </div>
            </Card>
          )}

          <Card
            className="border-accent-border/50"
            title="Performance insight"
            action={<Pill tone="accent" variant="outline">AI insight</Pill>}
          >
            <p className="text-sm leading-6 text-card-text">{data.summaryLine}</p>
            <p className="mt-2 text-xs text-card-text-muted">
              Grounded in the displayed authorized period
              {data.summaryMode === 'AI' ? ' · AI summary' : ' · deterministic fallback available'}.
              It does not invent unavailable figures.
            </p>
          </Card>
        </div>
        )}
      </QueryState>
    </AppShell>
  )
}

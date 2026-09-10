import { useMemo } from 'react'
import { AppShell } from '../components/layout/AppShell'
import { PerformanceTabs } from '../components/layout/SectionTabs'
import { CommandCenterMetric } from '../components/command-center/CommandCenterMetric'
import { QueryState, DualPanelSkeleton, KpiRowSkeleton } from '../components/query'
import { BarChart, Card, Pill } from '../components/ui'
import { chartColors } from '../components/ui/charts/chartTheme'
import { analyticsApi, type FinanceData } from '../lib/api'
import { useAsyncResource } from '../hooks/useAsyncResource'
import { money, ratioPercent } from '../lib/format'
import { comparisonDeltaLabel, formatPriorBusinessDay } from '../lib/commandCenterHelpers'
import { useAppState } from '../context/useAppState'

function sourceLine(providers: string[] | undefined, status: string, gross: number | null) {
  const list = providers || []
  const source = !list.length
    ? 'source unavailable'
    : list.length === 1 && list[0] === 'toast'
      ? 'Toast historical'
      : list.length === 1 && list[0] === 'square'
        ? 'Square'
        : list.includes('square') && list.includes('toast')
          ? 'Square live · Toast history'
          : list.join(', ')
  return `Gross ${money(gross)} · ${status} · ${source}`
}

function foodCostMeta(d: FinanceData) {
  const invoices = `${d.invoiceCoverage?.approved ?? 0} approved invoices`
  if (d.foodCostPercent == null) return `Unavailable · ${invoices}`
  const target = d.foodCostTarget
    ? `target ${(d.foodCostTarget.min * 100).toFixed(0)}–${(d.foodCostTarget.max * 100).toFixed(0)}%`
    : 'no target'
  return `Estimated · not actual COGS · ${target} · ${invoices}`
}

function foodCostTone(d: FinanceData): 'danger' | 'success' | 'neutral' {
  if (d.foodCostPercent == null || !d.foodCostTarget) return 'neutral'
  if (d.foodCostPercent > d.foodCostTarget.max) return 'danger'
  return 'success'
}

function foodCostPill(d: FinanceData) {
  if (d.foodCostPercent == null) return 'Unavailable'
  if (!d.foodCostTarget) return 'Estimated · not COGS'
  const band = `${(d.foodCostTarget.min * 100).toFixed(0)}–${(d.foodCostTarget.max * 100).toFixed(0)}%`
  if (d.foodCostPercent > d.foodCostTarget.max) return `Above ${band} target`
  if (d.foodCostPercent < d.foodCostTarget.min) return `Below ${band} target`
  return `Within ${band} target`
}

function initialsLine(rows: Array<{ initials: string; locationName: string }>) {
  if (!rows.length) return 'Unavailable'
  return rows.map((row) => row.initials || row.locationName).join(', ')
}

export function PerformanceFinance() {
  const { query, comparisonMode } = useAppState()
  const { data, error, isLoading, isRefreshing, reload } = useAsyncResource(
    () => analyticsApi.finance(query).then((r) => r.data),
    [query],
    { fallbackError: 'Unable to load finance' },
  )

  const vsLabel = data
    ? comparisonDeltaLabel({
        basis: comparisonMode === 'prior-year' ? 'prior-year' : 'previous',
        previousRange: data.comparison.previousRange,
      })
    : undefined
  const mtd = data?.periodSummaries.mtd
  const mtdVs = data
    ? comparisonDeltaLabel({
        basis: comparisonMode === 'prior-year' ? 'prior-year' : 'previous',
        previousRange: mtd?.comparison.previousRange,
      })
    : undefined
  const chartRows = useMemo(() => {
    const rows = data?.dailyTrend || []
    const slice = rows.length > 10 ? rows.slice(-10) : rows
    return slice.map((row) => ({
      date: row.businessDate,
      netSales: Math.round(row.netMoney / 100),
      estProfit: Math.round(row.estimatedProfit / 100),
    }))
  }, [data])
  const exceptionTotal = data
    ? (data.current.refundMoney || 0) + (data.current.voidMoney || 0) + (data.current.discountMoney || 0)
    : 0
  const exceptionRate =
    data?.current.netMoney ? (exceptionTotal / data.current.netMoney) * 100 : null
  const marginPct = ((data?.selectedMargin || 0) * 100).toFixed(0)
  const scoreOrder = data?.locationScoreOrder || []

  return (
    <AppShell
      title="Performance"
      subtitle={
        data
          ? `Finance through ${formatPriorBusinessDay(data.range.to)} · estimates separated from accounting P&L`
          : 'Decision-support estimates, clearly separated from accounting P&L'
      }
      activeNav="performance"
    >
      <PerformanceTabs value="finance" />
      <QueryState
        data={data}
        error={error}
        isLoading={isLoading}
        isRefreshing={isRefreshing}
        onRetry={reload}
        loader={
          <div className="space-y-5">
            <KpiRowSkeleton count={4} />
            <DualPanelSkeleton />
          </div>
        }
      >
        {(d) => (
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <CommandCenterMetric
                label="Net sales · exact"
                value={money(d.current.netMoney)}
                delta={d.comparison.netSalesPct}
                deltaLabel={vsLabel}
                meta={sourceLine(d.sourceProviders, d.dataStatus, d.current.grossMoney)}
              />
              <CommandCenterMetric
                label="MTD net sales"
                value={money(mtd?.current.netMoney ?? null)}
                delta={mtd?.comparison.netSalesPct ?? null}
                deltaLabel={mtdVs}
                meta={
                  mtd?.comparison.netSalesPct == null
                    ? `${mtd?.dataStatus || 'Unavailable'} · no comparable prior period`
                    : `${mtd.dataStatus} · ${comparisonMode === 'prior-year' ? 'prior year' : 'prior equal-length period'}`
                }
              />
              <CommandCenterMetric
                label="Purchase-based food cost %"
                value={d.foodCostPercent == null ? 'Unavailable' : ratioPercent(d.foodCostPercent)}
                hideTrend
                meta={foodCostMeta(d)}
              />
              <CommandCenterMetric
                label="Est. profit at selected margin"
                value={money(d.estimatedProfitAtSelectedMargin)}
                hideTrend
                meta={`Net sales × ${marginPct}% · estimate · not live P&L`}
              />
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <Card
                title={
                  (d.dailyTrend.length > 10 ? 'Last 10 days of selection' : `${d.dailyTrend.length || 0} days`) +
                  ' · net sales and estimated profit'
                }
              >
                {chartRows.length === 0 ? (
                  <p className="text-sm text-card-text-muted">No daily finance trend is available for this scope.</p>
                ) : (
                  <BarChart
                    data={chartRows}
                    categoryKey="date"
                    series={[
                      { key: 'netSales', label: 'Net sales ($)', color: chartColors.danger },
                      { key: 'estProfit', label: 'Estimated profit ($)', color: chartColors.accent },
                    ]}
                    height={280}
                  />
                )}
                <p className="mt-2 text-xs text-card-text-faint">
                  Estimated profit uses the configured selected margin in effect on each day. It is not live P&amp;L.
                </p>
              </Card>

              <Card title="Finance breakdown">
                <div className="space-y-3">
                  <BreakdownRow
                    label="Net sales"
                    value={money(d.current.netMoney)}
                    pill={`${d.comparison.netSalesPct == null ? 'No comparison' : `${d.comparison.netSalesPct >= 0 ? '+' : ''}${d.comparison.netSalesPct.toFixed(1)}%`}`}
                    tone={d.comparison.netSalesPct == null ? 'neutral' : d.comparison.netSalesPct >= 0 ? 'success' : 'danger'}
                  />
                  <BreakdownRow
                    label="Approved food purchases"
                    value={money(d.approvedFoodPurchases)}
                    pill={`${d.invoiceCoverage.approved} invoices · approved only`}
                    tone="warning"
                  />
                  <BreakdownRow
                    label="Purchase-based food-cost %"
                    value={d.foodCostPercent == null ? 'Unavailable' : ratioPercent(d.foodCostPercent)}
                    pill={foodCostPill(d)}
                    tone={foodCostTone(d)}
                  />
                  <BreakdownRow
                    label="Estimated profit at selected margin"
                    value={money(d.estimatedProfitAtSelectedMargin)}
                    pill={`Estimate · ${marginPct}% margin`}
                    tone="warning"
                  />
                  <div className="space-y-3 border-t border-card-border pt-3">
                    <BreakdownRow
                      label="Weekly net sales"
                      value={money(d.periodSummaries.weekly.current.netMoney)}
                      pill={d.periodSummaries.weekly.comparison.netSalesPct == null ? d.periodSummaries.weekly.dataStatus : `${d.periodSummaries.weekly.comparison.netSalesPct >= 0 ? '+' : ''}${d.periodSummaries.weekly.comparison.netSalesPct.toFixed(1)}%`}
                      tone="neutral"
                    />
                    <BreakdownRow
                      label="WTD net sales"
                      value={money(d.periodSummaries.wtd.current.netMoney)}
                      pill={d.periodSummaries.wtd.dataStatus}
                      tone="neutral"
                    />
                  </div>
                  <div className="space-y-3 border-t border-card-border pt-3">
                    <BreakdownRow
                      label="Refunds · voids · discounts"
                      value={`${money(exceptionTotal)}${exceptionRate == null ? '' : ` · ${exceptionRate.toFixed(1)}%`}`}
                      pill={`R ${money(d.current.refundMoney)} · V ${money(d.current.voidMoney)} · D ${money(d.current.discountMoney)}`}
                      tone="neutral"
                    />
                    <BreakdownRow
                      label="Store ranking"
                      value={initialsLine(d.storeRankings.map((row) => ({
                        initials: row.locationName.split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 3).toUpperCase(),
                        locationName: row.locationName,
                      })))}
                      pill="by net sales"
                      tone="warning"
                    />
                    <BreakdownRow
                      label="Ending-day score order"
                      value={scoreOrder.length ? initialsLine(scoreOrder) : 'Unavailable'}
                      pill={scoreOrder.length ? `by score · ${formatPriorBusinessDay(d.range.to)}` : 'No score'}
                      tone="warning"
                    />
                  </div>
                </div>
              </Card>
            </div>

            {d.storeRankings.length > 0 && (
              <Card title="Store ranking · selected period · by net sales">
                <div className="space-y-2">
                  {d.storeRankings.map((row) => (
                    <div key={row.locationId} className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 rounded-lg border border-card-border px-3 py-2.5">
                      <span className="text-sm font-semibold text-card-text-faint">#{row.rank}</span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-card-text">{row.locationName}</p>
                        <p className="truncate text-xs text-card-text-muted">
                          Estimated profit {money(row.estimatedProfit)} at {(row.selectedMargin * 100).toFixed(1)}%
                        </p>
                      </div>
                      <span className="text-sm font-semibold tabular-nums text-card-text">{money(row.netMoney)}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <Card title="Financial interpretation">
              <p className="text-sm leading-6 text-card-text-muted">
                Estimated Profit at Selected Margin is net sales × the configured planning margin. It is a planning estimate, not live P&amp;L.
                Purchase-based food cost uses approved food/ingredient invoices only and is not actual COGS.
                Live overlap days remain Square-authoritative; Toast facts stay historical. Rankings above are by net sales unless labeled as ending-day score.
              </p>
            </Card>
          </div>
        )}
      </QueryState>
    </AppShell>
  )
}

function BreakdownRow({
  label,
  value,
  pill,
  tone,
}: {
  label: string
  value: string
  pill: string
  tone: 'success' | 'warning' | 'danger' | 'neutral'
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs text-card-text-faint">{label}</p>
        <p className="mt-0.5 text-sm font-semibold tabular-nums text-card-text">{value}</p>
      </div>
      <Pill tone={tone} variant="outline" size="sm" className="max-w-[58%] shrink-0 truncate" title={pill}>
        {pill}
      </Pill>
    </div>
  )
}

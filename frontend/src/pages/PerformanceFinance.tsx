import { useEffect, useState } from 'react'
import { AppShell } from '../components/layout/AppShell'
import { PerformanceTabs } from '../components/layout/SectionTabs'
import { Card, KpiCard } from '../components/ui'
import { analyticsApi, type FinanceData } from '../lib/api'
import { money } from '../lib/format'
import { useAppState } from '../context/useAppState'

export function PerformanceFinance() {
  const { query } = useAppState()
  const [d, setD] = useState<FinanceData | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    analyticsApi.finance(query).then((r) => setD(r.data)).catch((e) => setError(e instanceof Error ? e.message : 'Unable to load finance'))
  }, [query])

  return (
    <AppShell title="Finance" subtitle="Decision-support estimates, clearly separated from accounting P&L" activeNav="performance">
      <PerformanceTabs value="finance" />
      {error && <Card className="mt-5"><p className="text-danger-subtle-text">{error}</p></Card>}
      {d && (
        <div className="mt-5 space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <KpiCard label="Net sales" value={money(d.current.netMoney)} meta={d.dataStatus} />
            <KpiCard
              label="Estimated profit at selected margin"
              value={money(d.estimatedProfitAtSelectedMargin)}
              meta={`Planning estimate at ${((d.selectedMargin || 0) * 100).toFixed(1)}% margin; not live P&L`}
            />
          </div>
          <Card title="Daily / weekly / WTD / MTD sales">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {([['daily', 'Daily'], ['weekly', 'Trailing 7 days'], ['wtd', 'Week to date'], ['mtd', 'Month to date']] as const).map(([key, label]) => {
                const p = d.periodSummaries[key]
                return (
                  <div key={key} className="rounded-lg border border-card-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-card-text-faint">{label}</p>
                      <span className="text-[10px] text-card-text-faint">{p.dataStatus}</span>
                    </div>
                    <p className="mt-2 text-lg font-semibold text-card-text">{money(p.current.netMoney)}</p>
                    <p className="mt-1 text-xs text-card-text-muted">Gross {money(p.current.grossMoney)} · {p.current.orderCount == null ? 'Orders unavailable' : `${p.current.orderCount} orders`}</p>
                    <p className="mt-1 text-xs text-card-text-faint">{p.comparison.netSalesPct == null ? 'No comparable prior period' : `${p.comparison.netSalesPct >= 0 ? '+' : ''}${p.comparison.netSalesPct.toFixed(1)}% vs prior equal-length period`}</p>
                  </div>
                )
              })}
            </div>
          </Card>
          <div className="grid gap-5 lg:grid-cols-2">
            <Card title="Store ranking · selected period">
              <div className="space-y-2">
                {d.storeRankings.length === 0 ? (
                  <p className="text-sm text-card-text-muted">No finance-eligible store data is available for this period.</p>
                ) : d.storeRankings.map((r) => (
                  <div key={r.locationId} className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 border-b border-card-border py-2 last:border-0">
                    <span className="text-sm font-semibold text-card-text-faint">#{r.rank}</span>
                    <span>
                      <span className="block text-sm text-card-text">{r.locationName}</span>
                      <span className="text-xs text-card-text-muted">Estimated profit {money(r.estimatedProfit)} at {(r.selectedMargin * 100).toFixed(1)}%</span>
                    </span>
                    <span className="text-sm font-semibold text-card-text">{money(r.netMoney)}</span>
                  </div>
                ))}
              </div>
            </Card>
            <Card title="Sales & selected-margin trend">
              <div className="max-h-72 overflow-auto">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-card">
                    <tr className="border-b border-card-border text-xs uppercase text-card-text-faint">
                      <th className="py-2">Business date</th>
                      <th className="py-2 text-right">Net sales</th>
                      <th className="py-2 text-right">Est. profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.dailyTrend.map((r) => (
                      <tr key={r.businessDate} className="border-b border-card-border last:border-0">
                        <td className="py-2 text-card-text">{r.businessDate}</td>
                        <td className="py-2 text-right text-card-text">{money(r.netMoney)}</td>
                        <td className="py-2 text-right text-card-text-muted">{money(r.estimatedProfit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {d.dailyTrend.length === 0 && <p className="py-3 text-sm text-card-text-muted">No trend data is available for the selected period.</p>}
              </div>
            </Card>
          </div>
          <Card title="Financial interpretation">
            <p className="text-sm leading-6 text-card-text-muted">
              Estimated Profit at Selected Margin is net sales × the configured planning margin. It is a planning estimate, not live P&amp;L.
              Store rankings and trends use the same authorized canonical POS data and effective selected-margin configuration.
            </p>
          </Card>
        </div>
      )}
    </AppShell>
  )
}

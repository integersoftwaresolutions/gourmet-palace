import { Link } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'
import { QueryState, DualPanelSkeleton, KpiRowSkeleton } from '../components/query'
import { Button, Card, KpiCard, Pill } from '../components/ui'
import { reportsApi, type ReportData, type ReportScorecard } from '../lib/api'
import { useAsyncResource } from '../hooks/useAsyncResource'
import { money, ratioPercent } from '../lib/format'
import { formatPriorBusinessDay } from '../lib/commandCenterHelpers'
import { useAppState } from '../context/useAppState'

function locName(id: ReportScorecard['locationId']) {
  return typeof id === 'object' && id ? id.name : 'Location'
}

function pctDelta(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return 'Unavailable'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}%`
}

export function ReportingCenter() {
  const { query } = useAppState()
  const { data: report, error, isLoading, isRefreshing, reload } = useAsyncResource(
    () => reportsApi.get(query).then((res) => res.data.report),
    [query],
    { fallbackError: 'Unable to load report' },
  )

  return (
    <AppShell
      title="Executive Reporting Center"
      subtitle={
        report
          ? `${formatPriorBusinessDay(report.range.from)} → ${formatPriorBusinessDay(report.range.to)} · CSV and print-ready canonical reporting`
          : 'Owner/Admin CSV and print-ready canonical reporting'
      }
      activeNav="reporting"
      actions={
        <div className="flex flex-wrap gap-2 print:hidden">
          <a href={reportsApi.csvUrl(query)}>
            <Button size="sm" variant="outline">Download CSV</Button>
          </a>
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            Print / Save as PDF
          </Button>
        </div>
      }
    >
      <QueryState
        data={report}
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
        className="mt-0"
      >
        {(d: ReportData) => {
          const briefContent = (d.brief?.content || {}) as Record<string, unknown>
          const priorities = Array.isArray(briefContent.priorities) ? briefContent.priorities as Array<Record<string, unknown>> : []
          const categoryRows = Object.entries(d.invoices.categorySpend || {}).sort((a, b) => b[1] - a[1]).slice(0, 8)
          return (
            <div className="report-print space-y-5">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <KpiCard label="Net sales" value={money(d.performance.current.netMoney)} meta={d.performance.dataStatus} />
                <KpiCard label="Orders" value={String(d.performance.current.orderCount ?? 'Unavailable')} meta="Completed canonical orders" />
                <KpiCard label="Approved food purchases" value={money(d.finance.approvedFoodPurchases)} meta="Purchase-based estimate · not COGS" />
                <KpiCard label="Open alerts" value={String(d.alertSummary.open ?? 0)} meta={`${d.alertSummary.critical} critical`} />
              </div>

              <Card title="Daily executive brief" action={<Link to="/morning-brief" className="text-xs text-accent print:hidden">Open Morning Brief</Link>}>
                {!d.brief ? (
                  <p className="text-sm text-card-text-muted">No current brief in this period.</p>
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill tone={d.brief.status === 'COMPLETE' ? 'success' : 'warning'} variant="outline" size="sm">{d.brief.status}</Pill>
                      <span className="text-xs text-card-text-muted">{d.brief.businessDate} · revision {d.brief.revision}</span>
                    </div>
                    <p className="text-sm text-card-text">{String(briefContent.headline || 'Brief available')}</p>
                    {priorities.length > 0 && (
                      <ul className="space-y-1 text-sm text-card-text-muted">
                        {priorities.slice(0, 5).map((row, i) => (
                          <li key={String(row.ref || i)}>{String(row.title || row.nextAction || 'Priority')}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </Card>

              <div className="grid gap-5 lg:grid-cols-2">
                <Card title="Performance">
                  <div className="space-y-2 text-sm">
                    <Row label="Net sales" value={money(d.performance.current.netMoney)} />
                    <Row label="Orders" value={String(d.performance.current.orderCount ?? 'Unavailable')} />
                    <Row label="Refunds" value={money(d.performance.current.refundMoney)} />
                    <Row label="Voids" value={money(d.performance.current.voidMoney)} />
                    <Row label="Discounts" value={money(d.performance.current.discountMoney)} />
                    <Row label="Status" value={`${d.performance.dataStatus} · ${d.performance.coverage}% coverage`} />
                  </div>
                </Card>
                <Card title="Finance estimates">
                  <div className="space-y-2 text-sm">
                    <Row label="Approved food purchases" value={money(d.finance.approvedFoodPurchases)} />
                    <Row label="Food cost %" value={d.finance.foodCostPercent == null ? 'Unavailable' : ratioPercent(d.finance.foodCostPercent)} />
                    <Row label="Est. profit at selected margin" value={money(d.finance.estimatedProfitAtSelectedMargin)} />
                    <p className="pt-1 text-xs text-card-text-faint">Purchase-based food cost and selected-margin profit are estimates, not accounting P&amp;L.</p>
                  </div>
                </Card>
              </div>

              <Card title="Store scorecards">
                {d.scorecards.length === 0 ? (
                  <p className="text-sm text-card-text-muted">No location scores in this period.</p>
                ) : (
                  <div className="space-y-2">
                    {d.scorecards.map((row) => (
                      <div key={`${locName(row.locationId)}-${row.businessDate}`} className="flex flex-wrap items-center justify-between gap-2 border-b border-card-border py-2 last:border-0">
                        <div>
                          <p className="text-sm font-medium text-card-text">{locName(row.locationId)}</p>
                          <p className="text-xs text-card-text-muted">{row.businessDate} · coverage {row.coverage}%</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-card-text">{row.score == null ? 'Unavailable' : row.score.toFixed(1)}</p>
                          <p className="text-xs text-card-text-muted">Rank {row.rank ?? '—'} · {money(row.netSales)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <div className="grid gap-5 lg:grid-cols-2">
                <Card title="Vendors & invoices">
                  <p className="mb-3 text-xs text-card-text-muted">{d.invoices.count} approved invoices · {money(d.invoices.total)}</p>
                  {d.invoices.vendors.length === 0 ? (
                    <p className="text-sm text-card-text-muted">No approved vendor spend in this period.</p>
                  ) : (
                    <div className="space-y-2">
                      {d.invoices.vendors.slice(0, 10).map((vendor) => (
                        <div key={vendor.vendorId || vendor.vendorName} className="flex items-center justify-between gap-2 border-b border-card-border py-2 last:border-0">
                          <div>
                            {vendor.vendorId ? (
                              <Link to={`/operations/vendors/${vendor.vendorId}`} className="text-sm font-medium text-accent print:text-card-text">
                                {vendor.vendorName}
                              </Link>
                            ) : (
                              <p className="text-sm font-medium text-card-text">{vendor.vendorName}</p>
                            )}
                            <p className="text-xs text-card-text-muted">{vendor.invoiceCount} invoices</p>
                          </div>
                          <p className="text-sm font-semibold text-card-text">{money(vendor.totalMoney)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {categoryRows.length > 0 && (
                    <div className="mt-4 border-t border-card-border pt-3">
                      <p className="mb-2 text-xs font-semibold tracking-widest text-card-text-faint uppercase">Category spend</p>
                      {categoryRows.map(([name, value]) => (
                        <Row key={name} label={name} value={money(value)} />
                      ))}
                    </div>
                  )}
                </Card>
                <Card title="Price changes ≥10%">
                  {d.priceChanges.length === 0 ? (
                    <p className="text-sm text-card-text-muted">No significant approved price changes in this period.</p>
                  ) : (
                    <div className="space-y-2">
                      {d.priceChanges.slice(0, 10).map((row, i) => (
                        <div key={`${row.description}-${row.effectiveDate}-${i}`} className="flex justify-between gap-2 border-b border-card-border py-2 last:border-0">
                          <div>
                            <p className="text-sm text-card-text">{row.description}</p>
                            <p className="text-xs text-card-text-muted">{row.effectiveDate} · {money(row.previousUnitPrice)} → {money(row.unitPrice)}</p>
                          </div>
                          <p className="text-sm font-semibold text-card-text">{pctDelta(row.changePct * 100)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <Card title="Inventory">
                  <p className="mb-3 text-xs text-card-text-muted">
                    {d.inventorySummary.count} items · {d.inventorySummary.low} low/critical · {d.inventorySummary.stale} stale
                  </p>
                  {d.inventory.length === 0 ? (
                    <p className="text-sm text-card-text-muted">No inventory items in this scope.</p>
                  ) : (
                    <div className="space-y-2">
                      {d.inventory.slice(0, 12).map((item) => (
                        <div key={String(item._id || item.id || item.name)} className="flex justify-between gap-2 border-b border-card-border py-2 last:border-0">
                          <div>
                            <p className="text-sm text-card-text">{item.name}</p>
                            <p className="text-xs text-card-text-muted">{item.currentQuantity} {item.unit} · par {item.parLevel}</p>
                          </div>
                          <Pill tone={item.stockStatus === 'critical' ? 'danger' : item.stale || item.stockStatus === 'low' ? 'warning' : 'success'} variant="outline" size="sm">
                            {item.stale ? 'stale' : item.stockStatus}
                          </Pill>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
                <Card title="Reviews, SEO & direct">
                  <div className="space-y-2 text-sm">
                    <Row label="Reviews" value={`${d.reviewSummary.count} · avg ${d.reviewSummary.averageRating == null ? 'Unavailable' : d.reviewSummary.averageRating.toFixed(2)} · ${d.reviewSummary.urgent} urgent`} />
                    <Row label="GA4 sessions" value={d.seoSummary.ga4.sessions == null ? 'Unavailable' : String(d.seoSummary.ga4.sessions)} />
                    <Row label="Search Console clicks" value={d.seoSummary.gsc.clicks == null ? 'Unavailable' : String(d.seoSummary.gsc.clicks)} />
                    <Row label="Direct-order revenue" value={money(d.seoSummary.squareDirect.revenue)} />
                    <Row label="Open alerts" value={`${d.alertSummary.open} open · ${d.alertSummary.critical} critical`} />
                    <Row label="Forecast rows" value={String(d.forecasts.length)} />
                  </div>
                </Card>
              </div>

              <Card title="Alerts & forecasts">
                <div className="grid gap-5 lg:grid-cols-2">
                  <div>
                    <p className="mb-2 text-xs font-semibold tracking-widest text-card-text-faint uppercase">Alerts</p>
                    {d.alerts.length === 0 ? (
                      <p className="text-sm text-card-text-muted">No alerts in this period.</p>
                    ) : d.alerts.slice(0, 8).map((alert) => (
                      <div key={alert._id} className="border-b border-card-border py-2 last:border-0">
                        <p className="text-sm text-card-text">{alert.title}</p>
                        <p className="text-xs text-card-text-muted">{alert.severity} · {alert.status} · {alert.type}</p>
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-semibold tracking-widest text-card-text-faint uppercase">Forecasts</p>
                    {d.forecasts.length === 0 ? (
                      <p className="text-sm text-card-text-muted">No forecast rows in this period.</p>
                    ) : d.forecasts.slice(0, 8).map((row, i) => (
                      <div key={String(row._id || i)} className="flex justify-between gap-2 border-b border-card-border py-2 last:border-0">
                        <div>
                          <p className="text-sm text-card-text">{typeof row.locationId === 'object' && row.locationId ? row.locationId.name : 'Location'}</p>
                          <p className="text-xs text-card-text-muted">Week {row.weekStart} · {row.status}</p>
                        </div>
                        <p className="text-sm font-semibold text-card-text">{money(row.expectedMoney)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </div>
          )
        }}
      </QueryState>
    </AppShell>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1">
      <span className="text-card-text-muted">{label}</span>
      <span className="text-right font-medium text-card-text tabular-nums">{value}</span>
    </div>
  )
}

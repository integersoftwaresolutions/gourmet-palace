import { Link, useParams } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'
import { OperationsTabs } from '../components/layout/SectionTabs'
import { QueryState, DualPanelSkeleton } from '../components/query'
import { Card, Pill } from '../components/ui'
import { vendorsApi } from '../lib/api'
import { useAsyncResource } from '../hooks/useAsyncResource'
import { money } from '../lib/format'
import { useAppState } from '../context/useAppState'

export function OperationsVendorDetail() {
  const { id = '' } = useParams()
  const { query } = useAppState()
  const { data, error, isLoading, isRefreshing, reload } = useAsyncResource(
    () => vendorsApi.get(id, query).then((r) => r.data),
    [id, query],
    { fallbackError: 'Unable to load vendor' },
  )

  const name = data?.vendor && typeof data.vendor === 'object'
    ? String((data.vendor as { name?: string }).name || 'Vendor')
    : 'Vendor'

  return (
    <AppShell
      title={name}
      subtitle="Approved-invoice spend, purchased items and price history"
      activeNav="operations"
    >
      <OperationsTabs value="vendors" />
      <p className="mb-3 text-sm">
        <Link to="/operations/vendors" className="text-accent">← All vendors</Link>
      </p>
      <QueryState data={data} error={error} isLoading={isLoading} isRefreshing={isRefreshing} onRetry={reload} loader={<DualPanelSkeleton />}>
        {(d) => {
          const summary = d.summary || {}
          return (
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <p className="text-[10px] font-semibold tracking-[0.2em] text-card-text-faint uppercase">Approved spend</p>
                  <p className="mt-2 text-2xl font-semibold text-card-text">{money(summary.approvedSpend)}</p>
                </Card>
                <Card>
                  <p className="text-[10px] font-semibold tracking-[0.2em] text-card-text-faint uppercase">Invoices</p>
                  <p className="mt-2 text-2xl font-semibold text-card-text">{String(summary.invoiceCount ?? 0)}</p>
                </Card>
                <Card>
                  <p className="text-[10px] font-semibold tracking-[0.2em] text-card-text-faint uppercase">Purchased items</p>
                  <p className="mt-2 text-2xl font-semibold text-card-text">{String(summary.purchasedItemCount ?? 0)}</p>
                </Card>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <Card title="Invoices">
                  {(d.invoices || []).length === 0 ? (
                    <p className="text-sm text-card-text-muted">No approved invoices in this period.</p>
                  ) : d.invoices.map((invoice) => (
                    <div key={invoice._id} className="flex justify-between gap-2 border-b border-card-border py-2 last:border-0">
                      <div>
                        <p className="text-sm text-card-text">{invoice.invoiceNumber || invoice._id}</p>
                        <p className="text-xs text-card-text-muted">{invoice.invoiceDate}</p>
                      </div>
                      <p className="text-sm font-semibold text-card-text">{money(invoice.totalMoney)}</p>
                    </div>
                  ))}
                </Card>
                <Card title="Purchased items">
                  {(d.purchasedItems || []).length === 0 ? (
                    <p className="text-sm text-card-text-muted">No purchased items in this period.</p>
                  ) : d.purchasedItems.slice(0, 20).map((item, i) => (
                    <div key={`${String(item.description)}-${i}`} className="flex justify-between gap-2 border-b border-card-border py-2 last:border-0">
                      <div>
                        <p className="text-sm text-card-text">{String(item.description)}</p>
                        <p className="text-xs text-card-text-muted">{String(item.category || 'other')} · {String(item.unit || '')}</p>
                      </div>
                      <p className="text-sm font-semibold text-card-text">{money(item.spendMoney)}</p>
                    </div>
                  ))}
                </Card>
              </div>

              <Card title="Price changes">
                {(d.priceChanges || []).length === 0 ? (
                  <p className="text-sm text-card-text-muted">No price changes in this period.</p>
                ) : d.priceChanges.slice(0, 20).map((row, i) => (
                  <div key={String(row.observationId || i)} className="flex flex-wrap items-center justify-between gap-2 border-b border-card-border py-2 last:border-0">
                    <div>
                      <p className="text-sm text-card-text">{String(row.description)}</p>
                      <p className="text-xs text-card-text-muted">
                        {String(row.effectiveDate)} · {money(row.previousUnitPrice)} → {money(row.unitPrice)}
                      </p>
                    </div>
                    <Pill tone={Number(row.changePct) >= 0.1 ? 'warning' : 'neutral'} variant="outline" size="sm">
                      {Number(row.changePct) >= 0 ? '+' : ''}{(Number(row.changePct) * 100).toFixed(1)}%
                    </Pill>
                  </div>
                ))}
              </Card>
            </div>
          )
        }}
      </QueryState>
    </AppShell>
  )
}

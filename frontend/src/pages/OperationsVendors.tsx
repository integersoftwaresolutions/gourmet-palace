import { Link } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'
import { OperationsTabs } from '../components/layout/SectionTabs'
import { QueryState, ListSkeleton } from '../components/query'
import { Card } from '../components/ui'
import { vendorsApi } from '../lib/api'
import { useAsyncResource } from '../hooks/useAsyncResource'
import { money } from '../lib/format'
import { useAppState } from '../context/useAppState'

export function OperationsVendors() {
  const { query } = useAppState()
  const { data, error, isLoading, isRefreshing, reload } = useAsyncResource(
    () => vendorsApi.list(query).then((r) => r.data.vendors),
    [query],
    { fallbackError: 'Unable to load vendors' },
  )

  return (
    <AppShell title="Vendors" subtitle="Approved-invoice spend and price observations" activeNav="operations">
      <OperationsTabs value="vendors" />
      <QueryState data={data} error={error} isLoading={isLoading} isRefreshing={isRefreshing} onRetry={reload} loader={<ListSkeleton />}>
        {(rows) => (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {rows.length === 0 ? <Card><p className="text-sm text-card-text-muted">No approved vendor spend in this period.</p></Card> : rows.map((row, i) => {
            const id = String(row._id || row.vendorId || '')
            const name = String(row.name || row.vendorName || 'Unknown vendor')
            return (
            <Card key={id || String(i)} className="flex min-h-[210px] flex-col">
              <div className="flex items-start justify-between gap-3"><div>{id ? <Link to={`/operations/vendors/${id}`} className="text-base font-semibold text-card-text hover:text-accent">{name}</Link> : <p className="text-base font-semibold text-card-text">{name}</p>}<p className="mt-2 text-xs text-card-text-muted">{String(row.invoiceCount ?? 0)} approved invoices</p></div><span className="rounded-full border border-card-border px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-card-text-muted">Approved</span></div>
              <div className="mt-6 border-t border-card-border pt-5"><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-card-text-muted">Approved spend</p><p className="mt-2 text-2xl font-semibold text-card-text">{money(row.totalApprovedSpend ?? row.totalMoney ?? row.spendMoney, 2)}</p></div>
              {id && <Link to={`/operations/vendors/${id}`} className="mt-auto pt-6 text-sm font-medium text-accent">View full price history →</Link>}
            </Card>
            )
          })}
        </div>
        )}
      </QueryState>
    </AppShell>
  )
}

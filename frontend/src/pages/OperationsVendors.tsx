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
        <Card>
          {rows.length === 0 ? <p className="text-sm text-card-text-muted">No approved vendor spend in this period.</p> : rows.map((row, i) => {
            const id = String(row._id || row.vendorId || '')
            const name = String(row.name || row.vendorName || 'Unknown vendor')
            return (
            <div key={id || String(i)} className="flex items-center justify-between border-b border-card-border py-3 last:border-0">
              <div>
                {id ? (
                  <Link to={`/operations/vendors/${id}`} className="text-sm font-medium text-accent">{name}</Link>
                ) : (
                  <p className="text-sm font-medium text-card-text">{name}</p>
                )}
                <p className="text-xs text-card-text-muted">{String(row.invoiceCount ?? 0)} approved invoices</p>
              </div>
              <p className="text-sm font-semibold text-card-text">{money(row.totalApprovedSpend ?? row.totalMoney ?? row.spendMoney)}</p>
            </div>
            )
          })}
        </Card>
        )}
      </QueryState>
    </AppShell>
  )
}

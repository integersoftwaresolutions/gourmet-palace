import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'
import { OperationsTabs } from '../components/layout/SectionTabs'
import { QueryError, QueryState, ListSkeleton } from '../components/query'
import { Button, Card, Pill } from '../components/ui'
import { invoicesApi, type InvoiceRecord } from '../lib/api'
import { asyncMessage } from '../lib/asyncError'
import { useAsyncResource } from '../hooks/useAsyncResource'
import { money } from '../lib/format'
import { useAppState } from '../context/useAppState'

export function OperationsInvoices() {
  const { query, locations } = useAppState()
  const { data, error, isLoading, isRefreshing, reload } = useAsyncResource(
    () => invoicesApi.list(query).then((r) => r.data.invoices),
    [query],
    { fallbackError: 'Unable to load invoices' },
  )
  const [actionError, setActionError] = useState('')

  const names = Object.fromEntries(locations.map((l) => [l.id, l.name]))
  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn()
      setActionError('')
      reload()
    } catch (e) {
      setActionError(asyncMessage(e, 'Invoice action failed'))
    }
  }
  const confirmApprove = (invoice: InvoiceRecord) => act(async () => {
    await invoicesApi.review(invoice._id, {
      vendorName: invoice.vendorName,
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDate,
      totalMoney: invoice.totalMoney,
      highRiskConfirmed: true,
      duplicateDisposition: invoice.duplicateCandidateIds?.length ? 'not_duplicate' : '',
    })
    await invoicesApi.approve(invoice._id)
  })

  return (
    <AppShell title="Invoices" subtitle="Approved invoices only feed food-cost and vendor spend" activeNav="operations" actions={<Link to="/operations/invoice-ocr"><Button size="sm">Upload invoice</Button></Link>}>
      <OperationsTabs value="invoices" />
      {actionError ? <QueryError message={actionError} className="mt-4" /> : null}
      <QueryState data={data} error={error} isLoading={isLoading} isRefreshing={isRefreshing} onRetry={reload} loader={<ListSkeleton />}>
        {(rows) => (
        <Card>
          {rows.length === 0 ? <p className="text-sm text-card-text-muted">No invoices in this scope.</p> : rows.map((invoice) => (
            <div key={invoice._id} className="flex flex-wrap items-center justify-between gap-3 border-b border-card-border py-3 last:border-0">
              <div>
                <p className="text-sm font-medium text-card-text">{invoice.vendorName || 'Unknown vendor'} · {invoice.invoiceNumber || 'No number'}</p>
                <p className="text-xs text-card-text-muted">{invoice.invoiceDate} · {names[invoice.locationId] || invoice.locationId} · {money(invoice.totalMoney)}</p>
              </div>
              <div className="flex items-center gap-2">
                <Pill tone={invoice.status === 'APPROVED' ? 'success' : invoice.status === 'FAILED' || invoice.status === 'REJECTED' ? 'danger' : 'warning'} variant="outline">{invoice.status}</Pill>
                {['PENDING_REVIEW', 'FAILED'].includes(invoice.status) && <Button size="sm" onClick={() => void confirmApprove(invoice)}>Confirm & approve</Button>}
                {invoice.status !== 'APPROVED' && invoice.status !== 'REJECTED' && <Button size="sm" variant="outline" onClick={() => void act(() => invoicesApi.reject(invoice._id, 'Rejected in Operations'))}>Reject</Button>}
              </div>
            </div>
          ))}
        </Card>
        )}
      </QueryState>
    </AppShell>
  )
}

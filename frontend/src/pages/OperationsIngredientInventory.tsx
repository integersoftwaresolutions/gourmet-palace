import { useState } from 'react'
import { AppShell } from '../components/layout/AppShell'
import { OperationsTabs } from '../components/layout/SectionTabs'
import { QueryError, QueryState, ListSkeleton } from '../components/query'
import { Button, Card, Pill } from '../components/ui'
import { inventoryApi } from '../lib/api'
import { asyncMessage } from '../lib/asyncError'
import { useAsyncResource } from '../hooks/useAsyncResource'
import { useAppState } from '../context/useAppState'

export function OperationsIngredientInventory() {
  const { query } = useAppState()
  const { data, error, isLoading, isRefreshing, reload } = useAsyncResource(
    () => inventoryApi.list(query).then((r) => r.data.items),
    [query],
    { fallbackError: 'Unable to load inventory' },
  )
  const [actionError, setActionError] = useState('')

  const count = async (id: string, quantity: number) => {
    try {
      await inventoryApi.count(id, { quantity })
      setActionError('')
      reload()
    } catch (e) {
      setActionError(asyncMessage(e, 'Count failed'))
    }
  }

  return (
    <AppShell title="Ingredient inventory" subtitle="Manual counts, par levels and stale/critical status" activeNav="operations">
      <OperationsTabs value="inventory" />
      {actionError ? <QueryError message={actionError} className="mt-4" /> : null}
      <QueryState data={data} error={error} isLoading={isLoading} isRefreshing={isRefreshing} onRetry={reload} loader={<ListSkeleton />}>
        {(rows) => (
        <Card>
          {rows.length === 0 ? <p className="text-sm text-card-text-muted">No inventory items in this scope.</p> : rows.map((item) => (
            <div key={item._id || item.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-card-border py-3 last:border-0">
              <div>
                <p className="text-sm font-medium text-card-text">{item.name}</p>
                <p className="text-xs text-card-text-muted">{item.currentQuantity} {item.unit} · par {item.parLevel}{item.daysRemaining != null ? ` · ~${item.daysRemaining.toFixed(1)} days` : ''}</p>
              </div>
              <div className="flex items-center gap-2">
                <Pill tone={item.stockStatus === 'critical' ? 'danger' : item.stockStatus === 'low' || item.stale ? 'warning' : 'success'} variant="outline">{item.stale ? 'stale' : item.stockStatus}</Pill>
                <Button size="sm" variant="outline" onClick={() => void count(String(item._id || item.id), item.currentQuantity)}>Recount current</Button>
              </div>
            </div>
          ))}
        </Card>
        )}
      </QueryState>
    </AppShell>
  )
}

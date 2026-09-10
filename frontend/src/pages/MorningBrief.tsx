import { useState } from 'react'
import { AppShell } from '../components/layout/AppShell'
import { QueryError, QueryState, SplitDetailSkeleton } from '../components/query'
import { Button, Card, KpiCard, Pill } from '../components/ui'
import { briefsApi, type BriefRecord } from '../lib/api'
import { asyncMessage } from '../lib/asyncError'
import { useAsyncResource } from '../hooks/useAsyncResource'
import { useAppState } from '../context/useAppState'
import { useAuth } from '../context/useAuth'
import { cn } from '../lib/cn'

const money = (value: unknown) => typeof value === 'number'
  ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value / 100)
  : 'Unavailable'
const object = (value: unknown) => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
const records = (value: unknown) => Array.isArray(value) ? value as Array<Record<string, unknown>> : []

export function MorningBrief() {
  const { query } = useAppState()
  const { isAdmin } = useAuth()
  const { data: briefs, error, isLoading, isRefreshing, reload } = useAsyncResource(
    () => briefsApi.list(query).then((response) => response.data.briefs),
    [query],
    { fallbackError: 'Unable to load briefs' },
  )
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')

  const generate = async () => {
    setBusy(true)
    setActionError('')
    try {
      const fallback = new Date()
      fallback.setDate(fallback.getDate() - 1)
      const businessDate = query.to || query.from || fallback.toISOString().slice(0, 10)
      await briefsApi.generate(businessDate)
      reload()
    } catch (e) {
      setActionError(asyncMessage(e, 'Unable to generate brief'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppShell
      title="Morning Executive Brief"
      subtitle="Immutable prior-day evidence snapshots, delivered at the 5:00 AM Pacific target"
      activeNav="brief"
      contained
      actions={isAdmin ? <Button size="sm" variant="outline" onClick={() => void generate()} disabled={busy}>{busy ? 'Generating…' : 'Generate / refresh'}</Button> : undefined}
    >
      {actionError ? <QueryError message={actionError} className="mb-4" /> : null}
      <QueryState data={briefs} error={error} isLoading={isLoading} isRefreshing={isRefreshing} onRetry={reload} loader={<SplitDetailSkeleton />} className="mt-0 flex min-h-0 flex-1 flex-col">
        {(briefs) => {
          const selected = briefs.find((brief) => brief._id === selectedId) || briefs[0] || null
          return <BriefBody briefs={briefs} selected={selected} onSelect={setSelectedId} isAdmin={isAdmin} />
        }}
      </QueryState>
    </AppShell>
  )
}

function BriefBody({
  briefs,
  selected,
  onSelect,
  isAdmin,
}: {
  briefs: BriefRecord[]
  selected: BriefRecord | null
  onSelect: (id: string) => void
  isAdmin: boolean
}) {
  const content = object(selected?.content)
  const core = object(content.core)
  const exceptions = object(content.exceptions)
  const finance = object(content.finance)
  const best = object(content.bestLocation)
  const weakest = object(content.weakestLocation)
  const priorities = records(content.priorities)

  return (
    <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_minmax(0,2fr)] gap-5 lg:grid-cols-[17rem_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] xl:grid-cols-[19rem_minmax(0,1fr)] print:block">
      <aside aria-label="Brief history" className="min-h-0 overflow-y-auto overscroll-contain rounded-xl border border-card-border bg-card [scrollbar-gutter:stable] print:hidden">
        <div className="space-y-2 p-3">
          {briefs.length === 0 && <p className="text-sm text-card-text-muted">No briefs have been published yet.</p>}
          {briefs.map((brief) => (
            <button
              type="button"
              key={brief._id}
              onClick={() => onSelect(brief._id)}
              aria-current={selected?._id === brief._id ? 'true' : undefined}
              aria-controls="brief-detail"
              className={cn(
                'block w-full rounded-lg border p-3 text-left transition-colors',
                selected?._id === brief._id
                  ? 'border-card-border-strong bg-card-active'
                  : 'border-card-border hover:bg-card-hover',
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-card-text">{brief.businessDate}</span>
              </span>
              <span className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-card-text-muted">Revision {brief.revision}</span>
                <Pill tone={brief.status === 'COMPLETE' ? 'success' : 'warning'} variant="outline" size="sm">{brief.status}</Pill>
              </span>
              <span className="mt-2 block text-xs leading-relaxed text-card-text-muted">
                Published {new Date(brief.publishedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </span>
            </button>
          ))}
        </div>
      </aside>

      <section id="brief-detail" tabIndex={0} aria-label={selected ? `Brief for ${selected.businessDate}, revision ${selected.revision}` : 'Brief details'} className="min-h-0 min-w-0 space-y-5 overflow-y-auto overscroll-contain [scrollbar-gutter:stable] print:overflow-visible">
        {selected ? (
          <>
            <Card title={`${selected.businessDate} · Revision ${selected.revision}`} action={<Pill tone={selected.status === 'COMPLETE' ? 'success' : 'warning'} variant="outline">{selected.status}</Pill>}>
              <p className="text-sm text-card-text-muted">{String(content.headline || '')}</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <KpiCard label="Net sales" value={money(core.netMoney)} meta="Frozen canonical snapshot" />
                <KpiCard label="Orders" value={String(core.orderCount ?? 'Unavailable')} meta={core.averageTicket == null ? 'Average ticket unavailable' : `Avg ticket ${money(core.averageTicket)}`} />
                <KpiCard
                  label="Business health"
                  value={content.businessHealth == null ? 'Unavailable' : `${String(content.businessHealth)}/100`}
                  meta={`Coverage ${String(content.businessHealthCoverage ?? '—')}%${object(content.businessHealthComparison).change == null ? '' : ` · ${Number(object(content.businessHealthComparison).change) >= 0 ? '+' : ''}${Number(object(content.businessHealthComparison).change).toFixed(1)} vs comparable day`}`}
                />
              </div>
            </Card>

            <Card title="Store ranking & exceptions">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-card-border p-3">
                  <p className="text-xs uppercase text-card-text-faint">Best store</p>
                  <p className="mt-1 font-medium text-card-text">{best.name ? `${String(best.name)} · ${String(best.score)}/100` : 'Unavailable'}</p>
                </div>
                <div className="rounded-lg border border-card-border p-3">
                  <p className="text-xs uppercase text-card-text-faint">Weakest store</p>
                  <p className="mt-1 font-medium text-card-text">{weakest.name ? `${String(weakest.name)} · ${String(weakest.score)}/100` : 'Unavailable'}</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                <div><span className="block text-card-text-faint">Refunds</span><span className="text-card-text">{money(exceptions.refundMoney)}</span></div>
                <div><span className="block text-card-text-faint">Voids</span><span className="text-card-text">{money(exceptions.voidMoney)}</span></div>
                <div><span className="block text-card-text-faint">Discounts</span><span className="text-card-text">{money(exceptions.discountMoney)}</span></div>
              </div>
            </Card>

            {isAdmin && (
              <Card title="Finance estimates">
                <div className="grid gap-3 sm:grid-cols-2">
                  <KpiCard
                    label="Estimated profit"
                    value={money(finance.estimatedProfitAtSelectedMargin)}
                    meta={finance.selectedMargin == null ? 'Selected margin unavailable' : `At ${(Number(finance.selectedMargin) * 100).toFixed(1)}% selected margin`}
                  />
                  <KpiCard
                    label="Approved food purchases"
                    value={money(finance.approvedFoodPurchases)}
                    meta={finance.foodCostPercent == null ? 'Purchase-based estimate' : `${(Number(finance.foodCostPercent) * 100).toFixed(1)}% of net sales`}
                  />
                </div>
              </Card>
            )}
            <div className="grid gap-5 lg:grid-cols-3">
              <Card title="Inventory">
                <p className="text-sm text-card-text">{String(object(content.inventory).count ?? 0)} active items · {String(object(content.inventory).critical ?? 0)} below par or zero</p>
              </Card>
              <Card title="Forecast">
                <p className="text-sm text-card-text">{money(object(content.forecast).expectedMoney)} expected</p>
                <p className="mt-1 text-xs text-card-text-muted">{String(object(content.forecast).status || 'UNAVAILABLE')} · week {String(object(content.forecast).weekStart || '—')}</p>
              </Card>
              <Card title="SEO & reviews">
                <p className="text-sm text-card-text">{String(object(content.growth).reviewCount ?? 0)} reviews · {String(object(content.growth).seoCount ?? 0)} SEO records</p>
              </Card>
            </div>

            <Card title="Top priorities">
              <div className="space-y-3">
                {priorities.length
                  ? priorities.map((priority, index) => (
                    <div key={String(priority.ref || index)} className="rounded-lg border border-card-border p-3">
                      <p className="font-medium text-card-text">{index + 1}. {String(priority.title || 'Priority')}</p>
                      <p className="mt-1 text-sm text-card-text-muted">{String(priority.detail || '')}</p>
                      {priority.nextAction ? <p className="mt-2 text-xs text-card-text"><span className="font-semibold">Suggested next action:</span> {String(priority.nextAction)}</p> : null}
                    </div>
                  ))
                  : <p className="text-sm text-card-text-muted">No material priority was generated from the frozen evidence snapshot.</p>}
              </div>
            </Card>
          </>
        ) : <Card><p className="text-sm text-card-text-muted">No brief is available for your authorized scope yet.</p></Card>}
      </section>
    </div>
  )
}

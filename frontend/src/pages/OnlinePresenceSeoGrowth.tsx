import { AppShell } from '../components/layout/AppShell'
import { PresenceTabs } from '../components/layout/SectionTabs'
import { QueryState, DualPanelSkeleton, KpiRowSkeleton } from '../components/query'
import { CommandCenterMetric } from '../components/command-center/CommandCenterMetric'
import { Card, Pill } from '../components/ui'
import { analyticsApi, type PresenceData } from '../lib/api'
import { useAsyncResource } from '../hooks/useAsyncResource'
import { money } from '../lib/format'
import { formatPriorBusinessDay } from '../lib/commandCenterHelpers'
import { useAppState } from '../context/useAppState'

function deltaLabel(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return null
  return value
}

function fmtCount(value: number | null | undefined) {
  if (value == null) return 'Unavailable'
  return value.toLocaleString('en-US')
}

function fmtPct(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return 'Unavailable'
  return `${(value * 100).toFixed(1)}%`
}

function fmtPos(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return 'Unavailable'
  return value.toFixed(1)
}

export function OnlinePresenceSeoGrowth() {
  const { query } = useAppState()
  const { data, error, isLoading, isRefreshing, reload } = useAsyncResource(
    () => analyticsApi.presence(query).then((res) => res.data),
    [query],
    { fallbackError: 'Unable to load SEO & growth' },
  )

  return (
    <AppShell
      title="SEO & Growth"
      subtitle={
        data
          ? `${formatPriorBusinessDay(data.range.from)} → ${formatPriorBusinessDay(data.range.to)} · GA4, Search Console, GBP and direct orders`
          : 'GA4, Search Console, GBP and direct-order evidence'
      }
      activeNav="presence"
    >
      <PresenceTabs value="seo" />
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
        {(d: PresenceData) => {
          const s = d.summary
          return (
          <div className="space-y-5">
            <p className="rounded-xl border border-card-border px-4 py-3 text-xs text-card-text-muted">
              Organic traffic and direct-order performance are shown side by side for correlation only. This is not attribution unless an approved join exists.
            </p>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <CommandCenterMetric
                label="GA4 sessions"
                value={fmtCount(s.ga4.sessions)}
                delta={deltaLabel(s.ga4.sessionsPct)}
                deltaLabel="VS prior"
                meta={s.ga4.status === 'UNAVAILABLE' ? 'Unavailable' : `Key events ${fmtCount(s.ga4.keyEvents)} · daily users sum is not unique`}
              />
              <CommandCenterMetric
                label="Search Console clicks"
                value={fmtCount(s.gsc.clicks)}
                delta={deltaLabel(s.gsc.clicksPct)}
                deltaLabel="VS prior"
                meta={s.gsc.status === 'UNAVAILABLE' ? 'Unavailable' : `CTR ${fmtPct(s.gsc.ctr)} · SC position ${fmtPos(s.gsc.position)}`}
              />
              <CommandCenterMetric
                label="GBP website clicks"
                value={fmtCount(s.gbp.websiteClicks)}
                delta={deltaLabel(s.gbp.websiteClicksPct)}
                deltaLabel="VS prior"
                meta={s.gbp.status === 'UNAVAILABLE' ? 'Unavailable' : `Calls ${fmtCount(s.gbp.callClicks)} · directions ${fmtCount(s.gbp.directionRequests)}`}
              />
              <CommandCenterMetric
                label="Direct-order revenue"
                value={money(s.squareDirect.revenue)}
                delta={deltaLabel(s.squareDirect.revenuePct)}
                deltaLabel="VS prior"
                meta={s.squareDirect.status === 'UNAVAILABLE' ? 'Unavailable until Square direct mapping produces rows' : `${fmtCount(s.squareDirect.orders)} orders`}
              />
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <Card title="Recommendations">
                {(d.recommendations || []).length === 0 ? (
                  <p className="text-sm text-card-text-muted">No decline or CTR recommendation in this period.</p>
                ) : (
                  <ul className="space-y-3 text-sm text-card-text">
                    {d.recommendations.map((row, i) => (
                      <li key={`${row.source}-${row.metric}-${i}`} className="rounded-lg border border-card-border px-3 py-3">
                        <div className="mb-1 flex flex-wrap gap-2">
                          <Pill tone="warning" variant="outline" size="sm">{row.confidence}</Pill>
                          <Pill tone="neutral" variant="outline" size="sm">{row.source} · {row.metric}</Pill>
                        </div>
                        <p>{row.recommendation}</p>
                        <p className="mt-1 text-xs text-card-text-faint">
                          Period {row.period.from} → {row.period.to}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card title="Source coverage">
                <div className="space-y-2 text-sm">
                  <CoverageRow label="GA4" status={s.ga4.status} detail={`Sessions ${fmtCount(s.ga4.sessions)}`} />
                  <CoverageRow label="Search Console" status={s.gsc.status} detail={`Clicks ${fmtCount(s.gsc.clicks)} · impressions ${fmtCount(s.gsc.impressions)}`} />
                  <CoverageRow label="GBP" status={s.gbp.status} detail={`Website clicks ${fmtCount(s.gbp.websiteClicks)}`} />
                  <CoverageRow label="Direct orders" status={s.squareDirect.status} detail={money(s.squareDirect.revenue)} />
                  <CoverageRow label="Queries & pages" status={s.gsc.queriesPagesStatus} detail="Unavailable — V1 stores Search Console date totals, not query/page rows" />
                  <p className="pt-2 text-xs text-card-text-faint">
                    Average position is Search Console performance, not a third-party exact rank tracker.
                    {s.freshnessAt ? ` · Freshness ${new Date(s.freshnessAt).toLocaleString()}` : ''}
                  </p>
                </div>
              </Card>
            </div>

            <Card title="By location">
              {(d.locations || []).length === 0 ? (
                <p className="text-sm text-card-text-muted">No SEO or direct-order metrics stored for this range.</p>
              ) : (
                <div className="space-y-2">
                  {d.locations.map((row) => (
                    <div key={row.locationId} className="grid gap-2 border-b border-card-border py-3 last:border-0 md:grid-cols-5">
                      <p className="text-sm font-medium text-card-text md:col-span-1">{row.locationName}</p>
                      <p className="text-xs text-card-text-muted">GA4 {fmtCount(row.ga4Sessions)}</p>
                      <p className="text-xs text-card-text-muted">GSC {fmtCount(row.gscClicks)}</p>
                      <p className="text-xs text-card-text-muted">GBP {fmtCount(row.gbpClicks)}</p>
                      <p className="text-xs text-card-text-muted">Direct {money(row.directRevenue)}</p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
          )
        }}
      </QueryState>
    </AppShell>
  )
}

function CoverageRow({ label, status, detail }: { label: string; status: string; detail: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-card-border px-3 py-2">
      <div>
        <p className="text-sm text-card-text">{label}</p>
        <p className="text-xs text-card-text-muted">{detail}</p>
      </div>
      <Pill tone={status === 'COMPLETE' ? 'success' : 'neutral'} variant="outline" size="sm">{status}</Pill>
    </div>
  )
}

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'
import { AlertRow } from '../components/command-center/AlertRow'
import { CommandCenterMetric } from '../components/command-center/CommandCenterMetric'
import { PriorityChip } from '../components/command-center/PriorityChip'
import { RankingRow } from '../components/command-center/RankingRow'
import { QueryState, CommandCenterSkeleton } from '../components/query'
import { Button, Card, CircularProgress, Pill } from '../components/ui'
import {
  analyticsApi,
  briefsApi,
  type DashboardData,
} from '../lib/api'
import { useAsyncResource } from '../hooks/useAsyncResource'
import {
  alertLocationLine,
  briefHeadline,
  comparisonDeltaLabel,
  comparisonWeekdayLabel,
  enrichPriorities,
  firstName,
  formatHeaderDate,
  formatPriorBusinessDay,
  healthStatusLabel,
  locationRankSubtitle,
  priorityDetail,
  severityStatusLabel,
} from '../lib/commandCenterHelpers'
import { dateRange, money, publishedDateTime } from '../lib/format'
import { useAppState } from '../context/useAppState'
import { useAuth } from '../context/useAuth'

function locName(
  id: string | { _id: string; name: string } | null | undefined,
): string {
  if (!id) return 'Location'
  return typeof id === 'object' ? id.name : 'Location'
}

function locId(id: string | { _id: string; name: string } | null | undefined): string {
  if (!id) return ''
  return typeof id === 'object' ? id._id : String(id)
}

function priorityTitle(priority: DashboardData['priorities'][number]): string {
  if (priority.type === 'exceptions_above_normal') return 'Refund spike'
  if (priority.type === 'vendor_price_increase') {
    const name = priority.title.replace(/^Vendor price increase:\s*/i, '')
    return name ? `${name} cost` : 'Vendor price increase'
  }
  if (priority.type === 'food_cost_above_target') return 'Food cost'
  if (priority.type === 'review_replies_pending') return 'Review replies'
  if (priority.type === 'sales_below_normal') return 'Sales below normal'
  return priority.title
}

export function OverviewPage() {
  const { query, locations, datePreset, comparisonMode } = useAppState()
  const { user } = useAuth()
  const { data: page, error, isLoading, isRefreshing, reload } = useAsyncResource(
    async () => {
      const briefQuery: Record<string, string> =
        query.from && query.to && query.from === query.to
          ? { businessDate: query.from }
          : {}
      const [dashRes, briefRes] = await Promise.all([
        analyticsApi.dashboard(query),
        briefsApi.current(briefQuery),
      ])
      return { dashboard: dashRes.data, brief: briefRes.data.brief }
    },
    [query],
    { fallbackError: 'Unable to load dashboard' },
  )
  const data = page?.dashboard ?? null
  const brief = page?.brief ?? null

  const locationNames = useMemo(
    () => new Map(locations.map((l) => [l.id, l.name])),
    [locations],
  )

  const priorDayLabel = data ? formatPriorBusinessDay(data.range.to) : '—'
  const isSingleDay = Boolean(data && data.range.from === data.range.to)
  const vsLabel = data
    ? comparisonDeltaLabel({
        basis: comparisonMode === 'prior-year' ? 'prior-year' : 'previous',
        previousRange: data.comparison.previousRange,
      })
    : undefined

  const scores = data?.scores ?? []
  const best = scores[0]
  const weakest = scores.length ? scores[scores.length - 1] : null
  const briefContent = (brief?.content ?? {}) as Record<string, unknown>
  const priorities = enrichPriorities(data?.priorities ?? [], data?.workflow)
  const alerts = data?.alerts ?? []
  const healthChange = data?.businessHealthComparison.change ?? null
  const healthStatus = healthStatusLabel(healthChange)

  const openAlertTypesByLocation = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const alert of alerts) {
      const id = typeof alert.locationId === 'object' && alert.locationId ? String(alert.locationId._id) : String(alert.locationId || 'org')
      if (!map.has(id)) map.set(id, new Set())
      map.get(id)!.add(alert.type)
    }
    return map
  }, [alerts])

  const greeting = (
    <p className="font-display text-xl italic text-accent-subtle-text md:text-2xl">
      Good morning, {firstName(user?.name)}
    </p>
  )

  return (
    <AppShell
      title="Command Center"
      subtitle={
        data
          ? `${formatHeaderDate()} · prior business day: ${priorDayLabel}`
          : 'Trusted performance view across your authorized Gourmet Palace locations'
      }
      activeNav="overview"
      actions={greeting}
    >
      <QueryState
        data={page}
        error={error}
        isLoading={isLoading}
        isRefreshing={isRefreshing}
        onRetry={reload}
        loader={<CommandCenterSkeleton />}
        className="mt-0"
      >
        {({ dashboard: data, brief }) => (
        <div className="space-y-5">
          <Card
            className="border-accent-border/40 bg-gradient-to-br from-card via-card to-accent-subtle/20"
            padding="lg"
          >
            <div className="flex flex-col items-start justify-between gap-4 xl:flex-row">
              <div className="min-w-0 flex-1">
                <p className="font-display text-lg italic text-accent-subtle-text">
                  Your morning brief
                </p>
                <h2 className="mt-2 text-lg font-semibold leading-snug text-card-text md:text-xl">
                  {briefHeadline(data, briefContent)}
                </h2>
                <p className="mt-2 text-xs text-card-text-muted">
                  {brief?.publishedAt ? publishedDateTime(brief.publishedAt) : 'Brief not published yet'}
                  {' · dashboard'}
                  {brief?.emailStatus === 'sent' ? ' + email' : ''}
                  {brief?.status === 'PARTIAL' ? ' · partial snapshot' : ''}
                </p>
              </div>
              <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:shrink-0">
                <Link to="/morning-brief">
                  <Button size="sm" variant="outline" shape="pill">
                    Full brief
                  </Button>
                </Link>
                <Link to="/morning-brief">
                  <Button size="sm" variant="outline" shape="pill">
                    Past briefs
                  </Button>
                </Link>
              </div>
            </div>

            <div className="mt-6 grid min-w-0 gap-4 break-words sm:grid-cols-2 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)]">
              <div>
                <p className="text-2xl font-semibold tabular-nums text-card-text">
                  {money(data.current.netMoney)}
                </p>
                <p className="mt-1 text-[10px] font-semibold tracking-[0.18em] text-card-text-faint uppercase">
                  {isSingleDay || datePreset === 'yesterday' ? formatPriorBusinessDay(data.range.to) : dateRange(data.range.from, data.range.to)} ·{' '}
                  {query.locationId ? 'Selected store' : 'All stores'}
                </p>
              </div>
              <div>
                <p className="text-lg font-semibold text-success-subtle-text">
                  {best ? locName(best.locationId) : '—'}
                </p>
                <p className="mt-1 text-[10px] font-semibold tracking-[0.18em] text-card-text-faint uppercase">
                  Best performer
                </p>
              </div>
              <div>
                <p className="text-lg font-semibold text-danger-subtle-text">
                  {weakest ? locName(weakest.locationId) : '—'}
                </p>
                <p className="mt-1 text-[10px] font-semibold tracking-[0.18em] text-card-text-faint uppercase">
                  Weakest performer
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold tracking-[0.18em] text-card-text-faint uppercase">
                  Top priorities
                </p>
                <div className="mt-2 space-y-2">
                  {priorities.length === 0 ? (
                    <p className="text-xs text-card-text-muted">No material priorities.</p>
                  ) : (
                    priorities.slice(0, 3).map((p) => (
                      <PriorityChip
                        key={p.ref}
                        severity={p.severity}
                        title={priorityTitle(p)}
                        detail={priorityDetail(
                          p,
                          p.locationId ? locationNames.get(String(p.locationId)) : undefined,
                        )}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>
          </Card>

          {data.dataQuality.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning-border bg-warning-subtle/30 px-4 py-2.5">
              <p className="text-xs text-card-text">
                <span className="font-semibold tracking-wider text-warning-subtle-text uppercase">
                  Data quality:
                </span>{' '}
                {data.dataQuality[0].message}
                {data.dataQuality.length > 1
                  ? ` (+${data.dataQuality.length - 1} more)`
                  : ''}
              </p>
              <Pill tone="warning" variant="outline" size="sm">
                {data.dataQuality[0].status}
              </Pill>
            </div>
          )}

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
            <Card title="Business health score" padding="lg">
              <div className="flex flex-wrap items-center gap-5">
                <CircularProgress
                  value={data.businessHealth}
                  size={108}
                  strokeWidth={9}
                  label={
                    <span className="text-3xl font-semibold tabular-nums text-card-text">
                      {data.businessHealth == null ? '—' : Math.round(data.businessHealth)}
                    </span>
                  }
                />
                <div className="min-w-0 flex-1">
                  <Pill tone="accent" variant="outline" size="sm">
                    {healthStatus}
                  </Pill>
                  <p className="mt-3 text-sm text-card-text-muted">
                    Coverage {data.businessHealthCoverage}%
                    {healthChange != null && (
                      <>
                        {' '}
                        · {healthChange >= 0 ? '+' : ''}
                        {healthChange.toFixed(0)} vs last{' '}
                        {data.businessHealthComparison.businessDate
                          ? comparisonWeekdayLabel(
                              data.businessHealthComparison.businessDate,
                            )
                          : 'comparable'}
                      </>
                    )}
                  </p>
                  <p className="mt-2 text-xs text-card-text-faint">
                    Sales-weighted average of the {scores.length || 'authorized'} location score
                    {scores.length === 1 ? '' : 's'}.
                  </p>
                  <button
                    type="button"
                    className="mt-3 text-xs font-medium text-accent-subtle-text hover:text-accent"
                  >
                    How this is calculated →
                  </button>
                </div>
              </div>
            </Card>

            <Card title={`Location ranking · ${priorDayLabel.toUpperCase()}`} padding="md">
              <div className="space-y-2">
                {scores.length === 0 ? (
                  <p className="text-sm text-card-text-muted">
                    No complete location score is available for the selected ending day.
                  </p>
                ) : (
                  scores.map((s) => {
                    const id = locId(s.locationId)
                    const types = openAlertTypesByLocation.get(id) ?? new Set()
                    return (
                      <RankingRow
                        key={s._id}
                        rank={s.rank}
                        name={locName(s.locationId)}
                        subtitle={locationRankSubtitle(s, types)}
                        score={s.score == null ? null : Math.round(s.score)}
                      />
                    )
                  })
                )}
              </div>
            </Card>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <CommandCenterMetric
              label="Net sales"
              value={money(data.current.netMoney)}
              delta={data.comparison.netSalesPct}
              deltaLabel={vsLabel}
            />
            <CommandCenterMetric
              label="Tickets / checks"
              value={
                data.current.orderCount == null
                  ? 'Unavailable'
                  : data.current.orderCount.toLocaleString()
              }
              delta={data.comparison.ordersPct}
              deltaLabel={vsLabel}
            />
            <CommandCenterMetric
              label="Guests"
              value={
                data.current.guestCount == null
                  ? 'Unavailable'
                  : data.current.guestCount.toLocaleString()
              }
              delta={data.comparison.guestsPct}
              deltaLabel={vsLabel}
            />
            <CommandCenterMetric
              label="Average ticket"
              value={money(data.current.averageTicket)}
              delta={data.comparison.averageTicketPct}
              deltaLabel={vsLabel}
            />
          </div>

          <Card
            title="Active alerts"
            action={
              <Link
                to="/alerts"
                className="text-xs font-medium text-accent-subtle-text hover:text-accent"
              >
                View all alerts →
              </Link>
            }
            padding="md"
          >
            <div className="space-y-2">
              {alerts.length === 0 ? (
                <p className="text-sm text-card-text-muted">
                  No open alerts in the selected scope.
                </p>
              ) : (
                alerts.slice(0, 5).map((alert) => (
                  <AlertRow
                    key={alert._id}
                    severity={alert.severity}
                    title={alert.title}
                    detail={alertLocationLine(alert, locationNames)}
                    statusLabel={severityStatusLabel(alert.severity)}
                  />
                ))
              )}
            </div>
          </Card>

          <div className="flex flex-wrap items-center gap-2 text-xs text-card-text-faint">
            <Pill
              tone={
                data.dataStatus === 'COMPLETE'
                  ? 'success'
                  : data.dataStatus === 'UNAVAILABLE'
                    ? 'neutral'
                    : 'warning'
              }
              variant="outline"
              size="sm"
            >
              {data.dataStatus}
            </Pill>
            <span>Coverage {data.coverage}% · scoped canonical metrics</span>
          </div>
        </div>
        )}
      </QueryState>
    </AppShell>
  )
}

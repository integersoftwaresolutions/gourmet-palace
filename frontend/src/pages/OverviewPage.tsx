import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'
import { CommandCenterMetric } from '../components/command-center/CommandCenterMetric'
import { PriorityChip } from '../components/command-center/PriorityChip'
import { RankingRow } from '../components/command-center/RankingRow'
import { Button, Card, CircularProgress, Pill } from '../components/ui'
import {
  analyticsApi,
  briefsApi,
  type BriefRecord,
  type DashboardData,
} from '../lib/api'
import {
  briefHeadline,
  comparisonWeekdayLabel,
  firstName,
  formatHeaderDate,
  formatPriorBusinessDay,
  healthStatusLabel,
  locationRankSubtitle,
  priorityDetail,
} from '../lib/commandCenterHelpers'
import { money } from '../lib/format'
import { useAppState } from '../context/useAppState'
import { useAuth } from '../context/useAuth'

function locName(
  id: string | { _id: string; name: string } | null | undefined,
): string {
  if (!id) return 'Location'
  return typeof id === 'object' ? id.name : 'Location'
}

function priorityTitle(priority: DashboardData['priorities'][number]): string {
  if (priority.type === 'exceptions_above_normal') return 'Refund spike'
  if (priority.type === 'sales_below_normal') return 'Sales below normal'
  if (priority.type === 'location_underperforming_peers') return 'Location needs attention'
  return priority.title
}

export function OverviewPage() {
  const { query, locations, datePreset, selectedLocationId } = useAppState()
  const { user } = useAuth()
  const [data, setData] = useState<DashboardData | null>(null)
  const [brief, setBrief] = useState<BriefRecord | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const briefQuery: Record<string, string> =
      query.from && query.to && query.from === query.to
        ? { businessDate: query.from }
        : {}
    Promise.all([analyticsApi.dashboard(query), briefsApi.current(briefQuery)])
      .then(([dashRes, briefRes]) => {
        if (cancelled) return
        setError('')
        setData(dashRes.data)
        setBrief(briefRes.data.brief)
      })
      .catch((e) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Unable to load dashboard')
      })
    return () => { cancelled = true }
  }, [query])

  const locationNames = useMemo(
    () => new Map(locations.map((l) => [l.id, l.name])),
    [locations],
  )

  const priorDayLabel = data ? formatPriorBusinessDay(data.range.to) : '—'
  const isSingleDay = Boolean(data && data.range.from === data.range.to)
  const vsLabel = data
    ? `VS ${comparisonWeekdayLabel(data.comparison.previousRange.to)}`
    : undefined

  const scores = data?.scores ?? []
  const best = data?.bestLocation ?? (scores[0] ? { name: locName(scores[0].locationId), score: scores[0].score } : null)
  const weakest = data?.weakestLocation ?? (scores.length ? { name: locName(scores[scores.length - 1].locationId), score: scores[scores.length - 1].score } : null)
  const briefContent = (brief?.content ?? {}) as Record<string, unknown>
  const priorities = data?.priorities ?? []
  const healthChange = data?.businessHealthComparison.change ?? null
  const healthStatus = healthStatusLabel(healthChange)

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
      {error && (
        <Card accentBorder="brand" className="mb-4">
          <p className="text-sm text-danger-subtle-text">{error}</p>
        </Card>
      )}

      {!data ? (
        <Card>
          <p className="text-sm text-card-text-muted">Loading canonical metrics…</p>
        </Card>
      ) : (
        <div className="space-y-5">
          <Card
            className="border-l-[3px] border-l-accent"
            padding="lg"
          >
            <div className="flex items-start justify-between gap-4">
              <p className="font-script text-[1.85rem] leading-none text-accent-subtle-text">
                Your morning brief
              </p>
              <div className="flex shrink-0 gap-2">
                <Link to="/morning-brief">
                  <Button size="sm" variant="outline" shape="pill" className="px-4 font-medium text-card-text">
                    Full brief
                  </Button>
                </Link>
                <Link to="/morning-brief">
                  <Button size="sm" variant="outline" shape="pill" className="px-4 font-medium text-card-text-muted">
                    Past briefs
                  </Button>
                </Link>
              </div>
            </div>

            <div className="mt-5 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,22rem)]">
              <div>
                <h2 className="text-xl font-semibold leading-snug text-card-text md:text-[1.35rem]">
                  {briefHeadline(data, briefContent)}
                </h2>
                <p className="mt-2 text-xs text-card-text-muted">
                  {brief?.publishedAt
                    ? `Published ${new Date(brief.publishedAt).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        timeZone: 'America/Los_Angeles',
                      })} PT`
                    : 'Brief not published yet'}
                  {' · dashboard'}
                  {brief?.emailStatus === 'sent' ? ' + email' : ''}
                  {brief?.status === 'PARTIAL' ? ' · deterministic fallback available' : ''}
                </p>

                <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
                  <div>
                    <p className="text-[1.75rem] leading-none font-semibold tabular-nums text-card-text">
                      {money(data.current.netMoney)}
                    </p>
                    <p className="mt-2 text-[10px] font-semibold tracking-[0.18em] text-card-text-faint uppercase">
                      {isSingleDay || datePreset === 'yesterday' ? 'Yesterday' : data.range.label} ·{' '}
                      {selectedLocationId !== 'all' ? 'Selected store' : 'All stores'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xl leading-none font-semibold text-success-subtle-text">
                      {best?.name ?? '—'}
                    </p>
                    <p className="mt-2 text-[10px] font-semibold tracking-[0.18em] text-card-text-faint uppercase">
                      Best performer
                    </p>
                  </div>
                  <div>
                    <p className="text-xl leading-none font-semibold text-danger-subtle-text">
                      {weakest?.name ?? '—'}
                    </p>
                    <p className="mt-2 text-[10px] font-semibold tracking-[0.18em] text-card-text-faint uppercase">
                      Weakest performer
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-semibold tracking-[0.18em] text-card-text-faint uppercase">
                  Top priorities
                </p>
                <div className="mt-3 space-y-2">
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
                          p.locationName ?? (p.locationId ? locationNames.get(String(p.locationId)) : undefined),
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
                    {scores.length === 1 ? '' : 's'}. Formula v{data.businessHealthScoreVersion}.
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
                  scores.map((s) => (
                      <RankingRow
                        key={s._id}
                        rank={s.rank}
                        name={locName(s.locationId)}
                        subtitle={locationRankSubtitle(s)}
                        score={s.score == null ? null : Math.round(s.score)}
                      />
                    ))
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

          <Card title="Exceptions" padding="md">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-card-text-faint">Refunds</p>
                <p className="mt-1 text-lg font-semibold text-card-text">{money(data.signals.exceptions.refundMoney)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-card-text-faint">Voids</p>
                <p className="mt-1 text-lg font-semibold text-card-text">{money(data.signals.exceptions.voidMoney)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-card-text-faint">Discounts</p>
                <p className="mt-1 text-lg font-semibold text-card-text">{money(data.signals.exceptions.discountMoney)}</p>
              </div>
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
    </AppShell>
  )
}

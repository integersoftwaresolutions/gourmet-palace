import { useMemo } from 'react'
import { AppShell } from '../components/layout/AppShell'
import { PerformanceTabs } from '../components/layout/SectionTabs'
import { CommandCenterMetric } from '../components/command-center/CommandCenterMetric'
import { QueryState, DualPanelSkeleton, KpiRowSkeleton } from '../components/query'
import { Card, LineAreaChart, Pill } from '../components/ui'
import { chartColors } from '../components/ui/charts/chartTheme'
import { analyticsApi, type ForecastStatus, type ForecastThisWeek } from '../lib/api'
import { useAsyncResource } from '../hooks/useAsyncResource'
import { forecastDay, money } from '../lib/format'
import { formatPriorBusinessDay } from '../lib/commandCenterHelpers'
import { useAppState } from '../context/useAppState'

function weekdayName(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'long',
    timeZone: 'UTC',
  })
}

function statusTone(status: ForecastStatus): 'success' | 'warning' | 'neutral' {
  if (status === 'COMPLETE') return 'success'
  if (status === 'UNAVAILABLE') return 'neutral'
  return 'warning'
}

function statusLabel(status: ForecastStatus) {
  if (status === 'COMPLETE') return 'Normal'
  if (status === 'UNAVAILABLE') return 'Withheld'
  return 'Provisional'
}

function forecastNote(week: ForecastThisWeek) {
  const published = week.days.filter((day) => day.expectedMoney != null)
  if (!published.length) {
    return `Insufficient comparable weekday history to publish a this-week outlook. Days with fewer than ${week.provisionalMin} complete same-weekday observations are withheld, not shown as zero.`
  }
  const peak = published.reduce((best, day) =>
    Number(day.expectedMoney) > Number(best.expectedMoney) ? day : best,
  )
  return `${weekdayName(peak.businessDate)} is the peak published weekday this week. Expected values use complete same-weekday history with a bounded recent trend. This is a baseline, not a guarantee.`
}

function OutlookRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-card-border px-3 py-3">
      <p className="text-sm text-card-text-muted">{label}</p>
      <p className="text-sm font-semibold text-card-text tabular-nums">{value}</p>
    </div>
  )
}

export function PerformanceForecast() {
  const { query } = useAppState()
  const { data, error, isLoading, isRefreshing, reload } = useAsyncResource(
    () => analyticsApi.forecasts(query).then((res) => res.data),
    [query],
    { fallbackError: 'Unable to load forecasts' },
  )

  const week = data?.thisWeek
  const publishedDays = week?.days.filter((day) => day.expectedMoney != null).length ?? 0
  const withheldDays = week ? week.days.length - publishedDays : 0
  const chartRows = useMemo(
    () =>
      (week?.days || []).map((day) => ({
        date: day.businessDate,
        expected: day.expectedMoney == null ? null : Math.round(day.expectedMoney / 100),
        low: day.lowMoney == null ? null : Math.round(day.lowMoney / 100),
        high: day.highMoney == null ? null : Math.round(day.highMoney / 100),
      })),
    [week],
  )
  const hasChart = chartRows.some((row) => row.expected != null)

  return (
    <AppShell
      title="Performance"
      subtitle={
        week
          ? `Forecast for week starting ${formatPriorBusinessDay(week.weekStart)} · comparable weekdays, not a guarantee`
          : 'This-week expected range from comparable weekdays, not a guarantee'
      }
      activeNav="performance"
    >
      <PerformanceTabs value="forecast" />
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
        {(payload) => {
          const thisWeek = payload.thisWeek
          const coverageMeta = `${publishedDays} of 7 weekdays published · target ${thisWeek.comparableTarget} comparables · provisional at ${thisWeek.provisionalMin}`
          return (
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <CommandCenterMetric
                  label="This week expected"
                  value={money(thisWeek.expectedMoney)}
                  hideTrend
                  meta={`${statusLabel(thisWeek.status)} · ${thisWeek.locationCount} location${thisWeek.locationCount === 1 ? '' : 's'}`}
                />
                <CommandCenterMetric
                  label="Low"
                  value={money(thisWeek.lowMoney)}
                  hideTrend
                  meta="Simple range around the published expected total"
                />
                <CommandCenterMetric
                  label="High"
                  value={money(thisWeek.highMoney)}
                  hideTrend
                  meta="Simple range around the published expected total"
                />
                <CommandCenterMetric
                  label="History coverage"
                  value={`${thisWeek.coverage}%`}
                  hideTrend
                  meta={coverageMeta}
                />
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <Card title="7-day expected line">
                  {hasChart ? (
                    <LineAreaChart
                      data={chartRows}
                      categoryKey="date"
                      series={[{ key: 'expected', label: 'Expected line', color: chartColors.accent }]}
                      range={{ lowKey: 'low', highKey: 'high', color: chartColors.accent }}
                      showLegend={false}
                      height={280}
                    />
                  ) : (
                    <p className="text-sm text-card-text-muted">
                      No weekday in this week has enough complete comparable history to plot. Withheld days are omitted, not shown as $0.
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Pill tone="accent" variant="outline" size="sm">
                      Expected line
                    </Pill>
                    <Pill tone="neutral" variant="outline" size="sm">
                      Simple range
                    </Pill>
                  </div>
                  <p className="mt-2 text-xs text-card-text-faint">
                    Withheld weekdays break the line. They are not plotted as zero.
                  </p>
                </Card>

                <Card title="This week outlook">
                  <div className="space-y-3">
                    <OutlookRow label="Expected" value={money(thisWeek.expectedMoney)} />
                    <OutlookRow label="Low" value={money(thisWeek.lowMoney)} />
                    <OutlookRow label="High" value={money(thisWeek.highMoney)} />
                    <OutlookRow
                      label="History"
                      value={`${publishedDays} published · ${withheldDays} withheld`}
                    />
                    <div className="space-y-2 pt-1">
                      {thisWeek.days.map((day) => (
                        <div key={day.businessDate} className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm text-card-text">{forecastDay(day.businessDate)}</p>
                            <p className="text-xs text-card-text-muted">
                              {day.expectedMoney == null
                                ? `${day.comparableCount} comparable${day.comparableCount === 1 ? '' : 's'} · withheld`
                                : `${money(day.expectedMoney)} · ${day.comparableCount} comparable${day.comparableCount === 1 ? '' : 's'}`}
                            </p>
                          </div>
                          <Pill tone={statusTone(day.status)} variant="outline" size="sm">
                            {statusLabel(day.status)}
                          </Pill>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              </div>

              <Card title="Forecast note">
                <p className="text-sm text-card-text">{forecastNote(thisWeek)}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Pill tone="accent" variant="outline" size="sm">
                    Comparable weekdays
                  </Pill>
                  <Pill tone="neutral" variant="outline" size="sm">
                    Recent, bounded
                  </Pill>
                </div>
                <p className="mt-3 text-xs text-card-text-faint">
                  Normal = COMPLETE. Provisional = at least {thisWeek.provisionalMin} comparable weekdays, below the target of {thisWeek.comparableTarget}. Withheld = UNAVAILABLE, not zero.
                </p>
                {thisWeek.locations.length > 0 ? (
                  <div className="mt-4 space-y-2 border-t border-card-border pt-4">
                    {thisWeek.locations.map((row) => (
                      <div key={row.locationId || row.locationName} className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-card-text">{row.locationName}</p>
                          <p className="text-xs text-card-text-muted">
                            Low {money(row.lowMoney)} · high {money(row.highMoney)} · coverage {row.coverage}%
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-card-text">{money(row.expectedMoney)}</p>
                          <Pill tone={statusTone(row.status)} variant="outline" size="sm">
                            {statusLabel(row.status)}
                          </Pill>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-card-text-muted">No location forecast rows are available for this scope.</p>
                )}
              </Card>
            </div>
          )
        }}
      </QueryState>
    </AppShell>
  )
}

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, Pill, Tabs } from '../components/ui'
import { AppShell } from '../components/layout/AppShell'
import {
  chartAxisTick,
  chartColors,
  chartTooltipStyle,
} from '../components/ui/charts/chartTheme'
import { cn } from '../lib/cn'

const forecastData = [
  { day: 'Thu', expected: 48, low: 40, high: 56 },
  { day: 'Fri', expected: 52, low: 44, high: 60 },
  { day: 'Sat', expected: 74, low: 60, high: 82 },
  { day: 'Sun', expected: 58, low: 48, high: 68 },
  { day: 'Mon', expected: 44, low: 36, high: 52 },
  { day: 'Tue', expected: 50, low: 42, high: 58 },
  { day: 'Wed', expected: 54, low: 46, high: 62 },
]

function navigatePerformanceTab(
  navigate: ReturnType<typeof useNavigate>,
  id: string,
) {
  if (id === 'stores') navigate('/performance')
  if (id === 'operations') navigate('/performance/operations')
  if (id === 'finance') navigate('/performance/finance')
  if (id === 'forecast') navigate('/performance/forecast')
}

const performanceTabs = [
  { id: 'stores', label: 'Stores' },
  { id: 'operations', label: 'Operations' },
  { id: 'finance', label: 'Finance' },
  { id: 'forecast', label: 'Forecast' },
]

export function PerformanceForecast() {
  const navigate = useNavigate()
  const [showExpected, setShowExpected] = useState(true)
  const [showRange, setShowRange] = useState(true)
  const [showEvents, setShowEvents] = useState(true)

  return (
    <AppShell
      title="Performance"
      activeNav="performance"
    >
      <div className="flex flex-col gap-5">
        <Tabs
          value="forecast"
          onChange={(id) => navigatePerformanceTab(navigate, id)}
          items={performanceTabs}
        />

        <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <Card padding="lg">
            <p className="text-[11px] font-semibold tracking-widest text-card-text-faint uppercase">
              Expected sales · this week
            </p>
            <p className="mt-1 text-sm text-card-text-muted">
              Comparable-weekday baseline with a simple expected range
            </p>

            <div className="mt-4 h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={forecastData}
                  margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="forecast-range" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor={chartColors.accent}
                        stopOpacity={0.22}
                      />
                      <stop
                        offset="100%"
                        stopColor={chartColors.accent}
                        stopOpacity={0.04}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    stroke={chartColors.grid}
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="day"
                    tick={chartAxisTick}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={chartAxisTick}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                    tickFormatter={(v) => `$${v}K`}
                  />
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    formatter={(value) => [`$${value}K`, '']}
                  />
                  {showRange && (
                    <>
                      <Area
                        type="monotone"
                        dataKey="high"
                        stroke="none"
                        fill="url(#forecast-range)"
                        name="High"
                      />
                      <Area
                        type="monotone"
                        dataKey="low"
                        stroke="none"
                        fill="var(--card)"
                        name="Low"
                      />
                    </>
                  )}
                  {showExpected && (
                    <Line
                      type="monotone"
                      dataKey="expected"
                      stroke={chartColors.accent}
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: chartColors.accent }}
                      name="Expected"
                    />
                  )}
                  {showEvents && (
                    <>
                      <ReferenceLine
                        x="Sat"
                        stroke={chartColors.info}
                        strokeDasharray="4 4"
                      />
                      <ReferenceLine
                        x="Tue"
                        stroke={chartColors.danger}
                        strokeDasharray="4 4"
                      />
                    </>
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowExpected((v) => !v)}
                className="rounded-full"
              >
                <Pill
                  tone="accent"
                  variant={showExpected ? 'outline' : 'subtle'}
                  size="sm"
                >
                  Expected line
                </Pill>
              </button>
              <button
                type="button"
                onClick={() => setShowRange((v) => !v)}
                className="rounded-full"
              >
                <Pill
                  tone="neutral"
                  variant={showRange ? 'outline' : 'subtle'}
                  size="sm"
                >
                  Simple range
                </Pill>
              </button>
              <button
                type="button"
                onClick={() => setShowEvents((v) => !v)}
                className="rounded-full"
              >
                <Pill
                  tone="info"
                  variant={showEvents ? 'outline' : 'subtle'}
                  size="sm"
                >
                  Event / closure
                </Pill>
              </button>
            </div>
          </Card>

          <Card title="This week outlook" padding="lg">
            <p className="text-4xl font-semibold tracking-tight text-card-text">
              $368K
            </p>
            <p className="mt-1 text-sm text-card-text-muted">
              Expected week total
            </p>

            <div className="mt-6">
              <p className="text-[11px] font-semibold tracking-widest text-card-text-faint uppercase">
                Range
              </p>
              <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                <span className="text-card-text-muted">
                  Low{' '}
                  <span className="font-semibold text-card-text">$341K</span>
                </span>
                <span className="text-card-text-muted">
                  High{' '}
                  <span className="font-semibold text-card-text">$396K</span>
                </span>
              </div>
            </div>

            <div className="mt-6">
              <p className="text-sm font-medium text-success-subtle-text">
                8 comparable weekdays
              </p>
              <p className="mt-1 text-xs text-card-text-muted">
                Provisional below 4 · withheld when history is insufficient
              </p>
            </div>

            <div className="mt-6 rounded-lg bg-card-hover px-3 py-3">
              <p className="text-sm font-medium text-card-text">
                Sat · local festival
              </p>
              <p className="mt-0.5 text-xs text-card-text-muted">
                Event marker included
              </p>
            </div>
          </Card>
        </div>

        <Card padding="lg">
          <div className="flex flex-wrap items-start gap-3">
            <Pill tone="accent" variant="outline" className="shrink-0">
              Forecast note
            </Pill>
            <p className="min-w-0 flex-1 text-sm text-card-text">
              Saturday is projected as the peak at $74K from comparable
              Saturdays; the range widens where history is thin.
            </p>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <p className="mb-2 text-[11px] font-semibold tracking-widest text-card-text-faint uppercase">
                Basis
              </p>
              <Pill tone="success" variant="outline">
                Comparable weekdays
              </Pill>
            </div>
            <div>
              <p className="mb-2 text-[11px] font-semibold tracking-widest text-card-text-faint uppercase">
                Trend
              </p>
              <Pill tone="neutral" variant="outline">
                Recent, bounded
              </Pill>
            </div>
            <div>
              <p className="mb-2 text-[11px] font-semibold tracking-widest text-card-text-faint uppercase">
                Closure calendar
              </p>
              <Pill tone="success" variant="outline">
                Current
              </Pill>
            </div>
            <div>
              <p className="mb-2 text-[11px] font-semibold tracking-widest text-card-text-faint uppercase">
                Event markers
              </p>
              <Pill tone="info" variant="outline">
                Festival · Sat
              </Pill>
            </div>
          </div>

          <p className={cn('mt-5 text-xs text-card-text-muted')}>
            Forecasts are withheld when comparable history is insufficient.
            Quality states:{' '}
            <span className="text-success-subtle-text">Normal</span>
            {' · '}
            <span className="text-warning-subtle-text">Provisional</span>
            {' · '}
            <span className="text-danger-subtle-text">Withheld</span>
            {' · '}
            <span className="text-card-text-faint">Insufficient history</span>
          </p>
        </Card>
      </div>
    </AppShell>
  )
}

import {
  Area,
  AreaChart as RechartsAreaChart,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { cn } from '../../../lib/cn'
import { chartAxisDate, chartTooltipDate } from '../../../lib/format'
import {
  chartAxisTick,
  chartColors,
  chartTooltipStyle,
  seriesPalette,
  type ChartSeries,
} from './chartTheme'

export type LineAreaChartProps = {
  data: Record<string, string | number | null>[]
  categoryKey: string
  series: ChartSeries[]
  /** Optional low/high band keys for a range fill under the primary series */
  range?: { lowKey: string; highKey: string; color?: string }
  height?: number
  className?: string
  showGrid?: boolean
  showLegend?: boolean
  showLine?: boolean
}

export function LineAreaChart({
  data,
  categoryKey,
  series,
  range,
  height = 280,
  className,
  showGrid = true,
  showLegend = true,
  showLine = true,
}: LineAreaChartProps) {
  const rangeId = 'area-range'
  const gradientIds = series.map((s) => `area-${s.key}`)

  return (
    <div className={cn('min-w-0 w-full overflow-hidden', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsAreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            {series.map((s, i) => {
              const color = s.color ?? seriesPalette[i % seriesPalette.length]
              return (
                <linearGradient
                  key={gradientIds[i]}
                  id={gradientIds[i]}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                </linearGradient>
              )
            })}
            {range && (
              <linearGradient id={rangeId} x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor={range.color ?? chartColors.accent}
                  stopOpacity={0.2}
                />
                <stop
                  offset="100%"
                  stopColor={range.color ?? chartColors.accent}
                  stopOpacity={0.05}
                />
              </linearGradient>
            )}
          </defs>

          {showGrid && (
            <CartesianGrid
              stroke={chartColors.grid}
              strokeDasharray="3 3"
              vertical={false}
            />
          )}
          <XAxis
            dataKey={categoryKey}
            tick={chartAxisTick}
            axisLine={false}
            tickLine={false}
            tickFormatter={chartAxisDate}
            minTickGap={18}
          />
          <YAxis
            tick={chartAxisTick}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip contentStyle={chartTooltipStyle} labelFormatter={chartTooltipDate} />
          {showLegend && (
            <Legend
              wrapperStyle={{ color: chartColors.axis, fontSize: 12 }}
            />
          )}

          {range && (
            <>
              <Area
                type="monotone"
                dataKey={range.highKey}
                stroke="none"
                fill={`url(#${rangeId})`}
                name="High"
                legendType="none"
                connectNulls={false}
              />
              <Area
                type="monotone"
                dataKey={range.lowKey}
                stroke="none"
                fill="var(--card)"
                name="Low"
                legendType="none"
                connectNulls={false}
              />
            </>
          )}

          {series.map((s, i) => {
            const color = s.color ?? seriesPalette[i % seriesPalette.length]
            return (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label ?? s.key}
                stroke={showLine ? color : 'none'}
                strokeWidth={2.5}
                fill={`url(#${gradientIds[i]})`}
                dot={false}
                activeDot={{ r: 5 }}
                connectNulls={false}
              />
            )
          })}

          {/* Keep a crisp line on top when range is shown */}
          {range && showLine && series[0] && (
            <Line
              type="monotone"
              dataKey={series[0].key}
              stroke={series[0].color ?? seriesPalette[0]}
              strokeWidth={2.5}
              dot={false}
              legendType="none"
              connectNulls={false}
            />
          )}
        </RechartsAreaChart>
      </ResponsiveContainer>
    </div>
  )
}

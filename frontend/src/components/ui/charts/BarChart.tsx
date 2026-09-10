import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Legend,
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

export type BarChartProps = {
  data: Record<string, string | number>[]
  categoryKey: string
  series: ChartSeries[]
  stacked?: boolean
  height?: number
  className?: string
  showGrid?: boolean
  showLegend?: boolean
}

export function BarChart({
  data,
  categoryKey,
  series,
  stacked = false,
  height = 280,
  className,
  showGrid = true,
  showLegend = true,
}: BarChartProps) {
  return (
    <div className={cn('min-w-0 w-full overflow-hidden', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
          <Tooltip
            contentStyle={chartTooltipStyle}
            labelFormatter={chartTooltipDate}
            cursor={{ fill: chartColors.cursor }}
          />
          {showLegend && (
            <Legend
              wrapperStyle={{ color: chartColors.axis, fontSize: 12 }}
            />
          )}
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label ?? s.key}
              fill={s.color ?? seriesPalette[i % seriesPalette.length]}
              stackId={stacked ? 'stack' : undefined}
              radius={[6, 6, 0, 0]}
              maxBarSize={40}
            />
          ))}
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  )
}

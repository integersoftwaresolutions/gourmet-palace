import {
  CartesianGrid,
  Legend,
  Line,
  LineChart as RechartsLineChart,
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

export type LineChartProps = {
  data: Record<string, string | number>[]
  categoryKey: string
  series: ChartSeries[]
  showDots?: boolean
  height?: number
  className?: string
  showGrid?: boolean
  showLegend?: boolean
}

export function LineChart({
  data,
  categoryKey,
  series,
  showDots = true,
  height = 280,
  className,
  showGrid = true,
  showLegend = true,
}: LineChartProps) {
  return (
    <div className={cn('min-w-0 w-full overflow-hidden', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsLineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
          {series.map((s, i) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label ?? s.key}
              stroke={s.color ?? seriesPalette[i % seriesPalette.length]}
              strokeWidth={2.5}
              dot={showDots ? { r: 3, strokeWidth: 0 } : false}
              activeDot={{ r: 5 }}
            />
          ))}
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  )
}

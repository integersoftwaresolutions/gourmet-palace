import {
  Cell,
  Legend,
  Pie,
  PieChart as RechartsPieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { cn } from '../../../lib/cn'
import {
  chartColors,
  chartTooltipStyle,
  seriesPalette,
} from './chartTheme'

export type PieChartDatum = {
  name: string
  value: number
  color?: string
}

export type PieChartProps = {
  data: PieChartDatum[]
  dataKey?: string
  nameKey?: string
  donut?: boolean
  height?: number
  className?: string
  showLegend?: boolean
}

export function PieChart({
  data,
  dataKey = 'value',
  nameKey = 'name',
  donut = false,
  height = 280,
  className,
  showLegend = true,
}: PieChartProps) {
  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsPieChart>
          <Pie
            data={data}
            dataKey={dataKey}
            nameKey={nameKey}
            cx="50%"
            cy="50%"
            innerRadius={donut ? '55%' : 0}
            outerRadius="80%"
            paddingAngle={2}
            stroke="var(--card)"
            strokeWidth={2}
          >
            {data.map((entry, i) => (
              <Cell
                key={entry.name}
                fill={entry.color ?? seriesPalette[i % seriesPalette.length]}
              />
            ))}
          </Pie>
          <Tooltip contentStyle={chartTooltipStyle} />
          {showLegend && (
            <Legend
              wrapperStyle={{ color: chartColors.axis, fontSize: 12 }}
            />
          )}
        </RechartsPieChart>
      </ResponsiveContainer>
    </div>
  )
}

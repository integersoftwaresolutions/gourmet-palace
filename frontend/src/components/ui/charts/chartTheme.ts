/** Semantic token CSS vars for Recharts (resolved from the active theme class). */
export const chartColors = {
  brand: 'var(--brand)',
  accent: 'var(--accent)',
  success: 'var(--success)',
  warning: 'var(--warning)',
  danger: 'var(--danger)',
  info: 'var(--info)',
  neutral: 'var(--neutral)',
  grid: 'var(--card-border)',
  axis: 'var(--card-text-faint)',
  tooltipBg: 'var(--card)',
  tooltipBorder: 'var(--card-border)',
  tooltipText: 'var(--card-text)',
  tooltipMuted: 'var(--card-text-muted)',
  cursor: 'var(--card-hover)',
} as const

export const seriesPalette = [
  chartColors.brand,
  chartColors.accent,
  chartColors.success,
  chartColors.info,
  chartColors.warning,
  chartColors.danger,
] as const

export type ChartSeries = {
  key: string
  label?: string
  color?: string
}

export const chartTooltipStyle = {
  backgroundColor: chartColors.tooltipBg,
  border: `1px solid ${chartColors.tooltipBorder}`,
  borderRadius: 12,
  color: chartColors.tooltipText,
  fontSize: 12,
} as const

export const chartAxisTick = {
  fill: chartColors.axis,
  fontSize: 11,
} as const

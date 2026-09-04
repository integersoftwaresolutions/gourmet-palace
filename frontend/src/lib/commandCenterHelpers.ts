import type { DashboardData, DashboardPriority } from '../lib/api'

export function firstName(fullName: string | undefined): string {
  if (!fullName?.trim()) return 'there'
  return fullName.trim().split(/\s+/)[0] ?? 'there'
}

export function formatHeaderDate(now = new Date()): string {
  return now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

export function formatPriorBusinessDay(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`)
  const weekday = d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })
  const monthDay = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  return `${weekday} ${monthDay}`
}

export function comparisonWeekdayLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`)
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const
  return days[d.getUTCDay()] ?? 'PRIOR'
}

export function healthStatusLabel(change: number | null): 'STABLE' | 'IMPROVING' | 'ATTENTION' | 'UNAVAILABLE' {
  if (change == null) return 'UNAVAILABLE'
  if (change >= 3) return 'IMPROVING'
  if (change <= -3) return 'ATTENTION'
  return 'STABLE'
}

export function locationRankSubtitle(score: DashboardData['scores'][number]): string {
  const netPct = score.comparison?.netSalesPct
  if (typeof netPct === 'number') {
    if (netPct >= 5) return `Beat comparable weekday by ${Math.abs(netPct).toFixed(0)}%`
    if (netPct <= -5) return `Below comparable weekday by ${Math.abs(netPct).toFixed(0)}%`
  }
  return 'In line with normal'
}

export function priorityDetail(priority: DashboardPriority, locationName?: string): string {
  const prefix = locationName ? `${locationName} · ` : ''
  if (priority.type === 'exceptions_above_normal') {
    const match = priority.detail.match(/([\d.]+)%/)
    return match ? `${prefix}${match[1]}% of net sales in refunds` : `${prefix}${priority.detail}`
  }
  if (priority.detail.length < 72) return `${prefix}${priority.detail}`.replace(/^ · /, '')
  return priority.detail.slice(0, 69) + '…'
}

export function briefHeadline(
  dashboard: DashboardData | null,
  briefContent: Record<string, unknown> | null,
): string {
  const fromBrief = briefContent?.headline
  if (typeof fromBrief === 'string' && fromBrief.trim()) return fromBrief
  return dashboard?.headline ?? 'Loading prior-day performance…'
}

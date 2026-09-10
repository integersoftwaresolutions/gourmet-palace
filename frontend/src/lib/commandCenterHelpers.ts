import type { AlertRecord, DashboardData, DashboardPriority } from '../lib/api'
import { businessDate, dateRange, relativeAction } from './format'

export function firstName(fullName: string | undefined): string {
  if (!fullName?.trim()) return 'there'
  return fullName.trim().split(/\s+/)[0] ?? 'there'
}

export function formatHeaderDate(now = new Date()): string {
  return businessDate(now)
}

export function formatPriorBusinessDay(dateStr: string): string {
  return businessDate(dateStr)
}

export function comparisonWeekdayLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`)
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const
  return days[d.getUTCDay()] ?? 'PRIOR'
}

/** Compact absolute comparison range, e.g. "1–10 Sep 2026". */
export function formatComparisonRangeLabel(range: { from: string; to: string }): string {
  return dateRange(range.from, range.to)
}

/**
 * Compact delta chip label. Avoids misleading "VS MON" on multi-day ranges
 * (that used to be only the weekday of previousRange.to).
 */
export function comparisonDeltaLabel(options: {
  basis: 'previous' | 'prior-year' | 'peers'
  previousRange?: { from: string; to: string } | null
}): string {
  if (options.basis === 'peers') return 'VS OTHER STORES'
  if (options.basis === 'prior-year') return 'VS PRIOR YEAR'
  const prev = options.previousRange
  if (!prev?.from || !prev?.to) return 'VS PRIOR PERIOD'
  if (prev.from === prev.to) return `VS PRIOR ${comparisonWeekdayLabel(prev.to)}`
  return 'VS PRIOR PERIOD'
}

export function healthStatusLabel(change: number | null): 'STABLE' | 'IMPROVING' | 'ATTENTION' | 'UNAVAILABLE' {
  if (change == null) return 'UNAVAILABLE'
  if (change >= 3) return 'IMPROVING'
  if (change <= -3) return 'ATTENTION'
  return 'STABLE'
}

export function locationRankSubtitle(
  score: DashboardData['scores'][number],
  alertTypes: Set<string>,
): string {
  const netPct = score.comparison?.netSalesPct
  if (typeof netPct === 'number') {
    if (netPct >= 5) return `Beat comparable weekday by ${Math.abs(netPct).toFixed(0)}%`
    if (netPct <= -5) return `Below comparable weekday by ${Math.abs(netPct).toFixed(0)}%`
  }
  if (alertTypes.has('exceptions_above_normal') || alertTypes.has('sales_below_normal')) {
    return 'Refund spike · needs attention'
  }
  return 'In line with normal'
}

export function priorityDetail(priority: DashboardPriority, locationName?: string): string {
  const loc = locationName ? `${locationName} · ` : ''
  if (priority.type === 'exceptions_above_normal' && typeof priority.delta === 'number') {
    return `${loc}${Math.abs(priority.delta).toFixed(0)}% above baseline`
  }
  if (priority.type === 'vendor_price_increase') {
    return priority.detail.replace(/^Normalized unit price increased /, '').replace(/\.$/, '') || priority.detail
  }
  if (priority.type === 'food_cost_above_target') {
    return priority.detail
  }
  if (priority.detail.length < 80) return priority.detail
  return priority.detail.slice(0, 77) + '…'
}

export function alertLocationLine(
  alert: AlertRecord,
  locationNames: Map<string, string>,
): string {
  const id = typeof alert.locationId === 'object' && alert.locationId ? String(alert.locationId._id) : String(alert.locationId || '')
  const name = id ? locationNames.get(id) : (typeof alert.locationId === 'object' ? alert.locationId?.name : null)
  const opened = alert.createdAt ? relativeAction(alert.createdAt, 'Opened') : null
  const parts = [name, opened].filter(Boolean)
  return parts.join(' · ') || 'Organization scope'
}

export function severityStatusLabel(severity: AlertRecord['severity']): string {
  if (severity === 'critical') return 'CRITICAL'
  if (severity === 'warning') return 'WARNING'
  return 'INFO'
}

export function briefHeadline(
  dashboard: DashboardData | null,
  briefContent: Record<string, unknown> | null,
): string {
  const fromBrief = briefContent?.headline
  if (typeof fromBrief === 'string' && fromBrief.trim()) return fromBrief
  return dashboard?.headline ?? 'Loading prior-day performance…'
}

export function enrichPriorities(
  priorities: DashboardPriority[],
  workflow: DashboardData['workflow'] | undefined,
): DashboardPriority[] {
  const list = [...priorities]
  if (workflow && workflow.reviewDrafts > 0) {
    list.push({
      ref: 'workflow:review-drafts',
      type: 'review_replies_pending',
      severity: 'info',
      title: 'Review replies',
      detail: `${workflow.reviewDrafts} draft${workflow.reviewDrafts === 1 ? '' : 's'} awaiting approval`,
      locationId: null,
      evidence: [],
      nextAction: 'Open Google Reviews, finalize drafts, and approve before posting.',
    })
  }
  return list.slice(0, 5)
}

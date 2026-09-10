// gp-responsive-datetime-verdict-v1
export const PACIFIC_TIME_ZONE = 'America/Los_Angeles'

export const money = (cents: unknown, digits = 0) =>
  typeof cents === 'number' && Number.isFinite(cents)
    ? new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(cents / 100)
    : 'Unavailable'

export const percent = (value: unknown, digits = 1) =>
  typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(digits)}%` : 'Unavailable'

export const ratioPercent = (value: unknown, digits = 1) =>
  typeof value === 'number' && Number.isFinite(value) ? `${(value * 100).toFixed(digits)}%` : 'Unavailable'

const ISO_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
const ISO_LIKE = /^\d{4}-\d{2}-\d{2}(?:T|$)/

function asDate(value: unknown): Date | null {
  if (value == null || value === '') return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  const raw = String(value).trim()
  if (!raw) return null
  // Noon UTC keeps a business/calendar date on the intended day in every US timezone.
  const date = ISO_DATE_ONLY.test(raw) ? new Date(`${raw}T12:00:00.000Z`) : new Date(raw)
  return Number.isNaN(date.getTime()) ? null : date
}

function dateZone(value: unknown, fallback = PACIFIC_TIME_ZONE): string {
  return typeof value === 'string' && ISO_DATE_ONLY.test(value.trim()) ? 'UTC' : fallback
}

function absoluteDate(value: unknown, timeZone = PACIFIC_TIME_ZONE): string {
  const date = asDate(value)
  if (!date) return 'Unavailable'
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: dateZone(value, timeZone),
  }).format(date)
}

function monthDay(value: unknown, timeZone = PACIFIC_TIME_ZONE): string {
  const date = asDate(value)
  if (!date) return 'Unavailable'
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: dateZone(value, timeZone),
  }).format(date)
}

function clockTime(value: unknown, timeZone = PACIFIC_TIME_ZONE): string {
  const date = asDate(value)
  if (!date) return 'Unavailable'
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone,
  }).format(date)
}

/** General/invoice/inventory/business dates: 8 Sep 2026. */
export function generalDate(value: unknown): string {
  return absoluteDate(value)
}

/** Morning Brief business date and other canonical business dates. */
export function businessDate(value: unknown): string {
  return absoluteDate(value)
}

/** Morning Brief heading/history: 8 Sep 2026 · Revision 2. */
export function briefBusinessDate(value: unknown, revision: unknown): string {
  const rev = Number(revision)
  return `${businessDate(value)} · Revision ${Number.isFinite(rev) ? rev : String(revision ?? '—')}`
}

/** Exact timestamp for approvals/status/import history: 10 Sep 2026 · 8:35 AM PT. */
export function exactDateTime(value: unknown, timeZone = PACIFIC_TIME_ZONE): string {
  const date = asDate(value)
  if (!date) return 'Unavailable'
  const suffix = timeZone === PACIFIC_TIME_ZONE ? ' PT' : ''
  return `${absoluteDate(value, timeZone)} · ${clockTime(value, timeZone)}${suffix}`
}

/** Brief publication detail: Published 10 Sep 2026 · 5:07 AM PT. */
export function publishedDateTime(value: unknown): string {
  const formatted = exactDateTime(value)
  return formatted === 'Unavailable' ? 'Publication time unavailable' : `Published ${formatted}`
}

/** Printed/report generation detail: Generated 10 Sep 2026 · 8:35 AM PT. */
export function generatedDateTime(value: unknown): string {
  const formatted = exactDateTime(value)
  return formatted === 'Unavailable' ? 'Generation time unavailable' : `Generated ${formatted}`
}

function relativeCore(value: unknown, now = new Date()): string {
  const date = asDate(value)
  if (!date) return 'Unavailable'
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000)
  const future = seconds > 0
  const abs = Math.abs(seconds)
  if (abs < 45) return future ? 'in a few sec' : 'just now'
  const minutes = Math.round(abs / 60)
  if (minutes < 60) return future ? `in ${minutes} min` : `${minutes} min ago`
  const hours = Math.round(abs / 3600)
  if (hours < 24) return future ? `in ${hours} ${hours === 1 ? 'hour' : 'hours'}` : `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`
  const days = Math.round(abs / 86400)
  if (days < 30) return future ? `in ${days} ${days === 1 ? 'day' : 'days'}` : `${days} ${days === 1 ? 'day' : 'days'} ago`
  // Older activity is no longer "recent"; fall back to an absolute business-friendly date.
  return generalDate(value)
}

/** Alert/note activity: Opened 20 min ago / Added 2 hours ago. */
export function relativeAction(value: unknown, action: string, now = new Date()): string {
  const relative = relativeCore(value, now)
  if (relative === 'Unavailable') return `${action} time unavailable`
  return `${action} ${relative}`
}

/** Data refresh: Updated 5 min ago. */
export function updatedTime(value: unknown, now = new Date()): string {
  return relativeAction(value, 'Updated', now)
}

/** Integration sync: Last synced 2 hours ago. */
export function syncedTime(value: unknown, now = new Date()): string {
  return relativeAction(value, 'Last synced', now)
}

/** Forecast daily rows: Thu, 10 Sep. */
export function forecastDay(value: unknown): string {
  const date = asDate(value)
  if (!date) return 'Unavailable'
  const zone = dateZone(value, 'UTC')
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: zone }).format(date)
  return `${weekday}, ${monthDay(value, zone)}`
}

/** Chart axes: 10 Sep. Non-date category labels are returned unchanged. */
export function chartAxisDate(value: unknown): string {
  if (typeof value !== 'string' || !ISO_LIKE.test(value)) return String(value ?? '')
  return monthDay(value)
}

/** Chart tooltip labels: 10 Sep 2026; includes time for timestamp categories. */
export function chartTooltipDate(value: unknown): string {
  if (typeof value !== 'string' || !ISO_LIKE.test(value)) return String(value ?? '')
  if (value.includes('T')) return exactDateTime(value)
  return generalDate(value)
}

/** Compact selected/comparison range: 1–10 Sep 2026. */
export function dateRange(from: unknown, to: unknown): string {
  const a = asDate(from)
  const b = asDate(to)
  if (!a || !b) return 'Unavailable'

  const zoneA = dateZone(from, PACIFIC_TIME_ZONE)
  const zoneB = dateZone(to, PACIFIC_TIME_ZONE)
  const parts = (date: Date, zone: string) => {
    const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', timeZone: zone }).format(date)
    const month = new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: zone }).format(date)
    const year = new Intl.DateTimeFormat('en-GB', { year: 'numeric', timeZone: zone }).format(date)
    return { day, month, year }
  }
  const p1 = parts(a, zoneA)
  const p2 = parts(b, zoneB)
  if (a.getTime() === b.getTime() || String(from) === String(to)) return `${p2.day} ${p2.month} ${p2.year}`
  if (p1.year === p2.year && p1.month === p2.month) return `${p1.day}–${p2.day} ${p2.month} ${p2.year}`
  if (p1.year === p2.year) return `${p1.day} ${p1.month}–${p2.day} ${p2.month} ${p2.year}`
  return `${p1.day} ${p1.month} ${p1.year}–${p2.day} ${p2.month} ${p2.year}`
}

// Compatibility exports retained for existing call sites. New UI should prefer the
// semantic helpers above so the display purpose is explicit in code review.
export const dateTime = (value: unknown) => exactDateTime(value)
export const freshnessTime = (value: unknown, timeZone = PACIFIC_TIME_ZONE) =>
  value ? clockTime(value, timeZone) : 'Unavailable'

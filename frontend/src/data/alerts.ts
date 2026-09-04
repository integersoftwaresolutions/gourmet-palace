export type AlertTone = 'danger' | 'warning' | 'accent'

export type AlertItem = {
  id: string
  tone: AlertTone
  badges: { label: string; tone: AlertTone }[]
  status: 'Open' | 'Acknowledged'
  title: string
  detail: string
  meta: string
  metaAccent?: boolean
  accentBorder?: boolean
}

export const staticAlerts: AlertItem[] = [
  {
    id: '1',
    tone: 'danger',
    badges: [
      { label: 'Critical', tone: 'danger' },
      { label: 'Escalated', tone: 'danger' },
    ],
    status: 'Open',
    title: 'Refunds 42% above baseline — Woodland Hills',
    detail:
      'Actual $1,240 vs expected $873 · Δ +42% · delivery 6:30–8:00 PM',
    meta: 'Opened 6:04 AM · 1 occurrence · owner unassigned',
  },
  {
    id: '2',
    tone: 'warning',
    badges: [{ label: 'Warning', tone: 'warning' }],
    status: 'Open',
    title: 'Sysco chicken breast +18% over 3 months',
    detail:
      'Current $4.04/lb vs prior $3.42 · market +6% · est. $340/mo overpay',
    meta: 'Invoices INV-10482, INV-10391, INV-10288 · all locations',
  },
  {
    id: '3',
    tone: 'warning',
    badges: [{ label: 'Warning', tone: 'warning' }],
    status: 'Acknowledged',
    title: 'Inventory critical — chicken breast',
    detail: '12 lb on hand vs 40 lb par · 1.4 days remaining',
    meta: 'Woodland Hills · manual count Jul 29 · Maria Chen',
  },
  {
    id: '4',
    tone: 'accent',
    badges: [{ label: 'Data quality', tone: 'accent' }],
    status: 'Open',
    title: 'Simi Valley guest count is unavailable',
    detail:
      'Toast guest field is unreliable for this location; shown as Unavailable, not zero',
    meta: 'Data quality rule DQ-04 · pipeline retry 3 of 5',
    metaAccent: true,
    accentBorder: true,
  },
]

export const openAlertsCount = staticAlerts.filter(
  (a) => a.status === 'Open',
).length

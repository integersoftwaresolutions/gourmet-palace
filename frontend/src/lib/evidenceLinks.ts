import type { DatePreset } from '../context/app-state-context'

export type EvidenceItem = {
  type?: string
  from?: string
  to?: string
  locationId?: string
  locationName?: string
  family?: string
  dataStatus?: string
  refs?: string[]
  vendors?: Array<{ vendorId?: string | null; vendorName?: string }>
  a?: { from?: string; to?: string }
  b?: { from?: string; to?: string }
  clarify?: { field?: string; suggestions?: string[] } | null
  [key: string]: unknown
}

export type EvidenceLink = {
  key: string
  label: string
  path: string
  from?: string
  to?: string
  locationId?: string
}

type ScopeSetters = {
  setDatePreset: (v: DatePreset) => void
  setCustomFrom: (v: string) => void
  setCustomTo: (v: string) => void
  setSelectedLocationId: (v: string) => void
}

export function evidencePeriodLabel(evidence: EvidenceItem[] | undefined): string | null {
  const period = (evidence || []).find((row) => row.type === 'period' && row.from)
  if (!period?.from) return null
  if (period.from === period.to) return period.from
  return `${period.from} → ${period.to}`
}

export function clarifySuggestions(evidence: EvidenceItem[] | undefined): string[] {
  for (const row of evidence || []) {
    const tips = row.clarify?.suggestions
    if (Array.isArray(tips) && tips.length) return tips.filter(Boolean).map(String)
  }
  return []
}

export function evidenceLinks(evidence: EvidenceItem[] | undefined, toolFamily?: string | null): EvidenceLink[] {
  const rows = evidence || []
  const links: EvidenceLink[] = []
  const seen = new Set<string>()
  const push = (link: EvidenceLink) => {
    if (seen.has(link.key)) return
    seen.add(link.key)
    links.push(link)
  }

  for (const row of rows) {
    if (row.type === 'period' && row.from) {
      push({
        key: `period:${row.from}:${row.to || row.from}`,
        label: row.from === row.to ? `Period ${row.from}` : `Period ${row.from} → ${row.to}`,
        path: '/performance',
        from: row.from,
        to: row.to || row.from,
      })
    }
    if (row.type === 'location' && row.locationId) {
      push({
        key: `loc:${row.locationId}`,
        label: row.locationName || 'Location',
        path: '/performance',
        locationId: row.locationId,
        from: rows.find((r) => r.type === 'period')?.from,
        to: rows.find((r) => r.type === 'period')?.to,
      })
    }
    if (row.type === 'priorities' || row.type === 'alerts') {
      push({ key: 'alerts', label: 'Open alerts', path: '/alerts' })
    }
    if (row.type === 'vendor_spend') {
      const first = row.vendors?.[0]
      if (first?.vendorId) {
        push({
          key: `vendor:${first.vendorId}`,
          label: first.vendorName || 'Vendor',
          path: `/operations/vendors/${first.vendorId}`,
        })
      } else {
        push({ key: 'vendors', label: 'Vendors', path: '/operations/vendors' })
      }
    }
    if (row.type === 'low_stock_count') {
      push({ key: 'inventory', label: 'Inventory', path: '/operations/inventory' })
    }
    if (row.type === 'pending_invoice_count') {
      push({ key: 'invoices', label: 'Invoices', path: '/operations' })
    }
    if (row.type === 'reviews_seo') {
      push({ key: 'reviews', label: 'Reviews', path: '/presence' })
      push({ key: 'seo', label: 'SEO & Growth', path: '/presence/seo' })
    }
    if (row.type === 'comparison' && row.a?.from) {
      push({
        key: `cmp:${row.a.from}:${row.b?.from || ''}`,
        label: 'Compared periods',
        path: '/performance',
        from: row.a.from,
        to: row.a.to || row.a.from,
      })
    }
  }

  if (toolFamily === 'forecast_comparison') {
    push({ key: 'forecast', label: 'Forecast', path: '/performance/forecast' })
  }
  if (toolFamily === 'reviews_seo_direct') {
    push({ key: 'seo', label: 'SEO & Growth', path: '/presence/seo' })
  }
  if (toolFamily === 'cost_vendor_invoice_inventory') {
    push({ key: 'vendors', label: 'Vendors', path: '/operations/vendors' })
  }

  return links
}

export function applyEvidenceScope(link: EvidenceLink, setters: ScopeSetters) {
  if (link.from && link.to) {
    setters.setDatePreset('custom')
    setters.setCustomFrom(link.from)
    setters.setCustomTo(link.to)
  }
  if (link.locationId) setters.setSelectedLocationId(link.locationId)
}

import type { SelectOption } from '../components/ui'

const COMMON_TIMEZONES: Array<{ value: string; label: string }> = [
  { value: 'America/Los_Angeles', label: 'Pacific Time — America/Los_Angeles' },
  { value: 'America/Denver', label: 'Mountain Time — America/Denver' },
  { value: 'America/Phoenix', label: 'Arizona — America/Phoenix' },
  { value: 'America/Chicago', label: 'Central Time — America/Chicago' },
  { value: 'America/New_York', label: 'Eastern Time — America/New_York' },
  { value: 'America/Anchorage', label: 'Alaska — America/Anchorage' },
  { value: 'Pacific/Honolulu', label: 'Hawaii — Pacific/Honolulu' },
  { value: 'America/Puerto_Rico', label: 'Puerto Rico — America/Puerto_Rico' },
  { value: 'America/Toronto', label: 'Eastern Canada — America/Toronto' },
  { value: 'America/Vancouver', label: 'Pacific Canada — America/Vancouver' },
  { value: 'America/Mexico_City', label: 'Mexico City — America/Mexico_City' },
  { value: 'UTC', label: 'UTC' },
  { value: 'Europe/London', label: 'UK — Europe/London' },
  { value: 'Asia/Karachi', label: 'Pakistan — Asia/Karachi' },
  { value: 'Asia/Dubai', label: 'Gulf — Asia/Dubai' },
  { value: 'Asia/Singapore', label: 'Singapore — Asia/Singapore' },
  { value: 'Australia/Sydney', label: 'Sydney — Australia/Sydney' },
]

let cachedIana: string[] | null = null

function allIanaTimezones(): string[] {
  if (cachedIana) return cachedIana
  const supported = Intl.supportedValuesOf?.('timeZone')
  cachedIana = Array.isArray(supported) && supported.length
    ? supported
    : COMMON_TIMEZONES.map((zone) => zone.value)
  return cachedIana
}

function labelFor(zone: string): string {
  return COMMON_TIMEZONES.find((row) => row.value === zone)?.label ?? zone
}

/** Common restaurant markets first, then remaining IANA zones. Includes `current` if it is missing. */
export function timezoneSelectOptions(current?: string): SelectOption[] {
  const seen = new Set<string>()
  const options: SelectOption[] = []
  const add = (value: string) => {
    if (!value || seen.has(value)) return
    seen.add(value)
    options.push({ value, label: labelFor(value) })
  }

  if (current) add(current)
  for (const row of COMMON_TIMEZONES) add(row.value)
  for (const zone of allIanaTimezones()) add(zone)
  return options
}

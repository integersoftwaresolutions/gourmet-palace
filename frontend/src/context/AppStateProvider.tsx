import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { locationsApi, type Location } from '../lib/api'
import { useAuth } from './useAuth'
import { AppStateContext, type DatePreset, type ComparisonMode } from './app-state-context'

const iso = (d: Date) => d.toISOString().slice(0, 10)
const yesterday = () => {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - 1)
  return iso(d)
}

function readStoredDate(key: string, fallback: string) {
  const value = localStorage.getItem(key)
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback
}

/** Keep custom ranges ordered so API never sees from > to. */
function orderedRange(from: string, to: string) {
  if (from && to && from > to) return { from: to, to: from }
  return { from, to }
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isOnboarded, user } = useAuth()
  const [locations, setLocations] = useState<Location[]>([])
  const [selectedLocationId, setSelectedLocationIdState] = useState(
    () => localStorage.getItem('gp.location') || 'all',
  )
  const [datePreset, setDatePresetState] = useState<DatePreset>(
    () => (localStorage.getItem('gp.preset') as DatePreset) || 'yesterday',
  )
  const initialYesterday = yesterday()
  const initialRange = orderedRange(
    readStoredDate('gp.from', initialYesterday),
    readStoredDate('gp.to', initialYesterday),
  )
  const [customFrom, setCustomFromState] = useState(initialRange.from)
  const [customTo, setCustomToState] = useState(initialRange.to)
  const [comparisonMode, setComparisonModeState] = useState<ComparisonMode>(
    () => (localStorage.getItem('gp.comparison') as ComparisonMode) || 'previous',
  )
  const [theme, setThemeState] = useState<'dark' | 'light'>(
    () => (localStorage.getItem('gp.theme') as 'dark' | 'light') || 'dark',
  )

  const refreshLocations = useCallback(async () => {
    if (!isAuthenticated || !isOnboarded) {
      setLocations([])
      return
    }
    const r = await locationsApi.list()
    const active = r.data.locations.filter((l) => l.status === 'active')
    setLocations(r.data.locations)
    if (
      user?.role === 'manager' &&
      (selectedLocationId === 'all' || !active.some((l) => l.id === selectedLocationId)) &&
      active[0]
    ) {
      setSelectedLocationIdState(active[0].id)
    } else if (
      selectedLocationId !== 'all' &&
      !r.data.locations.some((l) => l.id === selectedLocationId)
    ) {
      setSelectedLocationIdState('all')
    }
  }, [isAuthenticated, isOnboarded, selectedLocationId, user?.role])

  useEffect(() => {
    refreshLocations().catch(() => setLocations([]))
  }, [refreshLocations])

  useEffect(() => {
    document.documentElement.classList.remove('dark', 'light')
    document.documentElement.classList.add(theme)
    localStorage.setItem('gp.theme', theme)
  }, [theme])

  // Heal inverted ranges already stuck in localStorage / state.
  useEffect(() => {
    if (customFrom <= customTo) return
    const next = orderedRange(customFrom, customTo)
    setCustomFromState(next.from)
    setCustomToState(next.to)
    localStorage.setItem('gp.from', next.from)
    localStorage.setItem('gp.to', next.to)
  }, [customFrom, customTo])

  const setSelectedLocationId = (v: string) => {
    setSelectedLocationIdState(v)
    localStorage.setItem('gp.location', v)
  }
  const setDatePreset = (v: DatePreset) => {
    setDatePresetState(v)
    localStorage.setItem('gp.preset', v)
  }
  const setCustomFrom = (v: string) => {
    const next = orderedRange(v, customTo)
    setCustomFromState(next.from)
    setCustomToState(next.to)
    localStorage.setItem('gp.from', next.from)
    localStorage.setItem('gp.to', next.to)
  }
  const setCustomTo = (v: string) => {
    const next = orderedRange(customFrom, v)
    setCustomFromState(next.from)
    setCustomToState(next.to)
    localStorage.setItem('gp.from', next.from)
    localStorage.setItem('gp.to', next.to)
  }
  const setComparisonMode = (v: ComparisonMode) => {
    setComparisonModeState(v)
    localStorage.setItem('gp.comparison', v)
  }

  const query = useMemo(() => {
    const range =
      datePreset === 'custom' ? orderedRange(customFrom, customTo) : null
    return {
      ...(selectedLocationId !== 'all' ? { locationId: selectedLocationId } : {}),
      ...(range ? { from: range.from, to: range.to } : { preset: datePreset }),
      comparison: comparisonMode,
    }
  }, [selectedLocationId, datePreset, customFrom, customTo, comparisonMode])

  return (
    <AppStateContext.Provider
      value={{
        locations,
        selectedLocationId,
        setSelectedLocationId,
        datePreset,
        setDatePreset,
        customFrom,
        setCustomFrom,
        customTo,
        setCustomTo,
        comparisonMode,
        setComparisonMode,
        theme,
        setTheme: setThemeState,
        refreshLocations,
        query,
      }}
    >
      {children}
    </AppStateContext.Provider>
  )
}

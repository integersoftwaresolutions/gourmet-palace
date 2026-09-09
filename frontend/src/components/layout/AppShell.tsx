import { type ReactNode, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiAlertCircle, FiBarChart2, FiBookOpen, FiFileText, FiGrid, FiMapPin, FiSearch, FiSettings, FiShield } from 'react-icons/fi'
import { useAuth } from '../../context/useAuth'
import { useAppState } from '../../context/useAppState'
import { alertsApi } from '../../lib/api'
import { useAsyncResource } from '../../hooks/useAsyncResource'
import { Button, Select, Sidebar } from '../ui'
import { AskAI } from '../../pages/AskAI'
import { Settings } from '../../pages/Settings'

type Props = {
  title: string
  subtitle?: string
  activeNav: string
  badge?: ReactNode
  actions?: ReactNode
  headerLead?: ReactNode
  children: ReactNode
}

const roleLabels: Record<string, string> = {
  owner: 'Organization Owner',
  admin: 'Administrator',
  manager: 'Manager',
}

export function AppShell({ title, subtitle, activeNav, badge, actions, headerLead, children }: Props) {
  const { user, isAdmin } = useAuth()
  const {
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
  } = useAppState()
  const navigate = useNavigate()
  const [askOpen, setAskOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { data: loadedAlertCount } = useAsyncResource(
    () => alertsApi.list({ status: 'OPEN' }).then((res) => res.data.alerts.length),
    [selectedLocationId, datePreset],
    { fallbackError: 'Unable to load alerts' },
  )
  const openAlertsCount = loadedAlertCount ?? 0

  const items = [
    { id: 'overview', label: 'Command Center', icon: <FiGrid />, active: activeNav === 'overview' },
    { id: 'performance', label: 'Performance', icon: <FiBarChart2 />, active: activeNav === 'performance' },
    {
      id: 'alerts',
      label: 'Alerts',
      icon: <FiAlertCircle />,
      badge: (
        <span className="inline-flex size-5 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-brand-text">
          {openAlertsCount}
        </span>
      ),
      active: activeNav === 'alerts',
    },
    { id: 'operations', label: 'Operations', icon: <FiMapPin />, active: activeNav === 'operations' },
    { id: 'brief', label: 'Morning Brief', icon: <FiBookOpen />, active: activeNav === 'brief' },
    ...(isAdmin
      ? [
          { id: 'reporting', label: 'Reporting Center', icon: <FiFileText />, active: activeNav === 'reporting' },
          { id: 'presence', label: 'SEO & Growth', icon: <FiSearch />, active: activeNav === 'presence' },
          { id: 'admin', label: 'Admin', icon: <FiShield />, active: activeNav === 'admin' },
        ]
      : []),
  ]

  const go = (id: string) => {
    const map: Record<string, string> = {
      overview: '/overview',
      performance: '/performance',
      alerts: '/alerts',
      operations: '/operations',
      brief: '/morning-brief',
      reporting: '/reports',
      presence: '/presence',
      admin: '/admin',
    }
    navigate(map[id] || '/overview')
  }

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar
        className="sticky top-0 h-screen print:hidden"
        brand={{ title: 'Gourmet Palace', subtitle: 'Command Center' }}
        items={items}
        onNavigate={go}
        footer={{ name: user?.name || 'User', role: roleLabels[user?.role || ''] || user?.role }}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-border px-6 py-3 md:px-8 print:hidden">
          <div className="flex flex-wrap items-center gap-2">
            {headerLead}
            <div className="w-52">
              <Select
                size="sm"
                value={selectedLocationId}
                options={[
                  ...(isAdmin ? [{ value: 'all', label: 'All locations' }] : []),
                  ...locations.filter((l) => l.status === 'active').map((l) => ({ value: l.id, label: l.name })),
                ]}
                onChange={setSelectedLocationId}
              />
            </div>
            <div className="w-36">
              <Select
                size="sm"
                value={datePreset}
                options={[
                  { value: 'yesterday', label: 'Yesterday' },
                  { value: '7d', label: '7 Days' },
                  { value: '30d', label: '30 Days' },
                  { value: 'wtd', label: 'WTD' },
                  { value: 'mtd', label: 'MTD' },
                  { value: 'ytd', label: 'YTD' },
                  { value: 'custom', label: 'Custom Range' },
                ]}
                onChange={(v) => setDatePreset(v as typeof datePreset)}
              />
            </div>
            {datePreset === 'custom' && (
              <>
                <input aria-label="From date" type="date" value={customFrom} max={customTo} onChange={(e) => setCustomFrom(e.target.value)} className="h-9 rounded-lg border border-card-border bg-card px-2 text-xs text-card-text" />
                <input aria-label="To date" type="date" value={customTo} min={customFrom} onChange={(e) => setCustomTo(e.target.value)} className="h-9 rounded-lg border border-card-border bg-card px-2 text-xs text-card-text" />
              </>
            )}
            <div className="w-36">
              <Select
                size="sm"
                value={comparisonMode}
                options={[
                  { value: 'previous', label: 'Prior period' },
                  { value: 'prior-year', label: 'Prior year' },
                ]}
                onChange={(v) => setComparisonMode(v as typeof comparisonMode)}
              />
            </div>
            <span className="text-xs text-surface-text-muted">{theme === 'light' ? 'Light' : 'Dark'} mode · scoped data</span>
          </div>
          <div className="flex items-center gap-2">
            {actions}
            <Button tone="accent" size="sm" onClick={() => setAskOpen(true)}>Ask AI</Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/alerts')} aria-label={`${openAlertsCount} open alerts`}>
              Alerts {openAlertsCount}
            </Button>
            <button type="button" aria-label="Settings" onClick={() => setSettingsOpen(true)} className="flex size-9 items-center justify-center rounded-full border border-card-border bg-card text-card-text hover:bg-card-hover">
              <FiSettings />
            </button>
          </div>
        </header>
        <main className="min-w-0 flex-1 px-6 py-6 md:px-8">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight text-surface-text">{title}</h1>
                {badge}
              </div>
              {subtitle && <p className="mt-1 text-sm text-surface-text-muted">{subtitle}</p>}
            </div>
          </div>
          {children}
        </main>
      </div>
      <AskAI open={askOpen} onClose={() => setAskOpen(false)} />
      <Settings open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}

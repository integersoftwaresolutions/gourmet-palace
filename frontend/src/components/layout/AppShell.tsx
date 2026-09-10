import { type ReactNode, useEffect, useId, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiAlertCircle, FiBarChart2, FiBookOpen, FiFileText, FiGrid, FiMapPin, FiMenu, FiMoon, FiSearch, FiSettings, FiShield, FiSun, FiX } from 'react-icons/fi'
import { useAuth } from '../../context/useAuth'
import { useAppState } from '../../context/useAppState'
import { alertsApi } from '../../lib/api'
import { useAsyncResource } from '../../hooks/useAsyncResource'
import { Button, Select, Sidebar } from '../ui'
import { AskAI } from '../../pages/AskAI'
import { Settings } from '../../pages/Settings'
import { cn } from '../../lib/cn'
import { Drawer } from '../ui/Drawer'

type Props = {
  title: string
  subtitle?: string
  activeNav: string
  badge?: ReactNode
  actions?: ReactNode
  headerLead?: ReactNode
  children: ReactNode
  contained?: boolean
}

const roleLabels: Record<string, string> = {
  owner: 'Organization Owner',
  admin: 'Administrator',
  manager: 'Manager',
}

export function AppShell({ title, subtitle, activeNav, badge, actions, headerLead, children, contained = false }: Props) {
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
    setTheme,
  } = useAppState()
  const navigate = useNavigate()
  const [askOpen, setAskOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('gp.sidebarCollapsed') === 'true')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const navigationTitleId = useId()
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)')
    const closeOnDesktop = () => { if (desktop.matches) setMobileNavOpen(false) }
    desktop.addEventListener('change', closeOnDesktop)
    return () => desktop.removeEventListener('change', closeOnDesktop)
  }, [])
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
    setMobileNavOpen(false)
    navigate(map[id] || '/overview')
  }

  return (
    <div className={cn('flex min-h-screen bg-surface', contained && 'h-dvh min-h-0 overflow-hidden print:h-auto print:overflow-visible')}>
      <Sidebar
        className="sticky top-0 hidden h-dvh lg:flex print:hidden"
        collapsed={sidebarCollapsed}
        onToggle={() => {
          const next = !sidebarCollapsed
          setSidebarCollapsed(next)
          localStorage.setItem('gp.sidebarCollapsed', String(next))
        }}
        brand={{ title: 'Gourmet Palace', subtitle: 'Command Center' }}
        items={items}
        onNavigate={go}
        footer={{ name: user?.name || 'User', role: roleLabels[user?.role || ''] || user?.role }}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-surface-border px-6 py-3 md:px-8 print:hidden">
          <div className="flex flex-wrap items-center gap-2">
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
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" aria-label="Open navigation" aria-expanded={mobileNavOpen} aria-haspopup="dialog" onClick={() => setMobileNavOpen(true)} className="flex size-9 items-center justify-center rounded-lg border border-card-border text-card-text hover:bg-card-hover lg:hidden">
              <FiMenu aria-hidden="true" />
            </button>
            <Button tone="accent" size="sm" onClick={() => setAskOpen(true)}>Ask AI</Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/alerts')} aria-label={`${openAlertsCount} open alerts`}>
              Alerts {openAlertsCount}
            </Button>
            <button
              type="button"
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="flex size-9 items-center justify-center rounded-full border border-card-border bg-card text-card-text hover:bg-card-hover"
            >
              {theme === 'dark' ? <FiSun aria-hidden="true" /> : <FiMoon aria-hidden="true" />}
            </button>
            <button type="button" aria-label="Settings" onClick={() => setSettingsOpen(true)} className="flex size-9 items-center justify-center rounded-full border border-card-border bg-card text-card-text hover:bg-card-hover">
              <FiSettings />
            </button>
          </div>
        </header>
        <main className={cn('min-w-0 flex-1 px-6 py-6 md:px-8', contained && 'flex min-h-0 flex-col overflow-hidden print:overflow-visible')}>
          <div className="mb-6 flex shrink-0 flex-wrap items-start justify-between gap-3">
            <div>
              {headerLead && <div className="mb-3">{headerLead}</div>}
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight text-surface-text">{title}</h1>
                {badge}
              </div>
              {subtitle && <p className="mt-1 text-sm text-surface-text-muted">{subtitle}</p>}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2 print:hidden">{actions}</div>}
          </div>
          {children}
        </main>
      </div>
      <Drawer open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} labelledBy={navigationTitleId} side="left">
        <div className="flex shrink-0 items-center justify-between bg-canvas px-4 pt-4">
          <h2 id={navigationTitleId} className="text-sm font-semibold text-canvas-text">Navigation</h2>
          <button type="button" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} className="flex size-9 items-center justify-center rounded-lg text-canvas-text-muted hover:bg-canvas-hover"><FiX /></button>
        </div>
        <Sidebar
          className="min-h-0 w-full flex-1 border-r-0"
          brand={{ title: 'Gourmet Palace', subtitle: 'Command Center' }}
          items={items}
          onNavigate={go}
          footer={{ name: user?.name || 'User', role: roleLabels[user?.role || ''] || user?.role }}
        />
      </Drawer>
      <AskAI open={askOpen} onClose={() => setAskOpen(false)} />
      <Settings open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}

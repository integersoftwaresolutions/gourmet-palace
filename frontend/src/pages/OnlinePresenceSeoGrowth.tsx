import { useNavigate } from 'react-router-dom'
import {
  BarChart,
  Card,
  KpiCard,
  Pill,
  Tabs,
} from '../components/ui'
import { AppShell } from '../components/layout/AppShell'
import { chartColors } from '../components/ui/charts/chartTheme'
import { cn } from '../lib/cn'

const trafficData = [
  { week: 'W1', organic: 38, direct: 22 },
  { week: 'W2', organic: 41, direct: 24 },
  { week: 'W3', organic: 36, direct: 21 },
  { week: 'W4', organic: 44, direct: 26 },
  { week: 'W5', organic: 48, direct: 28 },
  { week: 'W6', organic: 52, direct: 31 },
  { week: 'W7', organic: 55, direct: 34 },
  { week: 'W8', organic: 58, direct: 36 },
]

const declining = [
  {
    title: 'Keyword “chinese delivery woodland hills” ▼ 22%',
    detail: 'Avg position 4.1 → 6.8 · 310 fewer clicks/wk',
    tone: 'warning' as const,
  },
  {
    title: 'Page /menu ▼ 15% organic clicks',
    detail: 'Possible crawl issue after site update',
    tone: 'warning' as const,
  },
  {
    title: 'Simi Valley GBP impressions ▼ 8%',
    detail: 'Lower than the seasonal norm',
    tone: 'info' as const,
  },
]

const toneDot = {
  warning: 'bg-warning',
  info: 'bg-info',
} as const

function navigatePresenceTab(
  navigate: ReturnType<typeof useNavigate>,
  id: string,
) {
  if (id === 'reviews') navigate('/presence')
  if (id === 'seo') navigate('/presence/seo')
}

const presenceTabs = [
  { id: 'reviews', label: 'Reviews' },
  { id: 'seo', label: 'SEO & growth' },
]

/** SEO & Growth — filename omits `&` (invalid in paths). */
export function OnlinePresenceSeoGrowth() {
  const navigate = useNavigate()

  return (
    <AppShell
      title="Online Presence"
      subtitle="SEO, website visibility and direct-order growth without unsupported attribution claims"
      activeNav="presence"
      badge={
        <Pill tone="accent" variant="outline">
          Admin only
        </Pill>
      }
    >
      <div className="flex flex-col gap-5">
        <Tabs
          value="seo"
          onChange={(id) => navigatePresenceTab(navigate, id)}
          items={presenceTabs}
        />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Direct orders · wk"
            value="412"
            delta={{ value: '6%', direction: 'up' }}
          />
          <KpiCard
            label="Organic clicks · wk"
            value="3,208"
            delta={{ value: '4%', direction: 'up' }}
          />
          <KpiCard
            label="GA4 sessions"
            value="9,844"
            delta={{ value: '2%', direction: 'down' }}
          />
          <KpiCard
            label="GBP impressions"
            value="48.2K"
            delta={{ value: '9%', direction: 'up' }}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Organic traffic vs direct orders · 8 wks" padding="lg">
            <BarChart
              data={trafficData}
              categoryKey="week"
              series={[
                {
                  key: 'organic',
                  label: 'Organic clicks',
                  color: chartColors.brand,
                },
                {
                  key: 'direct',
                  label: 'Direct orders',
                  color: chartColors.accent,
                },
              ]}
              height={280}
              showGrid={false}
            />
          </Card>

          <Card title="Declining · needs attention" padding="lg">
            <ul className="flex flex-col gap-2">
              {declining.map((item) => (
                <li
                  key={item.title}
                  className="flex items-start gap-3 rounded-lg bg-card-hover px-3 py-3"
                >
                  <span
                    className={cn(
                      'mt-1.5 size-2 shrink-0 rounded-full',
                      toneDot[item.tone],
                    )}
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-card-text">
                      {item.title}
                    </p>
                    <p className="mt-0.5 text-xs text-card-text-muted">
                      {item.detail}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <Card accentBorder="accent" padding="md">
          <div className="flex items-start gap-3">
            <span
              className="mt-1 size-2 shrink-0 rotate-45 bg-accent"
              aria-hidden
            />
            <p className="text-sm text-card-text">
              Location opportunity: Woodland Hills converts organic traffic at
              2.1% vs Sherman Oaks at 3.8%. A delivery landing page is the
              highest-leverage SEO move. No GA → POS attribution is claimed.
            </p>
          </div>
        </Card>
      </div>
    </AppShell>
  )
}

import { AppShell } from '../components/layout/AppShell'
import { Button, Card, KpiCard, Pill } from '../components/ui'

export function ReportingCenter() {
  return (
    <AppShell
      title="Executive Reporting Center"
      subtitle="Owner/Admin reporting wireframe — live export and scorecards land in a later milestone"
      activeNav="reporting"
      actions={<Button size="sm" variant="outline" disabled>Print / Save PDF</Button>}
    >
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Net sales" value="—" meta="Canonical period" />
          <KpiCard label="Orders" value="—" meta="Completed canonical orders" />
          <KpiCard label="Business health" value="—" meta="Sales-weighted location scores" />
          <KpiCard label="Coverage" value="—" meta="Expected location-days" />
        </div>
        <Card title="Scorecards & exports">
          <p className="text-sm leading-6 text-card-text-muted">
            This screen is the approved Reporting Center wireframe. Live CSV/print output, invoice spend, inventory freshness, reviews, alerts and forecasts are not part of the current milestone.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Pill tone="neutral" variant="outline">Mock layout</Pill>
            <Pill tone="accent" variant="outline">Later milestone</Pill>
          </div>
        </Card>
      </div>
    </AppShell>
  )
}

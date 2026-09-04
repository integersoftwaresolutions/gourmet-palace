import { useState, type ReactNode } from 'react'
import {
  FiAlertCircle,
  FiBarChart2,
  FiBell,
  FiGrid,
  FiPlus,
  FiSearch,
  FiSettings,
  FiShield,
  FiUsers,
} from 'react-icons/fi'
import {
  BarChart,
  Button,
  Card,
  Input,
  KpiCard,
  LineAreaChart,
  LineChart,
  Modal,
  PieChart,
  Pill,
  Select,
  Sidebar,
  Table,
  Tabs,
  Toggle,
} from '../components/ui'

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <Card title={title} padding="lg">
      {description && (
        <p className="-mt-2 mb-5 text-sm text-card-text-muted">{description}</p>
      )}
      {children}
    </Card>
  )
}

const barData = [
  { day: 'Mon', sales: 42, profit: 18 },
  { day: 'Tue', sales: 55, profit: 24 },
  { day: 'Wed', sales: 48, profit: 21 },
  { day: 'Thu', sales: 62, profit: 28 },
  { day: 'Fri', sales: 71, profit: 32 },
  { day: 'Sat', sales: 88, profit: 41 },
  { day: 'Sun', sales: 65, profit: 30 },
]

const lineData = [
  { day: 'Thu', expected: 48, actual: 45 },
  { day: 'Fri', expected: 52, actual: 55 },
  { day: 'Sat', expected: 70, actual: 74 },
  { day: 'Sun', expected: 58, actual: 51 },
  { day: 'Mon', expected: 44, actual: 46 },
  { day: 'Tue', expected: 50, actual: 53 },
  { day: 'Wed', expected: 54, actual: 52 },
]

const areaData = [
  { day: 'Thu', expected: 48, low: 40, high: 56 },
  { day: 'Fri', expected: 52, low: 44, high: 60 },
  { day: 'Sat', expected: 70, low: 60, high: 82 },
  { day: 'Sun', expected: 58, low: 48, high: 68 },
  { day: 'Mon', expected: 44, low: 36, high: 52 },
  { day: 'Tue', expected: 50, low: 42, high: 58 },
  { day: 'Wed', expected: 54, low: 46, high: 62 },
]

const pieData = [
  { name: 'Dine-in', value: 42 },
  { name: 'Delivery', value: 28 },
  { name: 'Takeout', value: 18 },
  { name: 'Catering', value: 12 },
]

type UserRow = {
  name: string
  email: string
  role: string
  status: string
  location: string
}

const tableRows: UserRow[] = [
  {
    name: 'Jimmy George',
    email: 'jimmy@gourmetpalace.com',
    role: 'Owner',
    status: 'Active',
    location: 'All locations',
  },
  {
    name: 'Aisha Rahman',
    email: 'aisha@gourmetpalace.com',
    role: 'Manager',
    status: 'Active',
    location: 'Sherman Oaks',
  },
  {
    name: 'Chris Park',
    email: 'chris@gourmetpalace.com',
    role: 'Manager',
    status: 'Invited',
    location: 'Woodland Hills',
  },
]

export function ComponentDemo() {
  const [email, setEmail] = useState('')
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [location, setLocation] = useState('all')
  const [notifications, setNotifications] = useState(true)
  const [underlineTab, setUnderlineTab] = useState('stores')
  const [pillTab, setPillTab] = useState('daily')
  const [sidebarActive, setSidebarActive] = useState('overview')
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-surface-border px-6 py-5 md:px-10">
        <p className="text-[11px] font-medium tracking-widest text-accent-subtle-text uppercase">
          Gourmet Palace
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-surface-text md:text-3xl">
          Component System
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-surface-text-muted">
          Token-only UI kit — every color comes from the theme. Screenshots were
          the attitude reference; variants stay consistent.
        </p>
      </header>

      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8 md:px-10">
        {/* Buttons */}
        <Section title="Button" description="fill · outline · ghost · subtle × brand · accent · neutral · danger">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button tone="brand">Invite User</Button>
              <Button tone="accent">Ask AI</Button>
              <Button tone="neutral" variant="outline">
                Past briefs
              </Button>
              <Button tone="danger" variant="fill">
                Delete
              </Button>
              <Button tone="brand" variant="subtle">
                Subtle
              </Button>
              <Button tone="neutral" variant="ghost">
                Ghost
              </Button>
              <Button tone="brand" leftIcon={<FiPlus className="size-4" />}>
                Add
              </Button>
              <Button loading>Loading</Button>
              <Button disabled>Disabled</Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm" shape="rounded">
                Small rounded
              </Button>
              <Button size="md">Medium pill</Button>
              <Button size="lg" tone="accent">
                Large accent
              </Button>
            </div>
          </div>
        </Section>

        {/* Input + Select */}
        <Section title="Input & Select" description="Shared field language — label, hint, error, icons">
          <div className="grid gap-5 md:grid-cols-2">
            <Input
              label="Email address"
              type="email"
              placeholder="you@gourmetpalace.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<FiSearch className="size-4" />}
              hint="Allowlisted users only"
            />
            <Input
              label="Password"
              type={passwordVisible ? 'text' : 'password'}
              placeholder="••••••••"
              defaultValue="secret"
              rightSlot={
                <button
                  type="button"
                  className="text-xs font-semibold text-accent-subtle-text hover:text-accent-hover"
                  onClick={() => setPasswordVisible((v) => !v)}
                >
                  {passwordVisible ? 'Hide' : 'Show'}
                </button>
              }
            />
            <Input
              label="With error"
              placeholder="Invalid value"
              error="This field is required"
              defaultValue=""
            />
            <Select
              label="Location"
              value={location}
              onChange={setLocation}
              options={[
                { value: 'all', label: 'All locations' },
                { value: 'sherman', label: 'Sherman Oaks' },
                { value: 'woodland', label: 'Woodland Hills' },
                { value: 'closed', label: 'Closed (disabled)', disabled: true },
              ]}
            />
          </div>
        </Section>

        {/* Pills */}
        <Section title="Pill" description="solid · subtle · outline across semantic tones">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <Pill tone="success" variant="outline">
                Active
              </Pill>
              <Pill tone="accent" variant="outline">
                Owner
              </Pill>
              <Pill tone="neutral" variant="outline">
                Manager
              </Pill>
              <Pill tone="danger" variant="solid">
                Critical
              </Pill>
              <Pill tone="warning" variant="subtle">
                Warning
              </Pill>
              <Pill tone="info" variant="outline" dot>
                Info
              </Pill>
              <Pill tone="success" variant="subtle">
                +8.2% vs Tue
              </Pill>
              <Pill tone="accent" variant="outline" size="md">
                Admin only
              </Pill>
              <Pill tone="neutral" variant="subtle" onRemove={() => undefined}>
                Removable
              </Pill>
            </div>
          </div>
        </Section>

        {/* Toggle + Tabs */}
        <Section title="Toggle & Tabs">
          <div className="flex flex-col gap-8">
            <Toggle
              checked={notifications}
              onChange={setNotifications}
              label="Email notifications"
              tone="accent"
            />

            <div className="space-y-3">
              <p className="text-xs text-card-text-faint uppercase tracking-widest">
                Underline
              </p>
              <Tabs
                variant="underline"
                value={underlineTab}
                onChange={setUnderlineTab}
                items={[
                  { id: 'stores', label: 'Stores' },
                  { id: 'operations', label: 'Operations' },
                  { id: 'finance', label: 'Finance' },
                  { id: 'forecast', label: 'Forecast' },
                ]}
              />
            </div>

            <div className="space-y-3">
              <p className="text-xs text-card-text-faint uppercase tracking-widest">
                Pill
              </p>
              <Tabs
                variant="pill"
                value={pillTab}
                onChange={setPillTab}
                items={[
                  { id: 'daily', label: 'Daily' },
                  { id: 'weekly', label: 'Weekly' },
                  { id: 'mtd', label: 'MTD' },
                ]}
              />
            </div>
          </div>
        </Section>

        {/* Card + KpiCard */}
        <Section title="Card & KpiCard">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Net sales"
              value="$52,410"
              delta={{ value: '8.2% vs Tue', direction: 'up' }}
            />
            <KpiCard
              label="Tickets"
              value="986"
              delta={{ value: '4.1%', direction: 'up' }}
            />
            <KpiCard
              label="Refunds"
              value="$1,240"
              delta={{ value: '42%', direction: 'down' }}
              pill={<Pill tone="danger" variant="outline">Critical</Pill>}
            />
            <KpiCard
              label="This week outlook"
              value="$368K"
              meta="Low $341K · High $396K"
              pill={<Pill tone="success" variant="subtle">8 days</Pill>}
            />
          </div>

          <Card
            className="mt-4"
            accentBorder="accent"
            title="Insight"
            action={<Pill tone="accent" variant="outline">Estimate</Pill>}
            footer={
              <Button variant="outline" size="sm">
                Edit targets
              </Button>
            }
          >
            <p className="text-sm text-card-text">
              High-leverage: Sherman Oaks weekend traffic is outpacing forecast.
              Consider staffing +1 for Saturday dinner.
            </p>
          </Card>
        </Section>

        {/* Table */}
        <Section title="Table">
          <Table<UserRow>
            rows={tableRows}
            getRowKey={(row) => row.email}
            columns={[
              {
                key: 'name',
                header: 'Name',
                render: (row) => (
                  <div>
                    <p className="font-medium text-card-text">{row.name}</p>
                    <p className="text-xs text-card-text-muted">{row.email}</p>
                  </div>
                ),
              },
              {
                key: 'role',
                header: 'Role',
                render: (row) => (
                  <Pill
                    tone={row.role === 'Owner' ? 'accent' : 'neutral'}
                    variant="outline"
                  >
                    {row.role}
                  </Pill>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                render: (row) => (
                  <Pill
                    tone={row.status === 'Active' ? 'success' : 'warning'}
                    variant="outline"
                    dot
                  >
                    {row.status}
                  </Pill>
                ),
              },
              {
                key: 'location',
                header: 'Location',
                render: (row) => (
                  <span className="text-card-text-muted">{row.location}</span>
                ),
              },
            ]}
          />
        </Section>

        {/* Sidebar preview */}
        <Section title="Sidebar" description="Embedded preview — not full app chrome">
          <div className="overflow-hidden rounded-xl border border-card-border">
            <div className="flex h-[360px]">
              <Sidebar
                brand={{
                  title: 'Gourmet Palace',
                  subtitle: 'Command Center',
                }}
                items={[
                  {
                    id: 'overview',
                    label: 'Overview',
                    icon: <FiGrid />,
                    active: sidebarActive === 'overview',
                  },
                  {
                    id: 'performance',
                    label: 'Performance',
                    icon: <FiBarChart2 />,
                    active: sidebarActive === 'performance',
                  },
                  {
                    id: 'alerts',
                    label: 'Alerts',
                    icon: <FiAlertCircle />,
                    badge: (
                      <span className="inline-flex size-5 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-brand-text">
                        4
                      </span>
                    ),
                    active: sidebarActive === 'alerts',
                  },
                  {
                    id: 'presence',
                    label: 'Presence',
                    icon: <FiUsers />,
                    active: sidebarActive === 'presence',
                  },
                  {
                    id: 'admin',
                    label: 'Admin',
                    icon: <FiShield />,
                    active: sidebarActive === 'admin',
                  },
                  {
                    id: 'settings',
                    label: 'Settings',
                    icon: <FiSettings />,
                    active: sidebarActive === 'settings',
                  },
                ]}
                onNavigate={setSidebarActive}
                footer={{
                  name: 'Jimmy George',
                  role: 'Organization Owner',
                }}
              />
              <div className="flex flex-1 flex-col bg-surface p-6">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm text-surface-text-muted">
                    Active: {sidebarActive}
                  </p>
                  <Button size="sm" tone="accent" leftIcon={<FiBell className="size-3.5" />}>
                    Ask AI
                  </Button>
                </div>
                <p className="text-surface-text-faint text-sm">
                  Main content region uses surface tokens beside the canvas sidebar.
                </p>
              </div>
            </div>
          </div>
        </Section>

        {/* Charts */}
        <Section title="Charts" description="Recharts wrappers — series colors from theme tokens">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Bar" padding="md">
              <BarChart
                data={barData}
                categoryKey="day"
                series={[
                  { key: 'sales', label: 'Net sales' },
                  { key: 'profit', label: 'Est. profit' },
                ]}
              />
            </Card>
            <Card title="Pie / Donut" padding="md">
              <PieChart data={pieData} donut />
            </Card>
            <Card title="Line" padding="md">
              <LineChart
                data={lineData}
                categoryKey="day"
                series={[
                  { key: 'expected', label: 'Expected' },
                  { key: 'actual', label: 'Actual' },
                ]}
              />
            </Card>
            <Card title="Line area + range" padding="md">
              <LineAreaChart
                data={areaData}
                categoryKey="day"
                series={[{ key: 'expected', label: 'Expected line' }]}
                range={{ lowKey: 'low', highKey: 'high' }}
              />
            </Card>
          </div>
        </Section>

        {/* Modal */}
        <Section title="Modal" description="Portal · focus trap · Escape · scrim click">
          <Button onClick={() => setModalOpen(true)}>Open modal</Button>
          <Modal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            title="Invite user"
            description="Access is limited to allowlisted accounts."
            footer={
              <>
                <Button variant="outline" onClick={() => setModalOpen(false)}>
                  Cancel
                </Button>
                <Button tone="brand" onClick={() => setModalOpen(false)}>
                  Send invite
                </Button>
              </>
            }
          >
            <div className="flex flex-col gap-4">
              <Input label="Email" type="email" placeholder="name@company.com" />
              <Select
                label="Role"
                defaultValue="manager"
                options={[
                  { value: 'owner', label: 'Owner' },
                  { value: 'manager', label: 'Manager' },
                  { value: 'staff', label: 'Staff' },
                ]}
              />
            </div>
          </Modal>
        </Section>
      </div>
    </div>
  )
}

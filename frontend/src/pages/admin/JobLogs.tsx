import { useEffect, useState } from 'react'
import { AppShell } from '../../components/layout/AppShell'
import { AdminTabs } from '../../components/layout/SectionTabs'
import { QueryState, ListSkeleton } from '../../components/query'
import { Button, Card, Modal, Pagination, Pill, Select } from '../../components/ui'
import { apiRequest } from '../../lib/api'
import { useAsyncResource } from '../../hooks/useAsyncResource'
import type { PaginationMeta } from '../../lib/pagination'

type Job = {
  _id: string; source: string; jobType: string; status: string; businessDate: string; attempts: number
  locationId?: { name: string } | null; createdAt: string; startedAt?: string; finishedAt?: string
  availableAt?: string; error?: string; result?: Record<string, unknown>; history?: Array<Record<string, unknown>>
}
const timestamp = (value?: string) => value ? new Intl.DateTimeFormat('en-GB', {
  day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit',
  hour12: true, timeZone: 'America/Los_Angeles',
}).format(new Date(value)) + ' PT' : '—'
const label = (value: string) => value.replaceAll('_', ' ')

export function JobLogs() {
  const [status, setStatus] = useState('')
  const [source, setSource] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Job | null>(null)
  const { data, error, isLoading, isRefreshing, reload } = useAsyncResource(
    () => apiRequest<{ jobs: Job[]; pagination: PaginationMeta }>(`/system/jobs?${new URLSearchParams({ status, source, page: String(page) })}`).then((r) => r.data),
    [status, source, page], { fallbackError: 'Unable to load job logs' },
  )
  useEffect(() => {
    const timer = setInterval(() => { if (!document.hidden) reload() }, 15000)
    return () => clearInterval(timer)
  }, [reload])
  const active = data?.jobs.find((job) => job._id === selected?._id) || selected
  return <AppShell title="Job logs" subtitle="Background jobs, provider syncs and recorded execution attempts. Refreshes every 15 seconds." activeNav="admin" actions={<Button size="sm" variant="outline" onClick={reload} disabled={isRefreshing}>Refresh</Button>}>
    <AdminTabs value="jobs" />
    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:max-w-xl">
      <Select label="Status" value={status} onChange={(value) => { setStatus(value); setPage(1) }} options={[{ value: '', label: 'All statuses' }, ...['QUEUED','RUNNING','COMPLETE','PARTIAL','FAILED','UNAVAILABLE'].map((value) => ({ value, label: value }))]} />
      <Select label="Source" value={source} onChange={(value) => { setSource(value); setPage(1) }} options={[{ value: '', label: 'All sources' }, ...['queue','scheduler','google','square','forecast','calculate'].map((value) => ({ value, label: label(value) }))]} />
    </div>
    <p className="mt-3 text-xs text-card-text-muted">Queued jobs are waiting for the background worker. A growing queue can mean the worker is offline or falling behind. Historical attempts before logging was added may be unavailable.</p>
    <QueryState data={data} error={error} isLoading={isLoading} isRefreshing={isRefreshing} onRetry={reload} loader={<ListSkeleton />}>
      {({ jobs, pagination }) => <>
        <div className="space-y-3">
          {!jobs.length && <Card>No jobs match these filters.</Card>}
          {jobs.map((job) => <Card key={job._id}>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold capitalize">{label(job.jobType)}</h2><Pill size="sm" variant="outline" tone={job.status === 'FAILED' ? 'danger' : job.status === 'COMPLETE' ? 'success' : job.status === 'PARTIAL' ? 'warning' : 'neutral'}>{job.status}</Pill></div>
                <p className="mt-1 text-sm text-card-text-muted">{job.locationId?.name || 'Organization'} · {job.source} · {job.attempts} attempt(s)</p>
                <p className="mt-2 text-xs text-card-text-muted">{job.startedAt ? `Started ${timestamp(job.startedAt)}` : `Queued ${timestamp(job.createdAt)}`}</p>
                {job.finishedAt && <p className="mt-1 text-xs text-card-text-muted">Finished {timestamp(job.finishedAt)}{job.startedAt ? ` · ${Math.max(0, Math.round((Date.parse(job.finishedAt) - Date.parse(job.startedAt)) / 1000))} sec` : ''}</p>}
                {job.error && <p className="mt-2 break-words text-sm text-danger-subtle-text">{job.error}</p>}
              </div>
              <div className="shrink-0"><Button size="sm" variant="outline" onClick={() => setSelected(job)}>View details</Button></div>
            </div>
          </Card>)}
        </div>
        <Pagination meta={pagination} onPageChange={setPage} itemLabel="jobs" />
      </>}
    </QueryState>
    <Modal open={!!active} onClose={() => setSelected(null)} title="Job details" description={active ? label(active.jobType) : ''} size="lg">
      {active && <div className="max-h-[65dvh] space-y-4 overflow-y-auto">
        <p className="break-all text-xs text-card-text-muted">Job ID: {active._id}</p>
        <p className="text-sm">{active.status} · {active.locationId?.name || 'Organization'} · Business date: {active.businessDate}</p>
        {active.error && <p className="break-words text-danger-subtle-text">{active.error}</p>}
        <div><h3 className="mb-2 font-semibold">Result and source errors</h3><pre className="whitespace-pre-wrap break-words rounded-lg bg-card-subtle p-3 text-xs">{JSON.stringify(active.result || {}, null, 2)}</pre></div>
        <div><h3 className="mb-2 font-semibold">Recorded attempts</h3><pre className="whitespace-pre-wrap break-words rounded-lg bg-card-subtle p-3 text-xs">{active.history?.length ? JSON.stringify(active.history, null, 2) : 'No separate attempt history recorded.'}</pre></div>
      </div>}
    </Modal>
  </AppShell>
}

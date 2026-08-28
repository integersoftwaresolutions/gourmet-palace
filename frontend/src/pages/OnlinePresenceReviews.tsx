import { useState } from 'react'
import { AppShell } from '../components/layout/AppShell'
import { PresenceTabs } from '../components/layout/SectionTabs'
import { QueryError, QueryState, ListSkeleton } from '../components/query'
import { Button, Card, Pill } from '../components/ui'
import { reviewsApi } from '../lib/api'
import { asyncMessage } from '../lib/asyncError'
import { useAsyncResource } from '../hooks/useAsyncResource'
import { useAppState } from '../context/useAppState'

export function OnlinePresenceReviews() {
  const { query } = useAppState()
  const { data, error, isLoading, isRefreshing, reload } = useAsyncResource(
    () => reviewsApi.list(query).then((res) => ({ reviews: res.data.reviews, summary: res.data.summary as unknown as Record<string, unknown> })),
    [query],
    { fallbackError: 'Unable to load reviews' },
  )
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState('')

  const act = async (id: string, fn: () => Promise<unknown>) => {
    setBusy(id)
    try {
      await fn()
      setActionError('')
      reload()
    } catch (e) {
      setActionError(asyncMessage(e, 'Review action failed'))
    } finally {
      setBusy('')
    }
  }

  return (
    <AppShell title="Google Reviews" subtitle="Draft, approve, then explicitly post replies" activeNav="presence">
      <PresenceTabs value="reviews" />
      {actionError ? <QueryError message={actionError} className="mt-4" /> : null}
      <QueryState data={data} error={error} isLoading={isLoading} isRefreshing={isRefreshing} onRetry={reload} loader={<ListSkeleton rows={4} />}>
        {({ reviews: rows, summary }) => (
        <>
          <Card className="mb-4" title="Period summary">
            <p className="text-sm text-card-text-muted">
              {String(summary?.count ?? 0)} reviews · avg {summary?.averageRating == null ? 'Unavailable' : Number(summary.averageRating).toFixed(2)} ·
              {' '}{String(summary?.urgentCount ?? 0)} urgent · {String(summary?.sampleQualification || '')}
            </p>
          </Card>
          <div className="space-y-3">
            {rows.length === 0 && <Card><p className="text-sm text-card-text-muted">No reviews in this period.</p></Card>}
            {rows.map((review) => (
              <Card key={review._id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Pill tone={review.rating <= 2 ? 'danger' : review.rating <= 3 ? 'warning' : 'success'} variant="outline">{review.rating}/5</Pill>
                      <span className="text-sm font-semibold text-card-text">{review.reviewerName || 'Guest'}</span>
                      <Pill tone="neutral" variant="outline">{review.replyStatus}</Pill>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-card-text">{review.text || '(no written comment)'}</p>
                    {review.replyText && <p className="mt-2 text-sm text-card-text-muted">Draft: {review.replyText}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" disabled={busy === review._id} onClick={() => void act(review._id, () => reviewsApi.draftAi(review._id))}>AI draft</Button>
                    <Button size="sm" variant="outline" disabled={busy === review._id} onClick={() => void act(review._id, () => reviewsApi.approve(review._id))}>Approve</Button>
                    <Button size="sm" disabled={busy === review._id} onClick={() => void act(review._id, () => reviewsApi.post(review._id))}>Post to Google</Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
        )}
      </QueryState>
    </AppShell>
  )
}

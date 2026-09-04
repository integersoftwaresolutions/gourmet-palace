import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiCheck } from 'react-icons/fi'
import {
  Button,
  Card,
  KpiCard,
  Pill,
  Tabs,
} from '../components/ui'
import { AppShell } from '../components/layout/AppShell'
import { cn } from '../lib/cn'

type Review = {
  id: string
  rating: number
  snippet: string
  fullText: string
  location: string
  status: string
  source: string
  when: string
  urgent?: boolean
  draft?: string
  insight?: string
}

const reviews: Review[] = [
  {
    id: '1',
    rating: 5,
    snippet: 'Best Kung Pao in the valley…',
    fullText:
      'Best Kung Pao in the valley — spicy, fresh, and arrived hot. We will be back this weekend.',
    location: 'Sherman Oaks',
    status: 'Needs response',
    source: 'Google',
    when: '2h ago',
    draft:
      'Hi — thank you so much for the kind words! We’re glad the Kung Pao hit the mark. Looking forward to seeing you again soon.',
    insight:
      'Theme: taste · positive sentiment · high-leverage reply opportunity.',
  },
  {
    id: '2',
    rating: 1,
    snippet: 'Food arrived cold and the duck was…',
    fullText:
      'Food arrived cold and the duck was soggy. Really disappointed since we order every week. Delivery took 55 minutes.',
    location: 'Woodland Hills',
    status: 'Urgent · draft ready',
    source: 'Google',
    when: '5h ago',
    urgent: true,
    draft:
      'Hi — thank you for being a regular, and we’re sorry your duck arrived cold. That’s not the standard we hold at Woodland Hills. We’ve flagged the delivery handoff and would love to make it right.',
    insight:
      'Theme: delivery temperature · matches two other reviews and the refund spike. Risk: repeat customer.',
  },
  {
    id: '3',
    rating: 5,
    snippet: 'Great lunch specials, quick service',
    fullText:
      'Great lunch specials, quick service, and the staff remembered our usual order. Always a pleasure.',
    location: 'Simi Valley',
    status: 'Replied ✓',
    source: 'Yelp',
    when: '1d ago',
  },
]

function Stars({ rating, size = 'md' }: { rating: number; size?: 'sm' | 'md' }) {
  return (
    <span
      className={cn(
        'inline-flex gap-0.5 text-accent',
        size === 'sm' ? 'text-xs' : 'text-sm',
      )}
      aria-label={`${rating} out of 5 stars`}
    >
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className={i < rating ? 'text-accent' : 'text-card-text-faint'}
        >
          ★
        </span>
      ))}
    </span>
  )
}

export function OnlinePresenceReviews() {
  const navigate = useNavigate()
  const [selectedId, setSelectedId] = useState('2')
  const [draft, setDraft] = useState(
    () => reviews.find((r) => r.id === '2')?.draft ?? '',
  )

  const selected = reviews.find((r) => r.id === selectedId) ?? reviews[1]

  return (
    <AppShell
      title="Online Presence"
      subtitle="Reviews and direct-order growth — owner/admin visibility"
      activeNav="presence"
      badge={
        <Pill tone="accent" variant="outline">
          Admin only
        </Pill>
      }
    >
      <div className="flex flex-col gap-5">
        <Tabs
          value="reviews"
          onChange={(id) => {
            if (id === 'reviews') navigate('/presence')
            if (id === 'seo') navigate('/presence/seo')
          }}
          items={[
            { id: 'reviews', label: 'Reviews' },
            { id: 'seo', label: 'SEO & growth' },
          ]}
        />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Avg rating · 30d"
            value={
              <span className="inline-flex items-center gap-2">
                4.6 <Stars rating={5} size="sm" />
              </span>
            }
            delta={{ value: '0.2', direction: 'up' }}
          />
          <KpiCard
            label="New reviews · 30d"
            value="118"
            delta={{ value: '14%', direction: 'up' }}
          />
          <KpiCard
            label="Response queue"
            value="2"
            pill={
              <Pill tone="danger" variant="subtle" size="sm">
                ▼ urgent
              </Pill>
            }
          />
          <KpiCard
            label="Top themes"
            value="Fast · Fresh"
            meta={
              <span className="text-success-subtle-text">64 reviews</span>
            }
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.3fr]">
          <div>
            <p className="mb-3 text-[11px] font-semibold tracking-widest text-surface-text-faint uppercase">
              Review inbox
            </p>
            <ul className="flex flex-col gap-2">
              {reviews.map((review) => {
                const active = review.id === selectedId
                return (
                  <li key={review.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(review.id)
                        setDraft(review.draft ?? '')
                      }}
                      className={cn(
                        'w-full rounded-xl border bg-card px-4 py-3 text-left transition-colors',
                        active
                          ? 'border-accent-border'
                          : 'border-card-border hover:bg-card-hover',
                      )}
                    >
                      <Stars rating={review.rating} size="sm" />
                      <p className="mt-2 text-sm font-medium text-card-text">
                        “{review.snippet}”
                      </p>
                      <p className="mt-1 text-xs text-card-text-muted">
                        {review.location} · {review.status}
                      </p>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>

          <Card padding="lg">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Stars rating={selected.rating} />
                {selected.urgent && (
                  <Pill tone="danger" variant="outline" size="sm">
                    Urgent
                  </Pill>
                )}
                <Pill tone="neutral" variant="outline" size="sm">
                  {selected.location}
                </Pill>
              </div>
              <p className="text-xs text-card-text-muted">
                {selected.source} · {selected.when}
              </p>
            </div>

            <p className="mt-4 text-sm text-card-text">
              “{selected.fullText}”
            </p>

            {selected.insight && (
              <div className="mt-4 flex items-start gap-3 rounded-lg border border-accent-border bg-card-hover px-3 py-3">
                <span
                  className="mt-1 size-2 shrink-0 rotate-45 bg-accent"
                  aria-hidden
                />
                <p className="text-sm text-card-text">{selected.insight}</p>
              </div>
            )}

            {selected.draft != null ? (
              <>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold tracking-widest text-card-text-faint uppercase">
                    AI-drafted reply · warm & professional
                  </p>
                  <Pill tone="success" variant="outline" size="sm">
                    Tone ✓
                  </Pill>
                </div>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={4}
                  className="mt-3 w-full resize-y rounded-lg border border-card-border bg-card-subtle px-3 py-2.5 text-sm text-card-text outline-none focus:border-accent-border focus:outline-2 focus:outline-offset-0 focus:outline-accent-ring"
                />
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" tone="neutral">
                    Regenerate
                  </Button>
                  <Button
                    tone="brand"
                    size="sm"
                    leftIcon={<FiCheck className="size-3.5" />}
                  >
                    Approve & post
                  </Button>
                </div>
                <p className="mt-3 text-xs text-card-text-muted">
                  Nothing posts without explicit approval. Exact text and
                  location appear in confirmation.
                </p>
              </>
            ) : (
              <p className="mt-5 text-sm text-card-text-muted">
                This review already has a reply on file.
              </p>
            )}
          </Card>
        </div>
      </div>
    </AppShell>
  )
}

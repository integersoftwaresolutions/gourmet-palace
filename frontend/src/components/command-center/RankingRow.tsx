import { cn } from '../../lib/cn'
import type { Tone } from '../../lib/tones'

export type RankingRowProps = {
  rank: number
  name: string
  subtitle: string
  score: number | null
  tone?: Tone
  className?: string
}

function scoreTone(score: number | null): Tone {
  if (score == null) return 'neutral'
  if (score >= 80) return 'success'
  if (score >= 70) return 'warning'
  return 'danger'
}

export function RankingRow({
  rank,
  name,
  subtitle,
  score,
  tone,
  className,
}: RankingRowProps) {
  const resolvedTone = tone ?? scoreTone(score)

  return (
    <div
      className={cn(
        'grid grid-cols-[2rem_1fr_auto] items-center gap-3 rounded-lg border border-card-border px-3 py-2.5',
        className,
      )}
    >
      <span className="text-sm font-semibold text-card-text-faint">#{rank}</span>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-card-text">{name}</p>
        <p className="truncate text-xs text-card-text-muted">{subtitle}</p>
      </div>
      <span
        className={cn(
          'text-sm font-semibold tabular-nums',
          resolvedTone === 'success' && 'text-success-subtle-text',
          resolvedTone === 'warning' && 'text-warning-subtle-text',
          resolvedTone === 'danger' && 'text-danger-subtle-text',
          resolvedTone === 'neutral' && 'text-card-text-muted',
        )}
      >
        {score == null ? '—' : score}
      </span>
    </div>
  )
}

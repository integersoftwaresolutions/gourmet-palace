import { cn } from '../../lib/cn'
import type { ButtonTone } from '../../lib/tones'

export type ToggleProps = {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  disabled?: boolean
  tone?: ButtonTone
  className?: string
  id?: string
}

const trackOn: Record<ButtonTone, string> = {
  brand: 'bg-brand',
  accent: 'bg-accent',
  neutral: 'bg-neutral',
  danger: 'bg-danger',
}

export function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
  tone = 'accent',
  className,
  id,
}: ToggleProps) {
  return (
    <label
      htmlFor={id}
      className={cn(
        'inline-flex items-center gap-3',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
        className,
      )}
    >
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault()
            onChange(!checked)
          }
        }}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ring',
          checked ? trackOn[tone] : 'bg-card-border-strong',
        )}
      >
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute top-0.5 left-0.5 size-5 rounded-full bg-card-text shadow transition-transform',
            checked && 'translate-x-5',
            checked && tone === 'accent' && 'bg-accent-text',
          )}
        />
      </button>
      {label && (
        <span className="text-sm text-card-text">{label}</span>
      )}
    </label>
  )
}

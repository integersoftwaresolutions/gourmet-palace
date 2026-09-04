export type Tone =
  | 'brand'
  | 'accent'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'

export type ButtonTone = 'brand' | 'accent' | 'neutral' | 'danger'

/** Solid fill + text-on-fill */
export const toneSolid: Record<Tone, string> = {
  brand: 'bg-brand text-brand-text hover:bg-brand-hover active:bg-brand-active',
  accent: 'bg-accent text-accent-text hover:bg-accent-hover active:bg-accent-active',
  success:
    'bg-success text-success-text hover:bg-success-hover active:bg-success-active',
  warning:
    'bg-warning text-warning-text hover:bg-warning-hover active:bg-warning-active',
  danger: 'bg-danger text-danger-text hover:bg-danger-hover active:bg-danger-active',
  info: 'bg-info text-info-text hover:bg-info-hover active:bg-info-active',
  neutral:
    'bg-neutral text-neutral-text hover:bg-neutral-hover active:bg-neutral-active',
}

/** Soft tinted background + tinted text */
export const toneSubtle: Record<Tone, string> = {
  brand:
    'bg-brand-subtle text-brand-subtle-text hover:bg-brand-subtle-hover',
  accent:
    'bg-accent-subtle text-accent-subtle-text hover:bg-accent-subtle-hover',
  success:
    'bg-success-subtle text-success-subtle-text hover:bg-success-subtle-hover',
  warning:
    'bg-warning-subtle text-warning-subtle-text hover:bg-warning-subtle-hover',
  danger:
    'bg-danger-subtle text-danger-subtle-text hover:bg-danger-subtle-hover',
  info: 'bg-info-subtle text-info-subtle-text hover:bg-info-subtle-hover',
  neutral:
    'bg-neutral-subtle text-neutral-subtle-text hover:bg-neutral-subtle-hover',
}

/** Outline border + tinted text */
export const toneOutline: Record<Tone, string> = {
  brand: 'border border-brand-border text-brand-subtle-text bg-transparent',
  accent: 'border border-accent-border text-accent-subtle-text bg-transparent',
  success: 'border border-success-border text-success-subtle-text bg-transparent',
  warning: 'border border-warning-border text-warning-subtle-text bg-transparent',
  danger: 'border border-danger-border text-danger-subtle-text bg-transparent',
  info: 'border border-info-border text-info-subtle-text bg-transparent',
  neutral: 'border border-neutral-border text-neutral-subtle-text bg-transparent',
}

export const toneDot: Record<Tone, string> = {
  brand: 'bg-brand',
  accent: 'bg-accent',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
  neutral: 'bg-neutral',
}

export const toneRing: Record<Tone, string> = {
  brand: 'focus-visible:outline-brand-ring',
  accent: 'focus-visible:outline-accent-ring',
  success: 'focus-visible:outline-success-ring',
  warning: 'focus-visible:outline-warning-ring',
  danger: 'focus-visible:outline-danger-ring',
  info: 'focus-visible:outline-info-ring',
  neutral: 'focus-visible:outline-neutral-ring',
}

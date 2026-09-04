import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { type ButtonTone, toneSolid, toneSubtle, toneOutline } from '../../lib/tones'

export type ButtonVariant = 'fill' | 'outline' | 'ghost' | 'subtle'
export type ButtonSize = 'sm' | 'md' | 'lg'
export type ButtonShape = 'rounded' | 'pill'

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  tone?: ButtonTone
  size?: ButtonSize
  shape?: ButtonShape
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  loading?: boolean
  fullWidth?: boolean
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 gap-1.5 px-3 text-xs',
  md: 'h-10 gap-2 px-4 text-sm',
  lg: 'h-12 gap-2 px-5 text-base',
}

const shapeClasses: Record<ButtonShape, string> = {
  rounded: 'rounded-lg',
  pill: 'rounded-full',
}

function variantClasses(variant: ButtonVariant, tone: ButtonTone): string {
  switch (variant) {
    case 'fill':
      return toneSolid[tone]
    case 'subtle':
      return toneSubtle[tone]
    case 'outline':
      return cn(toneOutline[tone], 'hover:bg-card-hover')
    case 'ghost':
      return cn(
        'bg-transparent border border-transparent',
        tone === 'accent' && 'text-accent-subtle-text hover:bg-accent-subtle',
        tone === 'brand' && 'text-brand-subtle-text hover:bg-brand-subtle',
        tone === 'danger' && 'text-danger-subtle-text hover:bg-danger-subtle',
        tone === 'neutral' && 'text-card-text-muted hover:bg-card-hover',
      )
  }
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      className,
      variant = 'fill',
      tone,
      size = 'md',
      shape = 'pill',
      leftIcon,
      rightIcon,
      loading = false,
      fullWidth = false,
      disabled,
      children,
      type = 'button',
      ...props
    },
    ref,
  ) {
    const resolvedTone: ButtonTone =
      tone ?? (variant === 'fill' ? 'brand' : 'neutral')

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center font-semibold transition-colors',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ring',
          'disabled:pointer-events-none disabled:opacity-50',
          sizeClasses[size],
          shapeClasses[shape],
          variantClasses(variant, resolvedTone),
          fullWidth && 'w-full',
          className,
        )}
        {...props}
      >
        {loading ? (
          <span
            className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent"
            aria-hidden
          />
        ) : (
          leftIcon
        )}
        {children}
        {!loading && rightIcon}
      </button>
    )
  },
)

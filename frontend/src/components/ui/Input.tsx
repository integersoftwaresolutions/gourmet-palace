import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

export type InputSize = 'sm' | 'md' | 'lg'

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  label?: string
  hint?: string
  error?: string
  leftIcon?: ReactNode
  rightSlot?: ReactNode
  size?: InputSize
}

const sizeClasses: Record<InputSize, string> = {
  sm: 'h-8 text-xs',
  md: 'h-10 text-sm',
  lg: 'h-12 text-base',
}

const padLeft: Record<InputSize, string> = {
  sm: 'pl-8',
  md: 'pl-10',
  lg: 'pl-11',
}

const padRight: Record<InputSize, string> = {
  sm: 'pr-8',
  md: 'pr-10',
  lg: 'pr-11',
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    className,
    label,
    hint,
    error,
    leftIcon,
    rightSlot,
    size = 'md',
    id,
    disabled,
    ...props
  },
  ref,
) {
  const inputId = id ?? props.name

  return (
    <div className={cn('flex w-full flex-col gap-1.5', className)}>
      {label && (
        <label
          htmlFor={inputId}
          className="text-[11px] font-medium tracking-widest text-card-text-faint uppercase"
        >
          {label}
        </label>
      )}

      <div className="relative">
        {leftIcon && (
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-card-text-faint">
            {leftIcon}
          </span>
        )}

        <input
          ref={ref}
          id={inputId}
          disabled={disabled}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={
            error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined
          }
          className={cn(
            'w-full rounded-lg border bg-card-subtle px-3 text-card-text',
            'placeholder:text-card-text-faint',
            'transition-colors',
            'hover:border-card-border-strong',
            'focus:border-card-border-strong focus:outline-2 focus:outline-offset-0 focus:outline-accent-ring',
            'disabled:cursor-not-allowed disabled:opacity-50',
            sizeClasses[size],
            leftIcon && padLeft[size],
            rightSlot && padRight[size],
            error
              ? 'border-danger-border focus:outline-danger-ring'
              : 'border-card-border',
          )}
          {...props}
        />

        {rightSlot && (
          <span className="absolute inset-y-0 right-0 flex items-center pr-3">
            {rightSlot}
          </span>
        )}
      </div>

      {error ? (
        <p id={`${inputId}-error`} className="text-xs text-danger-subtle-text">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-xs text-card-text-faint">
          {hint}
        </p>
      ) : null}
    </div>
  )
})

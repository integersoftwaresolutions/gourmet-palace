import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type KeyboardEvent,
} from 'react'
import { FiChevronDown } from 'react-icons/fi'
import { cn } from '../../lib/cn'

export type SelectOption = {
  value: string
  label: string
  disabled?: boolean
}

export type SelectSize = 'sm' | 'md' | 'lg'

export type SelectProps = {
  options: SelectOption[]
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  placeholder?: string
  label?: string
  error?: string
  size?: SelectSize
  disabled?: boolean
  className?: string
  id?: string
  name?: string
}

const sizeClasses: Record<SelectSize, string> = {
  sm: 'h-8 text-xs',
  md: 'h-10 text-sm',
  lg: 'h-12 text-base',
}

export const Select = forwardRef<HTMLButtonElement, SelectProps>(
  function Select(
    {
      options,
      value: controlledValue,
      defaultValue,
      onChange,
      placeholder = 'Select…',
      label,
      error,
      size = 'md',
      disabled = false,
      className,
      id,
      name,
    },
    ref,
  ) {
    const autoId = useId()
    const selectId = id ?? autoId
    const listboxId = `${selectId}-listbox`
    const isControlled = controlledValue !== undefined
    const [internalValue, setInternalValue] = useState(defaultValue ?? '')
    const value = isControlled ? controlledValue : internalValue
    const [open, setOpen] = useState(false)
    const [activeIndex, setActiveIndex] = useState(-1)
    const rootRef = useRef<HTMLDivElement>(null)
    const listRef = useRef<HTMLUListElement>(null)

    const selected = options.find((o) => o.value === value)

    const setValue = (next: string) => {
      if (!isControlled) setInternalValue(next)
      onChange?.(next)
      setOpen(false)
    }

    useEffect(() => {
      if (!open) return
      const onDoc = (e: MouseEvent) => {
        if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
      }
      document.addEventListener('mousedown', onDoc)
      return () => document.removeEventListener('mousedown', onDoc)
    }, [open])

    useEffect(() => {
      if (!open) return
      const idx = Math.max(
        0,
        options.findIndex((o) => o.value === value && !o.disabled),
      )
      setActiveIndex(idx === -1 ? 0 : idx)
    }, [open, options, value])

    const moveActive = (delta: number) => {
      if (!options.length) return
      let i = activeIndex
      for (let n = 0; n < options.length; n++) {
        i = (i + delta + options.length) % options.length
        if (!options[i]?.disabled) {
          setActiveIndex(i)
          return
        }
      }
    }

    const onTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
      if (disabled) return
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          if (!open) setOpen(true)
          else moveActive(1)
          break
        case 'ArrowUp':
          e.preventDefault()
          if (!open) setOpen(true)
          else moveActive(-1)
          break
        case 'Enter':
        case ' ':
          e.preventDefault()
          if (!open) setOpen(true)
          else if (activeIndex >= 0 && !options[activeIndex]?.disabled) {
            setValue(options[activeIndex].value)
          }
          break
        case 'Escape':
          e.preventDefault()
          setOpen(false)
          break
      }
    }

    const triggerProps: ButtonHTMLAttributes<HTMLButtonElement> = {
      type: 'button',
      id: selectId,
      disabled,
      'aria-haspopup': 'listbox',
      'aria-expanded': open,
      'aria-controls': listboxId,
      'aria-invalid': Boolean(error) || undefined,
      onClick: () => !disabled && setOpen((o) => !o),
      onKeyDown: onTriggerKeyDown,
    }

    return (
      <div ref={rootRef} className={cn('relative flex w-full flex-col gap-1.5', className)}>
        {label && (
          <label
            htmlFor={selectId}
            className="text-[11px] font-medium tracking-widest text-card-text-faint uppercase"
          >
            {label}
          </label>
        )}

        {name && <input type="hidden" name={name} value={value} />}

        <button
          ref={ref}
          {...triggerProps}
          className={cn(
            'flex w-full items-center justify-between gap-2 rounded-lg border bg-card-subtle px-3 text-left transition-colors',
            'focus:border-card-border-strong focus:outline-2 focus:outline-offset-0 focus:outline-accent-ring',
            'disabled:cursor-not-allowed disabled:opacity-50',
            sizeClasses[size],
            error
              ? 'border-danger-border focus:outline-danger-ring'
              : 'border-card-border hover:border-card-border-strong',
          )}
        >
          <span
            className={cn(
              'truncate',
              selected ? 'text-card-text' : 'text-card-text-faint',
            )}
          >
            {selected?.label ?? placeholder}
          </span>
          <FiChevronDown
            className={cn(
              'size-4 shrink-0 text-card-text-faint transition-transform',
              open && 'rotate-180',
            )}
          />
        </button>

        {open && (
          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-labelledby={selectId}
            className="absolute top-full z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-card-border bg-card py-1 shadow-lg"
          >
            {options.map((option, index) => (
              <li
                key={option.value}
                role="option"
                aria-selected={option.value === value}
                aria-disabled={option.disabled || undefined}
                className={cn(
                  'cursor-pointer px-3 py-2 text-sm transition-colors',
                  option.disabled && 'cursor-not-allowed opacity-40',
                  !option.disabled && 'hover:bg-card-hover',
                  index === activeIndex && !option.disabled && 'bg-card-hover',
                  option.value === value
                    ? 'text-accent-subtle-text'
                    : 'text-card-text',
                )}
                onMouseEnter={() => !option.disabled && setActiveIndex(index)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  if (!option.disabled) setValue(option.value)
                }}
              >
                {option.label}
              </li>
            ))}
          </ul>
        )}

        {error && (
          <p className="text-xs text-danger-subtle-text">{error}</p>
        )}
      </div>
    )
  },
)

import type { HTMLAttributes, ReactNode } from 'react'
import { FiX } from 'react-icons/fi'
import { cn } from '../../lib/cn'
import {
  type Tone,
  toneDot,
  toneOutline,
  toneSolid,
  toneSubtle,
} from '../../lib/tones'

export type PillVariant = 'solid' | 'subtle' | 'outline'
export type PillSize = 'sm' | 'md'

export type PillProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: PillVariant
  tone?: Tone
  size?: PillSize
  dot?: boolean
  onRemove?: () => void
  children: ReactNode
}

const sizeClasses: Record<PillSize, string> = {
  sm: 'gap-1 px-2 py-0.5 text-[10px] tracking-wider',
  md: 'gap-1.5 px-3 py-1 text-[11px] tracking-wider',
}

function variantClasses(variant: PillVariant, tone: Tone): string {
  switch (variant) {
    case 'solid':
      return toneSolid[tone]
    case 'subtle':
      return toneSubtle[tone]
    case 'outline':
      return toneOutline[tone]
  }
}

export function Pill({
  className,
  variant = 'outline',
  tone = 'neutral',
  size = 'sm',
  dot = false,
  onRemove,
  children,
  ...props
}: PillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-semibold uppercase',
        sizeClasses[size],
        variantClasses(variant, tone),
        className,
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn('size-1.5 shrink-0 rounded-full', toneDot[tone])}
          aria-hidden
        />
      )}
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-0.5 -mr-0.5 inline-flex rounded-full p-0.5 opacity-70 hover:opacity-100"
          aria-label="Remove"
        >
          <FiX className="size-3" />
        </button>
      )}
    </span>
  )
}

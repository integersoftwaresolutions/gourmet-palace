import { Button } from './Button'
import { FiChevronDown } from 'react-icons/fi'
import { cn } from '../../lib/cn'
import {
  PAGE_SIZE_OPTIONS,
  pageItemRange,
  type PaginationMeta,
  type PageSizeOption,
} from '../../lib/pagination'

export type PaginationProps = {
  meta: PaginationMeta
  onPageChange: (page: number) => void
  onLimitChange?: (limit: number) => void
  pageSizeOptions?: readonly number[]
  className?: string
  /** Extra copy after the range label (e.g. “exception orders”). */
  itemLabel?: string
  disabled?: boolean
}

export function Pagination({
  meta,
  onPageChange,
  onLimitChange,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
  className,
  itemLabel = 'rows',
  disabled = false,
}: PaginationProps) {
  const range = pageItemRange(meta)
  const pageLabel =
    meta.totalPages === 0
      ? 'Page 0 of 0'
      : `Page ${meta.page.toLocaleString()} of ${meta.totalPages.toLocaleString()}`

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 border-t border-card-border px-4 py-3',
        className,
      )}
    >
      <p className="text-xs text-card-text-faint">
        {meta.total === 0
          ? `No ${itemLabel}`
          : `Showing ${range.from.toLocaleString()}–${range.to.toLocaleString()} of ${meta.total.toLocaleString()} ${itemLabel}`}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {onLimitChange ? (
          <div className="relative w-[7.5rem]">
            <select
              aria-label="Rows per page"
              className="h-8 w-full appearance-none rounded-lg border border-card-border bg-card-subtle pr-8 pl-3 text-xs text-card-text hover:border-card-border-strong disabled:opacity-50"
              value={meta.limit}
              disabled={disabled}
              onChange={(event) => onLimitChange(Number(event.target.value))}
            >
              {pageSizeOptions.map((n) => <option key={n} value={n}>{n} / page</option>)}
            </select>
            <FiChevronDown aria-hidden="true" className="pointer-events-none absolute top-2 right-3 size-4 text-card-text-faint" />
          </div>
        ) : null}

        <span className="text-xs text-card-text-muted tabular-nums">{pageLabel}</span>

        <Button
          type="button"
          size="sm"
          variant="outline"
          tone="neutral"
          shape="rounded"
          disabled={disabled || !meta.hasPrev}
          onClick={() => onPageChange(meta.page - 1)}
          aria-label="Previous page"
        >
          Previous
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          tone="neutral"
          shape="rounded"
          disabled={disabled || !meta.hasNext}
          onClick={() => onPageChange(meta.page + 1)}
          aria-label="Next page"
        >
          Next
        </Button>
      </div>
    </div>
  )
}

export type { PageSizeOption }

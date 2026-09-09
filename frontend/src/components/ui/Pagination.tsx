import { Button } from './Button'
import { Select } from './Select'
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
          <Select
            size="sm"
            className="w-[7.5rem]"
            value={String(meta.limit)}
            disabled={disabled}
            onChange={(value) => onLimitChange(Number(value))}
            options={pageSizeOptions.map((n) => ({
              value: String(n),
              label: `${n} / page`,
            }))}
            id="pagination-page-size"
          />
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

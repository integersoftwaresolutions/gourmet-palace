/** Shared pagination contract — mirrors backend `paginationMeta`. */

export type PaginationMeta = {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

export const DEFAULT_PAGE_SIZE = 25
export const PAGE_SIZE_OPTIONS = [25, 50, 100] as const
export type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number]

export function buildPaginationMeta(page: number, limit: number, total: number): PaginationMeta {
  const safeTotal = Math.max(0, total)
  const totalPages = safeTotal === 0 ? 0 : Math.ceil(safeTotal / limit)
  const safePage = totalPages === 0 ? 1 : Math.min(Math.max(1, page), totalPages)
  return {
    page: safePage,
    limit,
    total: safeTotal,
    totalPages,
    hasNext: totalPages > 0 && safePage < totalPages,
    hasPrev: safePage > 1,
  }
}

/** Inclusive 1-based item range for the current page (0–0 when empty). */
export function pageItemRange(meta: Pick<PaginationMeta, 'page' | 'limit' | 'total'>): {
  from: number
  to: number
} {
  if (meta.total === 0) return { from: 0, to: 0 }
  const from = (meta.page - 1) * meta.limit + 1
  const to = Math.min(meta.page * meta.limit, meta.total)
  return { from, to }
}

export function toPaginationQuery(page: number, limit: number): { page: string; limit: string } {
  return { page: String(page), limit: String(limit) }
}

/** Normalize a partial API payload into a full PaginationMeta. */
export function normalizePaginationMeta(
  partial: Partial<PaginationMeta> & Pick<PaginationMeta, 'page' | 'limit' | 'total'>,
): PaginationMeta {
  if (
    typeof partial.totalPages === 'number' &&
    typeof partial.hasNext === 'boolean' &&
    typeof partial.hasPrev === 'boolean'
  ) {
    return {
      page: partial.page,
      limit: partial.limit,
      total: partial.total,
      totalPages: partial.totalPages,
      hasNext: partial.hasNext,
      hasPrev: partial.hasPrev,
    }
  }
  return buildPaginationMeta(partial.page, partial.limit, partial.total)
}

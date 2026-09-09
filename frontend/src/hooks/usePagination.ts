import { useCallback, useState } from 'react'
import { DEFAULT_PAGE_SIZE } from '../lib/pagination'

type UsePaginationOptions = {
  initialPage?: number
  initialLimit?: number
  /** When this value changes, page resets to 1 (e.g. serialized filter query). */
  resetKey?: string | number
}

export function usePagination({
  initialPage = 1,
  initialLimit = DEFAULT_PAGE_SIZE,
  resetKey,
}: UsePaginationOptions = {}) {
  const [page, setPageState] = useState(initialPage)
  const [limit, setLimitState] = useState(initialLimit)
  const [seenResetKey, setSeenResetKey] = useState(resetKey)

  // Reset page in the same render as a filter change so the next fetch uses page 1.
  if (resetKey !== undefined && resetKey !== seenResetKey) {
    setSeenResetKey(resetKey)
    if (page !== 1) setPageState(1)
  }

  const setPage = useCallback((next: number) => setPageState(Math.max(1, next)), [])
  const setLimit = useCallback((next: number) => {
    setLimitState(next)
    setPageState(1)
  }, [])
  const nextPage = useCallback(() => setPageState((p) => p + 1), [])
  const prevPage = useCallback(() => setPageState((p) => Math.max(1, p - 1)), [])

  return {
    page,
    limit,
    setPage,
    setLimit,
    nextPage,
    prevPage,
  }
}

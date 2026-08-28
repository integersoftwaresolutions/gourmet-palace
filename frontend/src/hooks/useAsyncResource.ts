import { useCallback, useEffect, useRef, useState } from 'react'
import { asyncMessage } from '../lib/asyncError'

export function useAsyncResource<T>(
  loader: () => Promise<T>,
  deps: readonly unknown[],
  options: { fallbackError?: string } = {},
) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(true)
  const [tick, setTick] = useState(0)
  const loaderRef = useRef(loader)
  loaderRef.current = loader
  const fallback = options.fallbackError || 'Unable to load'

  const reload = useCallback(() => setTick((value) => value + 1), [])

  useEffect(() => {
    let cancelled = false
    setPending(true)
    setError(null)
    loaderRef.current()
      .then((result) => {
        if (cancelled) return
        setData(result)
        setError(null)
      })
      .catch((err) => {
        if (cancelled) return
        setError(asyncMessage(err, fallback))
      })
      .finally(() => {
        if (!cancelled) setPending(false)
      })
    return () => {
      cancelled = true
    }
    // loader is read from a ref so callers can close over the latest query without extra identity churn
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick, fallback])

  return {
    data,
    error,
    isLoading: pending && data == null,
    isRefreshing: pending && data != null,
    reload,
  }
}

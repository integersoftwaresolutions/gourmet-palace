import { ApiClientError } from './api'

export function asyncMessage(err: unknown, fallback: string) {
  if (err instanceof ApiClientError && err.message) return err.message
  if (err instanceof Error && err.message) return err.message
  return fallback
}

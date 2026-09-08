import { SpotifyApiError, QUOTA_EXCEEDED } from './client'

/** User-facing copy for development-mode quota exhaustion. */
export const QUOTA_EXCEEDED_MESSAGE =
  "This app's Spotify development-mode quota is used up. Try again later."

export function isQuotaExceededError(err: unknown): boolean {
  return (
    err instanceof SpotifyApiError &&
    err.status === 429 &&
    err.reason === QUOTA_EXCEEDED
  )
}

export function formatSpotifyError(
  err: unknown,
  fallback = 'Something went wrong',
): string {
  if (isQuotaExceededError(err)) return QUOTA_EXCEEDED_MESSAGE
  if (err instanceof Error) return err.message
  return fallback
}

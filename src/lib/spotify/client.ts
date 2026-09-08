import {
  clearTokens,
  loadTokens,
  refreshAccessToken,
  saveTokens,
} from './pkce'
import type { SpotifyErrorBody, StoredTokens } from './types'

const API_BASE = 'https://api.spotify.com/v1'
/** Floor for 429 backoff — Spotify sometimes returns a tiny Retry-After. */
const MIN_RETRY_AFTER_MS = 2000
const MAX_RATE_LIMIT_RETRIES = 8
/** How long to short-circuit after a development-mode QUOTA_EXCEEDED. */
const QUOTA_COOLDOWN_MS = 60 * 60_000

export const QUOTA_EXCEEDED = 'QUOTA_EXCEEDED'

export class SpotifyApiError extends Error {
  status: number
  reason?: string

  constructor(status: number, message: string, reason?: string) {
    super(message)
    this.name = 'SpotifyApiError'
    this.status = status
    this.reason = reason
  }
}

type TokenListener = (tokens: StoredTokens | null) => void

let onTokensChanged: TokenListener | null = null
let refreshPromise: Promise<StoredTokens> | null = null

export function setTokenChangeListener(listener: TokenListener | null): void {
  onTokensChanged = listener
}

async function getValidAccessToken(): Promise<string> {
  const tokens = loadTokens()
  if (!tokens) {
    throw new SpotifyApiError(401, 'Not authenticated')
  }

  // Refresh 60s before expiry
  if (Date.now() < tokens.expiresAt - 60_000) {
    return tokens.accessToken
  }

  return (await refreshTokens(tokens.refreshToken)).accessToken
}

async function refreshTokens(refreshToken: string): Promise<StoredTokens> {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken(refreshToken)
      .then((tokens) => {
        onTokensChanged?.(tokens)
        return tokens
      })
      .catch((error) => {
        clearTokens()
        onTokensChanged?.(null)
        throw error
      })
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Shared across callers so a 429 pauses the whole client. */
let rateLimitedUntil = 0

/**
 * After QUOTA_EXCEEDED, reject further calls without hitting the network
 * so a partially-finished fan-out cannot burn the rest of the bucket.
 */
let quotaExhaustedUntil = 0

/**
 * Serialize every Spotify HTTP call. Concurrent workers waking from a shared
 * Retry-After wait otherwise stampede and immediately 429 again.
 */
let fetchQueue: Promise<unknown> = Promise.resolve()

function enqueueFetch<T>(fn: () => Promise<T>): Promise<T> {
  const run = fetchQueue.then(fn, fn)
  fetchQueue = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

async function waitForRateLimit(): Promise<void> {
  while (Date.now() < rateLimitedUntil) {
    await sleep(rateLimitedUntil - Date.now())
  }
}

function noteRateLimit(retryAfterMs: number): void {
  const delay = Math.max(retryAfterMs, MIN_RETRY_AFTER_MS)
  rateLimitedUntil = Math.max(rateLimitedUntil, Date.now() + delay)
}

function noteQuotaExceeded(): void {
  quotaExhaustedUntil = Math.max(
    quotaExhaustedUntil,
    Date.now() + QUOTA_COOLDOWN_MS,
  )
}

function assertQuotaAvailable(): void {
  if (Date.now() < quotaExhaustedUntil) {
    throw new SpotifyApiError(
      429,
      'Spotify development-mode quota exceeded',
      QUOTA_EXCEEDED,
    )
  }
}

/** Test helper — reset shared rate-limit / queue state between unit tests. */
export function resetRateLimitStateForTests(): void {
  rateLimitedUntil = 0
  quotaExhaustedUntil = 0
  fetchQueue = Promise.resolve()
}

async function parseError(response: Response): Promise<SpotifyApiError> {
  try {
    const body = (await response.json()) as SpotifyErrorBody
    return new SpotifyApiError(
      response.status,
      body.error?.message ?? `Spotify API error (${response.status})`,
      body.error?.reason,
    )
  } catch {
    return new SpotifyApiError(
      response.status,
      `Spotify API error (${response.status})`,
    )
  }
}

async function peekErrorReason(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.clone().json()) as SpotifyErrorBody
    return body.error?.reason
  } catch {
    return undefined
  }
}

async function spotifyFetchUnqueued(
  path: string,
  init: RequestInit = {},
  retryCount = 0,
): Promise<Response> {
  assertQuotaAvailable()
  await waitForRateLimit()

  const accessToken = await getValidAccessToken()
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`

  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  })

  if (response.status === 401 && retryCount === 0) {
    const tokens = loadTokens()
    if (!tokens) {
      throw new SpotifyApiError(401, 'Not authenticated')
    }
    await refreshTokens(tokens.refreshToken)
    return spotifyFetchUnqueued(path, init, retryCount + 1)
  }

  if (response.status === 429) {
    const reason = await peekErrorReason(response)
    if (reason === QUOTA_EXCEEDED) {
      noteQuotaExceeded()
      throw new SpotifyApiError(
        429,
        'Spotify development-mode quota exceeded',
        QUOTA_EXCEEDED,
      )
    }

    if (retryCount < MAX_RATE_LIMIT_RETRIES) {
      const retryAfterHeader = response.headers.get('Retry-After')
      const retryAfterSec = retryAfterHeader ? Number(retryAfterHeader) : NaN
      const baseDelay = Number.isFinite(retryAfterSec)
        ? retryAfterSec * 1000
        : 1000 * 2 ** retryCount
      // Spotify keeps returning the same Retry-After while we're in a penalty
      // window, so grow the wait ourselves instead of retrying at a fixed pace.
      noteRateLimit(baseDelay * 2 ** retryCount)
      await waitForRateLimit()
      return spotifyFetchUnqueued(path, init, retryCount + 1)
    }
  }

  if (!response.ok) {
    throw await parseError(response)
  }

  return response
}

export function spotifyFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  return enqueueFetch(() => spotifyFetchUnqueued(path, init))
}

export async function spotifyJson<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await spotifyFetch(path, init)
  if (response.status === 204) {
    return undefined as T
  }
  const text = await response.text()
  if (!text.trim()) {
    return undefined as T
  }
  return JSON.parse(text) as T
}

/** Keep tokens in sync when AuthContext saves them externally */
export function notifyTokensUpdated(tokens: StoredTokens | null): void {
  if (tokens) {
    saveTokens(tokens)
  }
  onTokensChanged?.(tokens)
}

import {
  clearTokens,
  loadTokens,
  refreshAccessToken,
  saveTokens,
} from './pkce'
import type { SpotifyErrorBody, StoredTokens } from './types'

const API_BASE = 'https://api.spotify.com/v1'

export class SpotifyApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'SpotifyApiError'
    this.status = status
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

async function parseError(response: Response): Promise<SpotifyApiError> {
  try {
    const body = (await response.json()) as SpotifyErrorBody
    return new SpotifyApiError(
      response.status,
      body.error?.message ?? `Spotify API error (${response.status})`,
    )
  } catch {
    return new SpotifyApiError(
      response.status,
      `Spotify API error (${response.status})`,
    )
  }
}

export async function spotifyFetch(
  path: string,
  init: RequestInit = {},
  retryCount = 0,
): Promise<Response> {
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
    return spotifyFetch(path, init, retryCount + 1)
  }

  if (response.status === 429 && retryCount < 5) {
    const retryAfterHeader = response.headers.get('Retry-After')
    const retryAfterSec = retryAfterHeader ? Number(retryAfterHeader) : NaN
    const baseDelay = Number.isFinite(retryAfterSec)
      ? retryAfterSec * 1000
      : 1000 * 2 ** retryCount
    await sleep(baseDelay)
    return spotifyFetch(path, init, retryCount + 1)
  }

  if (!response.ok) {
    throw await parseError(response)
  }

  return response
}

export async function spotifyJson<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await spotifyFetch(path, init)
  if (response.status === 204) {
    return undefined as T
  }
  return (await response.json()) as T
}

/** Keep tokens in sync when AuthContext saves them externally */
export function notifyTokensUpdated(tokens: StoredTokens | null): void {
  if (tokens) {
    saveTokens(tokens)
  }
  onTokensChanged?.(tokens)
}

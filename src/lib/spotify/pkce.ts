const AUTH_URL = 'https://accounts.spotify.com/authorize'
const TOKEN_URL = 'https://accounts.spotify.com/api/token'

export const REQUIRED_SCOPES = [
  'user-library-read',
  'user-library-modify',
  'user-read-playback-position',
  'user-read-playback-state',
  'user-modify-playback-state',
] as const

export const SCOPES = REQUIRED_SCOPES.join(' ')

export function tokensHaveRequiredScopes(
  tokens: import('./types').StoredTokens,
): boolean {
  const granted = new Set(
    (tokens.scope ?? '')
      .split(/\s+/)
      .map((s) => s.trim())
      .filter(Boolean),
  )
  return REQUIRED_SCOPES.every((scope) => granted.has(scope))
}

export const REDIRECT_URI = `${typeof window !== 'undefined' ? window.location.origin : 'http://127.0.0.1'}/callback`

const VERIFIER_KEY = 'spotify_pkce_verifier'
const STATE_KEY = 'spotify_pkce_state'
const TOKENS_KEY = 'spotify_tokens'

function getClientId(): string {
  const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID
  if (!clientId) {
    throw new Error('Missing VITE_SPOTIFY_CLIENT_ID in environment')
  }
  return clientId
}

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function randomString(length: number): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  const values = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(values, (v) => chars[v % chars.length]).join('')
}

async function sha256(plain: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder()
  return crypto.subtle.digest('SHA-256', encoder.encode(plain))
}

export async function createCodeChallenge(verifier: string): Promise<string> {
  const hashed = await sha256(verifier)
  return base64UrlEncode(hashed)
}

export async function beginLogin(): Promise<void> {
  const verifier = randomString(64)
  const state = randomString(32)
  const challenge = await createCodeChallenge(verifier)

  sessionStorage.setItem(VERIFIER_KEY, verifier)
  sessionStorage.setItem(STATE_KEY, state)

  const params = new URLSearchParams({
    client_id: getClientId(),
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    state,
    code_challenge_method: 'S256',
    code_challenge: challenge,
  })

  window.location.assign(`${AUTH_URL}?${params.toString()}`)
}

async function parseTokenResponse(response: Response): Promise<import('./types').TokenResponse> {
  const body = (await response.json()) as
    | import('./types').TokenResponse
    | { error: string; error_description?: string }

  if (!response.ok) {
    const message =
      'error_description' in body && body.error_description
        ? body.error_description
        : 'error' in body
          ? String(body.error)
          : `Token request failed (${response.status})`
    throw new Error(message)
  }

  return body as import('./types').TokenResponse
}

export async function exchangeCodeForTokens(
  code: string,
  state: string,
): Promise<import('./types').StoredTokens> {
  const expectedState = sessionStorage.getItem(STATE_KEY)
  const verifier = sessionStorage.getItem(VERIFIER_KEY)

  if (!expectedState || state !== expectedState) {
    throw new Error('Invalid OAuth state — try logging in again')
  }
  if (!verifier) {
    throw new Error('Missing PKCE verifier — try logging in again')
  }

  const body = new URLSearchParams({
    client_id: getClientId(),
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: verifier,
  })

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  const tokens = await parseTokenResponse(response)

  sessionStorage.removeItem(VERIFIER_KEY)
  sessionStorage.removeItem(STATE_KEY)

  if (!tokens.refresh_token) {
    throw new Error('No refresh token returned from Spotify')
  }

  const stored: import('./types').StoredTokens = {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
    scope: tokens.scope,
  }
  saveTokens(stored)
  return stored
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<import('./types').StoredTokens> {
  const existing = loadTokens()
  const body = new URLSearchParams({
    client_id: getClientId(),
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  })

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  const tokens = await parseTokenResponse(response)

  const stored: import('./types').StoredTokens = {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? refreshToken,
    expiresAt: Date.now() + tokens.expires_in * 1000,
    scope: tokens.scope || existing?.scope,
  }
  saveTokens(stored)
  return stored
}

export function saveTokens(tokens: import('./types').StoredTokens): void {
  localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens))
}

export function loadTokens(): import('./types').StoredTokens | null {
  const raw = localStorage.getItem(TOKENS_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as import('./types').StoredTokens
  } catch {
    localStorage.removeItem(TOKENS_KEY)
    return null
  }
}

export function clearTokens(): void {
  localStorage.removeItem(TOKENS_KEY)
}

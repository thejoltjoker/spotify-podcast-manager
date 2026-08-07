import type { StoredTokens } from '@/lib/spotify/types'

export type BootstrapResult =
  | { status: 'authenticated'; tokens: StoredTokens }
  | { status: 'unauthenticated'; error?: string }

export type BootstrapDeps = {
  pathname: string
  search: string
  replaceState: (url: string) => void
  exchangeCodeForTokens: (
    code: string,
    state: string,
  ) => Promise<StoredTokens>
  loadTokens: () => StoredTokens | null
}

/** Shared so React StrictMode remounts await the same callback exchange. */
let pendingExchange: Promise<StoredTokens> | null = null

export function resetOAuthBootstrapForTests(): void {
  pendingExchange = null
}

export async function bootstrapAuth(
  deps: BootstrapDeps,
): Promise<BootstrapResult> {
  const params = new URLSearchParams(deps.search)
  const isCallback = deps.pathname === '/callback'

  if (isCallback) {
    const code = params.get('code')
    const state = params.get('state')
    const oauthError = params.get('error')

    deps.replaceState('/')

    if (oauthError) {
      return {
        status: 'unauthenticated',
        error: `Spotify login failed: ${oauthError}`,
      }
    }

    if (code && state && !pendingExchange) {
      pendingExchange = deps.exchangeCodeForTokens(code, state).finally(() => {
        pendingExchange = null
      })
    }
  }

  if (pendingExchange) {
    try {
      const tokens = await pendingExchange
      return { status: 'authenticated', tokens }
    } catch (err) {
      return {
        status: 'unauthenticated',
        error: err instanceof Error ? err.message : 'Login failed',
      }
    }
  }

  const existing = deps.loadTokens()
  if (existing) {
    return { status: 'authenticated', tokens: existing }
  }
  return { status: 'unauthenticated' }
}
